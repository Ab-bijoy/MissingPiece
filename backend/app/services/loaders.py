"""Batch loaders: fetch what a whole page needs in a few queries, not a few per row.

The database is reached over the network, so every query costs a round trip
(about 0.2 s from a development PC). Looping "for each program, query its needs,
then for each need query its offer" multiplies that cost by the number of rows.
Each helper here takes a list of ids and answers for all of them in one query,
returning a dict the caller looks rows up in.

Rule of thumb for new list endpoints: load the page's rows, collect their ids,
call these helpers once, then build the response in plain Python.
"""

import uuid
from collections import defaultdict
from collections.abc import Iterable

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import AppUser, Benefit, Comment, EventMembership, Need, Offer, Payment, Project, Template
from app.models.enums import CommentStatus, MembershipRole, MembershipStatus, OfferStage
from app.schemas.common import EventFacts

HOLDING = (OfferStage.accepted, OfferStage.received)
# A membership whose offer ended in one of these no longer counts as "joined"
ENDED = (OfferStage.withdrawn, OfferStage.expired, OfferStage.declined)


def _ids(values: Iterable[uuid.UUID | None]) -> list[uuid.UUID]:
    return list({v for v in values if v is not None})


def names(db: Session, user_ids: Iterable[uuid.UUID | None]) -> dict[uuid.UUID, str]:
    """Display names; look up with .get(id, "Someone")."""
    ids = _ids(user_ids)
    if not ids:
        return {}
    return dict(db.execute(select(AppUser.id, AppUser.name).where(AppUser.id.in_(ids))).all())


def needs_by_project(db: Session, project_ids: list[uuid.UUID]) -> dict[uuid.UUID, list[Need]]:
    out: dict[uuid.UUID, list[Need]] = defaultdict(list)
    if project_ids:
        rows = db.scalars(select(Need).where(Need.project_id.in_(project_ids)).order_by(Need.created_at, Need.id)).all()
        for n in rows:
            out[n.project_id].append(n)
    return out


def holding_offers(db: Session, need_ids: Iterable[uuid.UUID]) -> dict[uuid.UUID, Offer]:
    """The accepted or received offer covering each need, for the needs that have one."""
    ids = _ids(need_ids)
    if not ids:
        return {}
    out: dict[uuid.UUID, Offer] = {}
    rows = db.scalars(
        select(Offer).where(Offer.need_id.in_(ids), Offer.stage.in_(HOLDING)).order_by(Offer.created_at)
    ).all()
    for o in rows:
        out.setdefault(o.need_id, o)
    return out


def member_counts(db: Session, project_ids: list[uuid.UUID]) -> dict[uuid.UUID, dict[MembershipRole, int]]:
    """Approved participants and contributors per program."""
    out: dict[uuid.UUID, dict[MembershipRole, int]] = defaultdict(dict)
    if project_ids:
        rows = db.execute(
            select(EventMembership.project_id, EventMembership.role, func.count())
            .where(EventMembership.project_id.in_(project_ids), EventMembership.status == MembershipStatus.approved)
            .group_by(EventMembership.project_id, EventMembership.role)
        ).all()
        for pid, role, count in rows:
            out[pid][role] = count
    return out


def template_types(db: Session, projects: Iterable[Project]) -> dict[uuid.UUID, str]:
    ids = _ids(p.template_id for p in projects)
    if not ids:
        return {}
    return dict(db.execute(select(Template.id, Template.project_type).where(Template.id.in_(ids))).all())


def event_facts_many(
    db: Session, projects: list[Project], known_names: dict | None = None
) -> dict[uuid.UUID, EventFacts]:
    """EventFacts for every program in 2-3 queries. Pass `known_names` to reuse names already loaded."""
    pids = [p.id for p in projects]
    counts = member_counts(db, pids)
    types = template_types(db, projects)
    nm = known_names if known_names is not None else {}
    missing = [p.organizer_id for p in projects if p.organizer_id not in nm]
    if missing:
        nm = {**nm, **names(db, missing)}
    return {p.id: build_facts(p, counts.get(p.id, {}), types, nm) for p in projects}


def build_facts(p: Project, counts: dict, types: dict, nm: dict) -> EventFacts:
    return EventFacts(
        id=p.id,
        name=p.name,
        project_type=types.get(p.template_id) if p.template_id else None,
        organizer_name=nm.get(p.organizer_id, "Someone"),
        institution=p.institution,
        event_date=p.event_date,
        venue=p.venue,
        audience=p.audience,
        status=p.status.value,
        participants=counts.get(MembershipRole.participant, 0),
        contributors=counts.get(MembershipRole.contributor, 0),
    )


def visible_comment_counts(db: Session, project_ids: list[uuid.UUID]) -> dict[uuid.UUID, int]:
    if not project_ids:
        return {}
    return dict(
        db.execute(
            select(Comment.project_id, func.count())
            .where(Comment.project_id.in_(project_ids), Comment.status == CommentStatus.visible)
            .group_by(Comment.project_id)
        ).all()
    )


def my_memberships(db: Session, project_ids: list[uuid.UUID], user: AppUser | None) -> dict[uuid.UUID, dict]:
    """The viewer's membership per program as {"membership": {...} | None, "offer_id": ...}.

    A membership whose contribution offer was withdrawn, declined or expired counts
    as not joined (the person may apply again).
    """
    if user is None or not project_ids:
        return {}
    rows = db.scalars(
        select(EventMembership).where(EventMembership.project_id.in_(project_ids), EventMembership.user_id == user.id)
    ).all()
    stages = {}
    offer_ids = _ids(m.offer_id for m in rows)
    if offer_ids:
        stages = dict(db.execute(select(Offer.id, Offer.stage).where(Offer.id.in_(offer_ids))).all())
    out = {}
    for m in rows:
        if m.offer_id and stages.get(m.offer_id) in ENDED:
            continue
        out[m.project_id] = {"membership": {"id": m.id, "role": m.role, "status": m.status}, "offer_id": m.offer_id}
    return out


def community_fields_many(
    db: Session, projects: list[Project], user: AppUser | None, facts: dict[uuid.UUID, EventFacts]
) -> dict[uuid.UUID, dict]:
    pids = [p.id for p in projects]
    mine = my_memberships(db, pids, user)
    counts = visible_comment_counts(db, pids)
    out = {}
    for p in projects:
        m = mine.get(p.id)
        out[p.id] = {
            "my_membership": m["membership"] if m else None,
            "my_offer_id": m["offer_id"] if m else None,
            "comment_count": counts.get(p.id, 0),
            "seats_left": max(0, p.audience - facts[p.id].participants),
        }
    return out


def comment_previews(db: Session, project_ids: list[uuid.UUID]) -> tuple[list[Comment], dict[uuid.UUID, Comment]]:
    """The two newest visible top-level comments per program, and the first visible reply to each.

    Two queries for any number of programs (window functions pick the top rows per group).
    """
    if not project_ids:
        return [], {}
    rank = (
        func.row_number()
        .over(partition_by=Comment.project_id, order_by=(Comment.created_at.desc(), Comment.id))
        .label("rank")
    )
    top = (
        select(Comment.id, rank)
        .where(
            Comment.project_id.in_(project_ids),
            Comment.status == CommentStatus.visible,
            Comment.parent_id.is_(None),
        )
        .subquery()
    )
    roots = db.scalars(
        select(Comment)
        .join(top, top.c.id == Comment.id)
        .where(top.c.rank <= 2)
        .order_by(Comment.project_id, top.c.rank)
    ).all()
    if not roots:
        return [], {}
    first = (
        func.row_number().over(partition_by=Comment.parent_id, order_by=(Comment.created_at, Comment.id)).label("rank")
    )
    earliest = (
        select(Comment.id, first)
        .where(Comment.parent_id.in_([c.id for c in roots]), Comment.status == CommentStatus.visible)
        .subquery()
    )
    replies = db.scalars(select(Comment).join(earliest, earliest.c.id == Comment.id).where(earliest.c.rank == 1)).all()
    return list(roots), {r.parent_id: r for r in replies}


def comment_dict(c: Comment, nm: dict[uuid.UUID, str], organizer_id: uuid.UUID) -> dict:
    return {
        "id": c.id,
        "project_id": c.project_id,
        "user_id": c.user_id,
        "author_name": nm.get(c.user_id, "Someone"),
        "is_organizer": c.user_id == organizer_id,
        "parent_id": c.parent_id,
        "kind": c.kind,
        "body": c.body,
        "status": c.status,
        "created_at": c.created_at,
    }


def latest_payment_status(db: Session, offer_ids: Iterable[uuid.UUID]) -> dict[uuid.UUID, str]:
    """Status of each offer's most recent payment attempt."""
    ids = _ids(offer_ids)
    if not ids:
        return {}
    rank = func.row_number().over(partition_by=Payment.offer_id, order_by=Payment.created_at.desc()).label("rank")
    sub = select(Payment.offer_id, Payment.status, rank).where(Payment.offer_id.in_(ids)).subquery()
    rows = db.execute(select(sub.c.offer_id, sub.c.status).where(sub.c.rank == 1)).all()
    return {oid: getattr(status, "value", status) for oid, status in rows}


def benefit_flags(db: Session, offer_ids: Iterable[uuid.UUID]) -> dict[uuid.UUID, list[bool]]:
    """The `given` flag of every benefit, per offer."""
    ids = _ids(offer_ids)
    out: dict[uuid.UUID, list[bool]] = defaultdict(list)
    if ids:
        for oid, given in db.execute(select(Benefit.offer_id, Benefit.given).where(Benefit.offer_id.in_(ids))):
            out[oid].append(given)
    return out
