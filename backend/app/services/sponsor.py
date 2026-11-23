"""Sponsor business rules (build prompt 7.4 and section 6)."""

import uuid

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.errors import ApiError, forbidden, must, not_found
from app.models import (
    AppUser,
    Benefit,
    MessageThread,
    Need,
    Offer,
    Project,
    Receipt,
    SponsorProfile,
    SponsorRequest,
)
from app.models.enums import NeedType, NotificationType, OfferStage, ProjectStatus
from app.schemas.common import BenefitOut, NeedOut
from app.schemas.sponsor import (
    Contribution,
    OfferIn,
    ReportResults,
    RequestState,
    SponsorOfferRow,
    SponsorProfileIn,
    SponsorProfileOut,
    SponsorReport,
    SponsorRequestDetail,
    SponsorRequestSummary,
)
from app.services import loaders
from app.services.notifications import notify
from app.services.views import event_facts, holding_offer, offer_out, qty_text, today

ACTIVE_STAGES = (OfferStage.offered, OfferStage.accepted, OfferStage.received)
BOOKABLE = (NeedType.skill, NeedType.time, NeedType.equipment, NeedType.space)


def _my_request(db: Session, sponsor: AppUser, request_id: uuid.UUID) -> SponsorRequest:
    r = db.get(SponsorRequest, request_id)
    if r is None:
        raise not_found("Request")
    if r.sponsor_id != sponsor.id:
        raise forbidden("This request was not sent to you.")
    return r


def _latest_offers(db: Session, request_ids: list[uuid.UUID], sponsor: AppUser) -> dict[uuid.UUID, Offer]:
    """This sponsor's most recent offer per request, for many requests in one query."""
    if not request_ids:
        return {}
    rank = func.row_number().over(partition_by=Offer.request_id, order_by=Offer.created_at.desc()).label("rank")
    sub = select(Offer.id, rank).where(Offer.request_id.in_(request_ids), Offer.from_user_id == sponsor.id).subquery()
    rows = db.scalars(select(Offer).join(sub, sub.c.id == Offer.id).where(sub.c.rank == 1)).all()
    return {o.request_id: o for o in rows}


def _latest_offer(db: Session, r: SponsorRequest, sponsor: AppUser) -> Offer | None:
    return db.scalar(
        select(Offer)
        .where(Offer.request_id == r.id, Offer.from_user_id == sponsor.id)
        .order_by(Offer.created_at.desc())
        .limit(1)
    )


_UNSET = object()


def request_state(
    db: Session,
    r: SponsorRequest,
    sponsor: AppUser,
    project: Project,
    mine: Offer | None | object = _UNSET,
    hold: Offer | None | object = _UNSET,
) -> RequestState:
    """Where a request stands for this sponsor, in the words the inbox shows.

    `mine` and `hold` can be passed in when already loaded (the inbox loads them for all rows at once).
    """
    if mine is _UNSET:
        mine = _latest_offer(db, r, sponsor)
    if mine is not None:
        match mine.stage:
            case OfferStage.offered:
                return "offer_sent"
            case OfferStage.accepted:
                return "accepted"
            case OfferStage.received:
                return "received"
            case OfferStage.expired:
                return "expired"
    if hold is _UNSET:
        hold = holding_offer(db, r.need_id)
    if (hold and hold.from_user_id != sponsor.id) or (mine and mine.stage == OfferStage.declined):
        return "covered_by_other"
    if mine and mine.stage == OfferStage.withdrawn:
        return "withdrawn"
    if project.event_date < today():
        return "expired"
    return "new"


# ---- Inbox --------------------------------------------------------------------------


def inbox(db: Session, sponsor: AppUser, limit: int, offset: int) -> list[SponsorRequestSummary]:
    rows = db.execute(
        select(SponsorRequest, Need, Project)
        .join(Need, Need.id == SponsorRequest.need_id)
        .join(Project, Project.id == SponsorRequest.project_id)
        .where(SponsorRequest.sponsor_id == sponsor.id)
        .order_by(SponsorRequest.created_at.desc())
        .limit(limit)
        .offset(offset)
    ).all()
    # Two batch queries for the whole page instead of two per request
    latest = _latest_offers(db, [r.id for r, _, _ in rows], sponsor)
    holds = loaders.holding_offers(db, (r.need_id for r, _, _ in rows))
    return [
        SponsorRequestSummary(
            id=r.id,
            project_id=p.id,
            project_name=p.name,
            need_title=n.title,
            need_amount=qty_text(n),
            state=request_state(db, r, sponsor, p, mine=latest.get(r.id), hold=holds.get(r.need_id)),
            decide_by=r.decide_by,
            created_at=r.created_at,
        )
        for r, n, p in rows
    ]


def request_detail(db: Session, sponsor: AppUser, request_id: uuid.UUID) -> SponsorRequestDetail:
    r = _my_request(db, sponsor, request_id)
    p = must(db.get(Project, r.project_id), "Project")
    n = must(db.get(Need, r.need_id), "Need")
    mine = _latest_offer(db, r, sponsor)
    thread_id = db.scalar(select(MessageThread.id).where(MessageThread.request_id == r.id))
    return SponsorRequestDetail(
        id=r.id,
        project=event_facts(db, p),
        need=NeedOut.model_validate(n),
        benefits=list(r.benefits),
        conditions=r.conditions,
        exclusive_category=r.exclusive_category,
        decide_by=r.decide_by,
        deliver_by=r.deliver_by,
        state=request_state(db, r, sponsor, p),
        thread_id=thread_id,
        my_offer=offer_out(db, mine) if mine else None,
    )


def make_offer(db: Session, sponsor: AppUser, request_id: uuid.UUID, body: OfferIn):
    """POST /requests/{id}/offers: one offer covers one whole need; stage offered."""
    r = _my_request(db, sponsor, request_id)
    # Lock the need so two offers from the same sponsor cannot slip in together.
    n = must(db.scalar(select(Need).where(Need.id == r.need_id).with_for_update()), "Need")
    p = must(db.get(Project, r.project_id), "Project")

    if p.status != ProjectStatus.live:
        raise ApiError(409, "This project is not taking offers.", "project_not_live")
    if p.event_date < today():
        raise ApiError(409, "This event has already happened.", "expired")
    if holding_offer(db, n.id):
        raise ApiError(409, "This need is already covered by another offer.", "need_covered")
    if db.scalar(
        select(Offer.id).where(
            Offer.request_id == r.id, Offer.from_user_id == sponsor.id, Offer.stage.in_(ACTIVE_STAGES)
        )
    ):
        raise ApiError(409, "You already have an offer on this request.", "duplicate_offer")

    amount = None
    if n.type == NeedType.money:
        if body.amount is not None and body.amount != n.quantity:
            raise ApiError(422, f"One offer covers the whole need: {qty_text(n)}.", "partial_offer")
        amount = n.quantity

    o = Offer(
        need_id=n.id,
        from_user_id=sponsor.id,
        request_id=r.id,
        stage=OfferStage.offered,
        conditions=(body.conditions or "").strip() or None,
        exclusive_category=((body.exclusive_category or "").strip().lower() or None) or r.exclusive_category,
        amount=amount,
        resource=n.title.lower() if n.type in (NeedType.equipment, NeedType.space) else None,
        slot_start=n.slot_start if n.type in BOOKABLE else None,
        slot_end=n.slot_end if n.type in BOOKABLE else None,
    )
    db.add(o)
    db.flush()
    for label in r.benefits:
        db.add(Benefit(offer_id=o.id, label=str(label)))
    notify(
        db,
        p.organizer_id,
        NotificationType.offer_received,
        o.id,
        f"{sponsor.name} made an offer for {n.title} ({p.name}).",
    )
    db.commit()
    return offer_out(db, o)


# ---- My offers ------------------------------------------------------------------------


def my_offers(db: Session, sponsor: AppUser, limit: int, offset: int) -> list[SponsorOfferRow]:
    rows = db.execute(
        select(Offer, Need, Project)
        .join(Need, Need.id == Offer.need_id)
        .join(Project, Project.id == Need.project_id)
        .where(Offer.from_user_id == sponsor.id)
        .order_by(Offer.created_at.desc())
        .limit(limit)
        .offset(offset)
    ).all()
    ids = [o.id for o, _, _ in rows]
    flags = loaders.benefit_flags(db, ids)
    pays = loaders.latest_payment_status(db, ids)
    out = []
    for o, n, p in rows:
        benefits = flags.get(o.id, [])
        out.append(
            SponsorOfferRow(
                id=o.id,
                request_id=o.request_id,
                project_id=p.id,
                project_name=p.name,
                need_title=n.title,
                need_type=n.type.value,
                offer_text=f"BDT {o.amount:,.0f}" if o.amount else qty_text(n),
                amount=o.amount,
                stage=o.stage.value,
                benefits_given=sum(1 for g in benefits if g),
                benefits_total=len(benefits),
                payment_status=pays.get(o.id),
                project_status=p.status.value,
            )
        )
    return out


# ---- Impact report (rule 12: totals only) -------------------------------------------


def report(db: Session, sponsor: AppUser, project_id: uuid.UUID) -> SponsorReport:
    p = db.get(Project, project_id)
    if p is None:
        raise not_found("Event")
    row = db.execute(
        select(Offer, Need)
        .join(Need, Need.id == Offer.need_id)
        .where(Need.project_id == p.id, Offer.from_user_id == sponsor.id, Offer.stage == OfferStage.received)
        .order_by(Offer.created_at)
        .limit(1)
    ).first()
    if row is None:
        raise ApiError(403, "A report is available once something you gave has been received.", "no_received_offer")
    mine, need = row
    received_at = db.scalar(select(Receipt.received_at).where(Receipt.offer_id == mine.id))
    needs = db.scalars(select(Need).where(Need.project_id == p.id)).all()
    facts = event_facts(db, p)
    benefits = db.scalars(select(Benefit).where(Benefit.offer_id == mine.id).order_by(Benefit.created_at)).all()
    return SponsorReport(
        project=facts,
        contribution=Contribution(
            what=f"BDT {mine.amount:,.0f}" if mine.amount else qty_text(need),
            need_title=need.title,
            received_at=received_at,
        ),
        benefits=[BenefitOut.model_validate(b) for b in benefits],
        results=ReportResults(
            people_taking_part=facts.participants + facts.contributors,
            contributors=facts.contributors,
            sessions_held=1 if p.status == ProjectStatus.complete else 0,
            needs_covered=sum(1 for n in needs if holding_offer(db, n.id)),
            needs_total=len(needs),
        ),
        note=None,  # no thank-you note column yet
    )


# ---- Company profile (read by matching) ------------------------------------------


def _profile(db: Session, sponsor: AppUser) -> SponsorProfile:
    prof = db.scalar(select(SponsorProfile).where(SponsorProfile.user_id == sponsor.id))
    if prof is None:
        raise not_found("Company profile")
    return prof


def get_profile(db: Session, sponsor: AppUser) -> SponsorProfileOut:
    return SponsorProfileOut.model_validate(_profile(db, sponsor))


def update_profile(db: Session, sponsor: AppUser, body: SponsorProfileIn) -> SponsorProfileOut:
    prof = _profile(db, sponsor)
    data = body.model_dump(exclude_unset=True)
    for key, value in data.items():
        if key == "preferred_types" and value is not None:
            value = [NeedType(v).value for v in value]
        if isinstance(value, str):
            value = value.strip() or None if key in ("location", "description") else value.strip()
        setattr(prof, key, value)
    if "company" in data and prof.company:
        sponsor.name = prof.company
    db.commit()
    return SponsorProfileOut.model_validate(prof)
