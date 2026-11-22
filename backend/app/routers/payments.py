"""Payment gateway callbacks (build prompt 7.6) and the mock gateway page (section 10)."""

import html
import uuid
from decimal import Decimal, InvalidOperation

from fastapi import APIRouter, Form
from fastapi.responses import HTMLResponse, RedirectResponse
from pydantic import BaseModel
from sqlalchemy import select

from app.auth import DB
from app.config import get_settings
from app.errors import ApiError, not_found
from app.models import Need, Offer, Payment, Project
from app.models.enums import PaymentStatus
from app.services import payments
from app.services.views import fmt_number

router = APIRouter(prefix="/api/payments", tags=["payments"])


class WebhookIn(BaseModel):
    payment_id: uuid.UUID
    status: str  # "succeeded" or "failed"
    amount: str  # gross amount as text, e.g. "21000.00"
    signature: str


@router.post("/webhook")
def webhook(body: WebhookIn, db: DB) -> dict[str, str]:
    """Gateway only: verify the signature and the amount, then settle the payment."""
    if body.status not in ("succeeded", "failed"):
        raise ApiError(422, "Unknown status.", "validation")
    if not payments.gateway().verify(str(body.payment_id), body.status, body.amount, body.signature):
        raise ApiError(401, "Bad signature.", "bad_signature")
    try:
        gross = Decimal(body.amount)
    except InvalidOperation:
        raise ApiError(422, "Bad amount.", "validation") from None
    pay = payments.settle(db, body.payment_id, body.status == "succeeded", gross)
    return {"status": pay.status.value}


# ---- Mock gateway (PAYMENT_PROVIDER=mock only) -----------------------------------------


def _mock_only() -> None:
    if get_settings().payment_provider != "mock":
        raise not_found("Page")


@router.get("/mock-checkout/{payment_id}", response_class=HTMLResponse, include_in_schema=False)
def mock_checkout(payment_id: uuid.UUID, db: DB) -> str:
    """A stand-in for the gateway's secure page: choose success or failure."""
    _mock_only()
    pay = db.get(Payment, payment_id)
    if pay is None:
        raise not_found("Payment")
    o = db.get(Offer, pay.offer_id)
    n = db.get(Need, o.need_id) if o else None
    p = db.get(Project, n.project_id) if n else None
    what = html.escape(f"{n.title} for {p.name}") if n and p else "Payment"
    amount = f"{pay.gross_amount:.2f}"
    settled = pay.status != PaymentStatus.pending

    def button(status: str, label: str, primary: bool) -> str:
        sig = payments.sign(str(pay.id), status, amount)
        style = (
            "background:#0E5E52;color:#fff;border:0"
            if primary
            else "background:#fff;color:#1B1F24;border:1px solid #C9C3B6"
        )
        return (
            f'<form method="post" action="/api/payments/mock-checkout/{pay.id}">'
            f'<input type="hidden" name="status" value="{status}"><input type="hidden" name="amount" value="{amount}">'
            f'<input type="hidden" name="signature" value="{sig}">'
            f'<button style="width:100%;min-height:56px;border-radius:10px;font:700 18px system-ui;{style};cursor:pointer">'
            f"{label}</button></form>"
        )

    body = (
        f"<p>This payment is already <strong>{pay.status.value}</strong>.</p>"
        if settled
        else button("succeeded", "Payment succeeds", True) + button("failed", "Payment fails", False)
    )
    return f"""<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Demo payment gateway</title></head>
<body style="margin:0;background:#F6F4EF;font:17px/1.5 system-ui;color:#1B1F24">
<main style="max-width:520px;margin:48px auto;padding:32px;background:#fff;border:2px dashed #508B8B;border-radius:16px;display:grid;gap:14px">
<p style="margin:0;font-weight:700;color:#31565A">Demo payment gateway</p>
<h1 style="margin:0;font-size:28px">Pay BDT {fmt_number(pay.gross_amount)}</h1>
<p style="margin:0;color:#4A5259">{what}. BDT {fmt_number(pay.net_amount)} goes to the project and
BDT {fmt_number(pay.commission_amount)} to MissingPiece.</p>
{body}</main></body></html>"""


@router.post("/mock-checkout/{payment_id}", include_in_schema=False)
def mock_checkout_submit(
    payment_id: uuid.UUID, db: DB, status: str = Form(), amount: str = Form(), signature: str = Form()
) -> RedirectResponse:
    """Sends the same signed callback a real gateway would, then returns the sponsor to the app."""
    _mock_only()
    webhook(WebhookIn(payment_id=payment_id, status=status, amount=amount, signature=signature), db)
    pay = db.scalar(select(Payment).where(Payment.id == payment_id))
    result = pay.status.value if pay else status
    return RedirectResponse(
        f"{get_settings().frontend_url.rstrip('/')}/sponsor/offers?payment={result}", status_code=303
    )
