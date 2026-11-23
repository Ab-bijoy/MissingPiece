"""Payments (rules 9 and 10) and the payment gateway interface (build prompt 10).

The sponsor pays the offer amount plus 5% commission:
    commission = round(amount * 0.05, 2), gross = amount + commission, net = amount
Decimal only, never float. A failed payment leaves the offer accepted so the
sponsor can retry. A money offer becomes received only when its payment succeeds.
"""

import hashlib
import hmac
import uuid
from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal
from typing import Protocol

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.errors import ApiError, must, not_found
from app.models import AppUser, Need, Offer, Payment, Project, Receipt
from app.models.enums import NeedType, NotificationType, OfferStage, PaymentStatus
from app.schemas.sponsor import PaymentQuote, PaymentStart
from app.services.notifications import notify
from app.services.views import fmt_number, name_of

CENT = Decimal("0.01")


@dataclass(frozen=True)
class Amounts:
    amount: Decimal
    commission: Decimal
    total: Decimal


def split(amount: Decimal) -> Amounts:
    rate = get_settings().platform_commission_rate
    commission = (amount * rate).quantize(CENT, rounding=ROUND_HALF_UP)
    return Amounts(amount=amount, commission=commission, total=amount + commission)


# ---- Gateway interface ------------------------------------------------------------------


class PaymentGateway(Protocol):
    def checkout_url(self, payment: Payment, api_base: str) -> str: ...
    def verify(self, payment_id: str, status: str, amount: str, signature: str) -> bool: ...


def sign(payment_id: str, status: str, amount: str) -> str:
    secret = get_settings().payment_webhook_secret.encode()
    return hmac.new(secret, f"{payment_id}:{status}:{amount}".encode(), hashlib.sha256).hexdigest()


class MockGateway:
    """Fake gateway: a page in this API that lets you choose success or failure."""

    def checkout_url(self, payment: Payment, api_base: str) -> str:
        return f"{api_base.rstrip('/')}/api/payments/mock-checkout/{payment.id}"

    def verify(self, payment_id: str, status: str, amount: str, signature: str) -> bool:
        if get_settings().is_placeholder(get_settings().payment_webhook_secret):
            return False  # an example secret is public: anyone could sign with it
        return hmac.compare_digest(sign(payment_id, status, amount), signature)


def gateway() -> PaymentGateway:
    provider = get_settings().payment_provider
    if provider == "mock":
        return MockGateway()
    # DECISION (build prompt 10): a Bangladeshi gateway in sandbox mode goes here.
    raise ApiError(503, f"Payment provider '{provider}' is not set up yet.", "no_gateway")


# ---- Sponsor side --------------------------------------------------------------------


def _my_money_offer(db: Session, sponsor: AppUser, offer_id: uuid.UUID) -> tuple[Offer, Need, Project]:
    o = db.get(Offer, offer_id)
    if o is None or o.from_user_id != sponsor.id:
        raise not_found("Offer")
    n = must(db.get(Need, o.need_id), "Need")
    if n.type != NeedType.money or o.amount is None:
        raise ApiError(409, "Only money offers are paid.", "not_money")
    p = must(db.get(Project, n.project_id), "Project")
    return o, n, p


def quote(db: Session, sponsor: AppUser, offer_id: uuid.UUID) -> PaymentQuote:
    o, n, p = _my_money_offer(db, sponsor, offer_id)
    a = split(o.amount)  # type: ignore[arg-type]
    last = db.scalar(
        select(Payment.status).where(Payment.offer_id == o.id).order_by(Payment.created_at.desc()).limit(1)
    )
    return PaymentQuote(
        offer_id=o.id,
        project_name=p.name,
        organizer_name=name_of(db, p.organizer_id),
        need_title=n.title,
        amount=a.amount,
        commission=a.commission,
        total=a.total,
        last_payment_status=last.value if last else None,
    )


def start(db: Session, sponsor: AppUser, offer_id: uuid.UUID, api_base: str) -> PaymentStart:
    """POST /offers/{id}/payments: create a pending payment and return the checkout URL."""
    o, _, _ = _my_money_offer(db, sponsor, offer_id)
    if o.stage != OfferStage.accepted:
        raise ApiError(409, "You can pay only after the organizer accepts your offer.", "bad_stage")
    a = split(o.amount)  # type: ignore[arg-type]
    pay = Payment(offer_id=o.id, gross_amount=a.total, commission_amount=a.commission, net_amount=a.amount)
    db.add(pay)
    db.flush()
    url = gateway().checkout_url(pay, api_base)
    db.commit()
    return PaymentStart(payment_id=pay.id, checkout_url=url)


# ---- Gateway side ----------------------------------------------------------------------


def settle(db: Session, payment_id: uuid.UUID, succeeded: bool, gross: Decimal | None = None) -> Payment:
    """Mark a payment succeeded or failed. Repeated calls for a settled payment are ignored."""
    pay = db.scalar(select(Payment).where(Payment.id == payment_id).with_for_update())
    if pay is None:
        raise not_found("Payment")
    if pay.status != PaymentStatus.pending:
        return pay  # a repeated webhook: already handled
    if gross is not None and gross != pay.gross_amount:
        raise ApiError(400, "The paid amount does not match.", "amount_mismatch")

    o = must(db.scalar(select(Offer).where(Offer.id == pay.offer_id).with_for_update()), "Offer")
    n = must(db.get(Need, o.need_id), "Need")
    p = must(db.get(Project, n.project_id), "Project")

    if succeeded:
        pay.status = PaymentStatus.succeeded
        if o.stage == OfferStage.accepted:
            o.stage = OfferStage.received
            # Money is confirmed by the gateway; the receipt is recorded on the organizer's behalf.
            db.add(Receipt(offer_id=o.id, confirmed_by=p.organizer_id))
        notify(
            db,
            o.from_user_id,
            NotificationType.payment_succeeded,
            pay.id,
            f"Your payment of BDT {fmt_number(pay.gross_amount)} went through. Thank you!",
        )
        notify(
            db,
            p.organizer_id,
            NotificationType.item_received,
            o.id,
            f"{name_of(db, o.from_user_id)} paid BDT {fmt_number(pay.net_amount)} for {n.title}.",
        )
    else:
        pay.status = PaymentStatus.failed  # the offer stays accepted; the sponsor may retry
        notify(
            db,
            o.from_user_id,
            NotificationType.payment_failed,
            pay.id,
            "Your payment did not go through. Your offer is still accepted, so you can try again.",
        )
    db.commit()
    return pay
