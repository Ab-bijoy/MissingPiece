"""Read helpers that turn rows into the shapes the screens show."""

import uuid
from datetime import UTC, datetime
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.errors import must
from app.models import AppUser, Benefit, EventMembership, Need, Offer, Payment, Project, Template
from app.models.enums import MembershipRole, MembershipStatus, NeedType, OfferStage
from app.schemas.common import BenefitOut, EventFacts, OfferOut

HOLDING = (OfferStage.accepted, OfferStage.received)


def today():
    """Event dates are calendar dates; compare with today's date in UTC."""
    return datetime.now(UTC).date()


def fmt_number(n: Decimal) -> str:
    """20000 -> '20,000'; 2.5 -> '2.5'."""
    return f"{n:,.0f}" if n == n.to_integral_value() else f"{n:,.2f}".rstrip("0").rstrip(".")


def qty_text(need: Need) -> str:
    """'BDT 20,000', '200 packs', '1 projector'."""
    if need.type == NeedType.money:
        return f"BDT {fmt_number(need.quantity)}"
    return f"{fmt_number(need.quantity)} {need.unit}"


def name_of(db: Session, user_id: uuid.UUID) -> str:
    return db.scalar(select(AppUser.name).where(AppUser.id == user_id)) or "Someone"


def holding_offer(db: Session, need_id: uuid.UUID) -> Offer | None:
    """The accepted or received offer that covers a need, if any."""
    return db.scalar(select(Offer).where(Offer.need_id == need_id, Offer.stage.in_(HOLDING)))


def event_facts(db: Session, p: Project) -> EventFacts:
    counts = dict(
        db.execute(
            select(EventMembership.role, func.count())
            .where(EventMembership.project_id == p.id, EventMembership.status == MembershipStatus.approved)
            .group_by(EventMembership.role)
        ).all()
    )
    project_type = (
        db.scalar(select(Template.project_type).where(Template.id == p.template_id)) if p.template_id else None
    )
    return EventFacts(
        id=p.id,
        name=p.name,
        project_type=project_type,
        organizer_name=name_of(db, p.organizer_id),
        institution=p.institution,
        event_date=p.event_date,
        venue=p.venue,
        audience=p.audience,
        status=p.status.value,
        participants=counts.get(MembershipRole.participant, 0),
        contributors=counts.get(MembershipRole.contributor, 0),
    )


def offer_out(db: Session, o: Offer) -> OfferOut:
    need = must(db.get(Need, o.need_id), "Need")
    m = db.scalar(select(EventMembership).where(EventMembership.offer_id == o.id))
    pay_status = db.scalar(
        select(Payment.status).where(Payment.offer_id == o.id).order_by(Payment.created_at.desc()).limit(1)
    )
    benefits = db.scalars(select(Benefit).where(Benefit.offer_id == o.id).order_by(Benefit.created_at)).all()
    return OfferOut(
        id=o.id,
        need_id=o.need_id,
        need_title=need.title,
        need_type=need.type.value,
        from_user_id=o.from_user_id,
        from_name=name_of(db, o.from_user_id),
        request_id=o.request_id,
        stage=o.stage.value,
        contribution_role=o.contribution_role.value if o.contribution_role else None,
        conditions=o.conditions,
        exclusive_category=o.exclusive_category,
        amount=o.amount,
        slot_start=o.slot_start,
        slot_end=o.slot_end,
        benefits=[BenefitOut.model_validate(b) for b in benefits],
        membership_id=m.id if m else None,
        membership_status=m.status.value if m else None,
        payment_status=pay_status.value if pay_status else None,
        created_at=o.created_at,
    )
