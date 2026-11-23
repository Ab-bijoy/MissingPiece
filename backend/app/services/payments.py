"""Payments (rules 9 and 10) and the payment gateway interface (build prompt 10).

The sponsor pays the offer amount plus 5% commission:
    commission = round(amount * 0.05, 2), gross = amount + commission, net = amount
Decimal only, never float. A failed payment leaves the offer accepted so the
sponsor can retry. A money offer becomes received only when its payment succeeds.
"""

import hashlib
import hmac
import logging
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
from app.services.sslcommerz import NOT_PAID, PAID, CheckoutInfo, SslCommerzGateway
from app.services.views import fmt_number, name_of

log = logging.getLogger("app.payments")

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
    def checkout_url(self, payment: Payment, api_base: str, info: CheckoutInfo) -> str: ...
    def verify(self, payment_id: str, status: str, amount: str, signature: str) -> bool: ...


def sign(payment_id: str, status: str, amount: str) -> str:
    secret = get_settings().payment_webhook_secret.encode()
    return hmac.new(secret, f"{payment_id}:{status}:{amount}".encode(), hashlib.sha256).hexdigest()


class MockGateway:
    """Fake gateway: a page in this API that lets you choose success or failure."""

    def checkout_url(self, payment: Payment, api_base: str, info: CheckoutInfo) -> str:
        return f"{api_base.rstrip('/')}/api/payments/mock-checkout/{payment.id}"

    def verify(self, payment_id: str, status: str, amount: str, signature: str) -> bool:
        if get_settings().is_placeholder(get_settings().payment_webhook_secret):
            return False  # an example secret is public: anyone could sign with it
        return hmac.compare_digest(sign(payment_id, status, amount), signature)


def sslcommerz_gateway() -> SslCommerzGateway:
    s = get_settings()
    if not (s.sslcommerz_store_id and s.sslcommerz_store_password):
        raise ApiError(503, "SSLCommerz is not set up: fill in the store id and password.", "no_gateway")
    return SslCommerzGateway(s.sslcommerz_store_id, s.sslcommerz_store_password, s.sslcommerz_sandbox)


def gateway() -> PaymentGateway:
    provider = get_settings().payment_provider
    if provider == "mock":
        return MockGateway()
    if provider == "sslcommerz":
        return sslcommerz_gateway()
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
    o, n, p = _my_money_offer(db, sponsor, offer_id)
    if o.stage != OfferStage.accepted:
        raise ApiError(409, "You can pay only after the organizer accepts your offer.", "bad_stage")
    a = split(o.amount)  # type: ignore[arg-type]
    pay = Payment(offer_id=o.id, gross_amount=a.total, commission_amount=a.commission, net_amount=a.amount)
    db.add(pay)
    db.flush()
    profile = sponsor.sponsor_profile
    info = CheckoutInfo(
        customer_name=(profile.contact_person if profile else "") or sponsor.name,
        customer_email=sponsor.email,
        customer_phone=profile.phone if profile else "",
        customer_address=(profile.location or "") if profile else "",
        product_name=f"{n.title} for {p.name}",
    )
    base = get_settings().api_public_url or api_base
    url = gateway().checkout_url(pay, base, info)
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


def confirm_sslcommerz(db: Session, tran_id: str, val_id: str | None) -> Payment:
    """Called by the SSLCommerz success, fail, cancel and IPN addresses.

    Nothing in the callback is trusted: the answer comes from SSLCommerz's own APIs,
    checked against our tran_id, the currency and the exact amount we asked for.
    """
    pay = db.scalar(select(Payment).where(Payment.gateway_ref == tran_id))
    if pay is None:
        raise not_found("Payment")
    if pay.status != PaymentStatus.pending:
        return pay  # already settled (the browser and the IPN both arrive)

    gw = sslcommerz_gateway()
    if val_id:
        answers = [gw.validate(val_id)]
    else:
        answers = gw.lookup(tran_id)

    def matches(a: dict) -> bool:
        return str(a.get("tran_id") or "") == tran_id

    paid = [a for a in answers if matches(a) and str(a.get("status") or "").upper() in PAID]
    if paid:
        a = paid[0]
        currency = str(a.get("currency_type") or a.get("currency") or "").upper()
        try:
            amount = Decimal(str(a.get("currency_amount") or a.get("amount") or ""))
        except ArithmeticError:
            amount = None
        if currency != "BDT" or amount != pay.gross_amount:
            # Paid, but not what we asked for: leave it pending for an admin to look at.
            log.warning("SSLCommerz amount mismatch on %s: %s %s", tran_id, currency, amount)
            raise ApiError(400, "The paid amount does not match.", "amount_mismatch")
        return settle(db, pay.id, True, pay.gross_amount)

    if any(matches(a) and str(a.get("status") or "").upper() in NOT_PAID for a in answers):
        return settle(db, pay.id, False)
    return pay  # SSLCommerz has no final answer yet: stays pending
