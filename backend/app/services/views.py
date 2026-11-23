"""Read helpers that turn rows into the shapes the screens show."""

import uuid
from datetime import UTC, datetime
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.errors import must
from app.models import AppUser, Benefit, EventMembership, Need, Offer, Payment, Project
from app.models.enums import NeedType, OfferStage
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


def _stem(word: str) -> str:
    w = word.lower().strip()
    return w[:-1] if w.endswith("s") else w


def need_phrase(need: Need) -> str:
    """What is still needed, without saying the same thing twice.

    '200 packs for snacks', 'BDT 20,000 for prize fund', '1 hall for venue', but
    '3 trainers' (not '3 trainers for trainers') and '1 qa trainer' (not
    '1 trainer for qa trainer') when the title already names the unit.
    """
    title = need.title.strip().lower()
    if need.type == NeedType.money:
        return f"{qty_text(need)} for {title}"
    words = title.split()
    if words and _stem(words[-1]) == _stem(need.unit):
        # The title ends with the unit: say the number and the title
        last = need.unit.lower() if len(words) == 1 else words[-1]
        return f"{fmt_number(need.quantity)} {' '.join([*words[:-1], last])}"
    return f"{qty_text(need)} for {title}"


def name_of(db: Session, user_id: uuid.UUID) -> str:
    return db.scalar(select(AppUser.name).where(AppUser.id == user_id)) or "Someone"


def holding_offer(db: Session, need_id: uuid.UUID) -> Offer | None:
    """The accepted or received offer that covers a need, if any."""
    return db.scalar(select(Offer).where(Offer.need_id == need_id, Offer.stage.in_(HOLDING)))


def event_facts(db: Session, p: Project) -> EventFacts:
    """One program's facts. For lists use loaders.event_facts_many (same queries for all rows)."""
    from app.services.loaders import event_facts_many

    return event_facts_many(db, [p])[p.id]


def offer_out(db: Session, o: Offer) -> OfferOut:
    need = must(db.get(Need, o.need_id), "Need")  # usually already loaded: no query
    # One round trip for the membership, the last payment and the sender's name
    member_id, member_status, pay_status, from_name = db.execute(
        select(
            select(EventMembership.id).where(EventMembership.offer_id == o.id).scalar_subquery(),
            select(EventMembership.status).where(EventMembership.offer_id == o.id).scalar_subquery(),
            select(Payment.status)
            .where(Payment.offer_id == o.id)
            .order_by(Payment.created_at.desc())
            .limit(1)
            .scalar_subquery(),
            select(AppUser.name).where(AppUser.id == o.from_user_id).scalar_subquery(),
        )
    ).one()
    benefits = db.scalars(select(Benefit).where(Benefit.offer_id == o.id).order_by(Benefit.created_at)).all()
    return OfferOut(
        id=o.id,
        need_id=o.need_id,
        need_title=need.title,
        need_type=need.type.value,
        from_user_id=o.from_user_id,
        from_name=from_name or "Someone",
        request_id=o.request_id,
        stage=o.stage.value,
        contribution_role=o.contribution_role.value if o.contribution_role else None,
        conditions=o.conditions,
        exclusive_category=o.exclusive_category,
        amount=o.amount,
        slot_start=o.slot_start,
        slot_end=o.slot_end,
        benefits=[BenefitOut.model_validate(b) for b in benefits],
        membership_id=member_id,
        membership_status=getattr(member_status, "value", member_status),
        payment_status=getattr(pay_status, "value", pay_status),
        created_at=o.created_at,
    )
