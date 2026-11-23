"""Organizer answers in the shapes the organizer screens use (frontend/src/api/types.ts).

The rules mirror the demo data handlers (frontend/src/api/mock/mockOrganizer.ts), which
were written from the build prompt: gaps, readiness, conflicts, report and the
5-sponsor request limit. Lists load in a fixed number of queries (see loaders.py).
"""

import uuid
from collections import defaultdict

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Benefit, EventMembership, Need, Offer, Project, SponsorRequest
from app.models.enums import MembershipStatus, NeedType, OfferStage, ProjectStatus
from app.schemas.common import BenefitOut, OfferOut
from app.schemas.organizer import (
    GapRowOut,
    GapsOut,
    OfferConflictOut,
    OfferListOut,
    ProjectReportOut,
    ReadinessCheckOut,
    ReadinessOut,
)
from app.services import loaders
from app.services.views import fmt_number, need_phrase

BOOKABLE = (NeedType.equipment, NeedType.space)
MAX_SPONSORS = 5  # rule 5: requests go to at most 5 different sponsors per project


def _plural(n: int, word: str) -> str:
    return f"{n} {word}{'' if n == 1 else 's'}"


def _held_offers(db: Session, need_ids: list[uuid.UUID]) -> dict[uuid.UUID, Offer]:
    return loaders.holding_offers(db, need_ids)


def open_and_total(db: Session, project_ids: list[uuid.UUID]) -> dict[uuid.UUID, tuple[int, int]]:
    """(open needs, all needs) per project, for the dashboard: one query."""
    needs, holds = loaders.needs_and_holds(db, project_ids)
    return {pid: (sum(1 for n in ns if n.id not in holds), len(ns)) for pid, ns in needs.items()}


def gaps(db: Session, project: Project) -> GapsOut:
    needs = loaders.needs_and_holds(db, [project.id])[0].get(project.id, [])
    ids = [n.id for n in needs]
    held = _held_offers(db, ids)
    names = loaders.names(db, (o.from_user_id for o in held.values()))
    requests = (
        dict(
            db.execute(
                select(SponsorRequest.need_id, func.count())
                .where(SponsorRequest.need_id.in_(ids))
                .group_by(SponsorRequest.need_id)
            ).all()
        )
        if ids
        else {}
    )
    waiting: dict[uuid.UUID, list[Offer]] = defaultdict(list)
    if ids:
        for o in db.scalars(select(Offer).where(Offer.need_id.in_(ids), Offer.stage == OfferStage.offered)):
            waiting[o.need_id].append(o)

    rows = []
    for n in needs:
        hold = held.get(n.id)
        note = None
        if hold is None:
            helpers = sum(1 for o in waiting[n.id] if o.contribution_role)
            if helpers:
                note = f"{_plural(helpers, 'contributor')} pending"
            elif waiting[n.id]:
                note = f"{_plural(len(waiting[n.id]), 'offer')} to review"
            elif requests.get(n.id):
                note = f"{_plural(requests[n.id], 'request')} sent"
            else:
                note = "No requests yet"
        rows.append(
            GapRowOut(
                need_id=n.id,
                title=n.title,
                type=n.type.value,
                quantity=n.quantity,
                unit=n.unit,
                state="open" if hold is None else ("received" if hold.stage == OfferStage.received else "covered"),
                booked=hold is not None and n.type in BOOKABLE,
                covered_by=names.get(hold.from_user_id, "Someone") if hold else None,
                note=note,
            )
        )
    still = [need_phrase(n) for n in needs if n.id not in held]
    if not still:
        summary = "Every need is covered."
    elif len(still) == 1:
        summary = f"Still needed: {still[0]}."
    else:
        summary = f"Still needed: {', '.join(still[:-1])} and {still[-1]}."
    return GapsOut(needs=rows, summary=summary)


def readiness(db: Session, project: Project) -> ReadinessOut:
    needs = loaders.needs_and_holds(db, [project.id])[0].get(project.id, [])
    held = _held_offers(db, [n.id for n in needs])
    received = sum(1 for o in held.values() if o.stage == OfferStage.received)
    slots_ok = all(not n.slot_start or not n.slot_end or n.slot_end > n.slot_start for n in needs)
    open_time = any(n.type in (NeedType.time, NeedType.skill) and n.id not in held for n in needs)
    total, covered = len(needs), len(held)
    complete = project.status == ProjectStatus.complete
    checks = [
        ReadinessCheckOut(
            key="plan",
            label="Plan works",
            ok=total > 0 and slots_ok,
            value="Passed" if total and slots_ok else "Check needs",
            detail=("Times and capacity fit" if slots_ok else "A time slot ends before it starts")
            if total
            else "Add at least one need",
        ),
        ReadinessCheckOut(
            key="commitments",
            label="Commitments covered",
            ok=total > 0 and covered == total,
            value=f"{covered} of {total}",
            detail="Every need is covered" if covered == total else f"{_plural(total - covered, 'need')} still open",
        ),
        ReadinessCheckOut(
            key="items",
            label="Items received",
            ok=covered > 0 and received == covered,
            value=f"{received} of {covered}",
            detail=("Everything accepted has arrived" if covered else "Nothing accepted yet")
            if received == covered
            else f"{covered - received} awaiting delivery",
        ),
        ReadinessCheckOut(
            key="activity",
            label="Activity confirmed",
            ok=complete,
            value="Yes" if complete else "Not yet",
            detail="Project completed"
            if complete
            else ("Book volunteers first" if open_time else "Complete after everything arrives"),
        ),
    ]
    can_complete = project.status == ProjectStatus.live and covered > 0 and received == covered
    return ReadinessOut(checks=checks, can_complete=can_complete)


def report(db: Session, project: Project) -> ProjectReportOut:
    """Totals only: no names, emails, ages or phone numbers (rule 12)."""
    needs = loaders.needs_and_holds(db, [project.id])[0].get(project.id, [])
    held = _held_offers(db, [n.id for n in needs])
    got = [(n, held[n.id]) for n in needs if n.id in held and held[n.id].stage == OfferStage.received]
    people = db.scalar(
        select(func.count())
        .select_from(EventMembership)
        .where(EventMembership.project_id == project.id, EventMembership.status == MembershipStatus.approved)
    )

    def item_text(n: Need) -> str:
        title = n.title.lower()
        return f"{fmt_number(n.quantity)} {n.unit}" + ("" if n.unit.lower() == title else f" {title}")

    return ProjectReportOut(
        people_taking_part=people or 0,
        sessions_held=1 if project.status == ProjectStatus.complete else 0,
        money_received=sum((o.amount or 0) for _, o in got),
        items_received=[item_text(n) for n, _ in got if n.type != NeedType.money],
        needs_total=len(needs),
        needs_received=len(got),
    )


def offers_out(db: Session, offers: list[Offer]) -> list[OfferOut]:
    """Offers as the screens show them, in 5 queries for any number of offers."""
    if not offers:
        return []
    ids = [o.id for o in offers]
    needs = {n.id: n for n in db.scalars(select(Need).where(Need.id.in_({o.need_id for o in offers})))}
    members = {m.offer_id: m for m in db.scalars(select(EventMembership).where(EventMembership.offer_id.in_(ids)))}
    pays = loaders.latest_payment_status(db, ids)
    benefits: dict[uuid.UUID, list[Benefit]] = defaultdict(list)
    for b in db.scalars(select(Benefit).where(Benefit.offer_id.in_(ids)).order_by(Benefit.created_at)):
        benefits[b.offer_id].append(b)
    names = loaders.names(db, (o.from_user_id for o in offers))
    out = []
    for o in offers:
        n, m = needs[o.need_id], members.get(o.id)
        out.append(
            OfferOut(
                id=o.id,
                need_id=o.need_id,
                need_title=n.title,
                need_type=n.type.value,
                from_user_id=o.from_user_id,
                from_name=names.get(o.from_user_id, "Someone"),
                request_id=o.request_id,
                stage=o.stage.value,
                contribution_role=o.contribution_role.value if o.contribution_role else None,
                conditions=o.conditions,
                exclusive_category=o.exclusive_category,
                amount=o.amount,
                slot_start=o.slot_start,
                slot_end=o.slot_end,
                benefits=[BenefitOut.model_validate(b) for b in benefits[o.id]],
                membership_id=m.id if m else None,
                membership_status=m.status.value if m else None,
                payment_status=pays.get(o.id),
                created_at=o.created_at,
            )
        )
    return out


def conflicts(offers: list[Offer]) -> list[OfferConflictOut]:
    """Sponsor offers that clash: two want to be the only sponsor of a category, or two
    open offers for the same need (rule 2). Contributor applications never clash."""
    live = [o for o in offers if o.stage in (OfferStage.offered, OfferStage.accepted) and not o.contribution_role]
    out: list[OfferConflictOut] = []
    by_category: dict[str, list[Offer]] = defaultdict(list)
    for o in live:
        if o.exclusive_category:
            by_category[o.exclusive_category].append(o)
    for category, group in by_category.items():
        if len(group) > 1:
            out.append(
                OfferConflictOut(offer_ids=[o.id for o in group], reason=f"Both want to be the only {category} sponsor")
            )
    by_need: dict[uuid.UUID, list[Offer]] = defaultdict(list)
    for o in live:
        if o.stage == OfferStage.offered:
            by_need[o.need_id].append(o)
    for group in by_need.values():
        ids = [o.id for o in group]
        if len(group) > 1 and not any(set(ids) <= set(c.offer_ids) for c in out):
            out.append(OfferConflictOut(offer_ids=ids, reason="These offers are for the same need"))
    return out


def offer_list(db: Session, project: Project) -> OfferListOut:
    need_ids = select(Need.id).where(Need.project_id == project.id)
    offers = list(db.scalars(select(Offer).where(Offer.need_id.in_(need_ids)).order_by(Offer.created_at.desc())))
    return OfferListOut(offers=offers_out(db, offers), conflicts=conflicts(offers))


def requests_left(db: Session, project_id: uuid.UUID) -> int:
    used = db.scalar(
        select(func.count(func.distinct(SponsorRequest.sponsor_id))).where(SponsorRequest.project_id == project_id)
    )
    return max(0, MAX_SPONSORS - (used or 0))
