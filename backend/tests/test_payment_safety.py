"""Payment safety: never charge twice, never keep money for an offer that is gone.

Found in testing (23 Nov 2026): a second payment could be started while the first
was pending, and both could succeed (charged twice); and an offer could be withdrawn
while its payment was in progress, and the payment still succeeded.
"""

from datetime import UTC, datetime, timedelta

from sqlalchemy import select

from app.models import Notification, Offer, Payment
from app.models.enums import NotificationType, OfferStage, PaymentStatus, UserRole
from app.services.payments import sign
from tests.conftest import auth


def accepted_offer(client, scene, f):
    o = client.post(f"/api/requests/{scene['request'].id}/offers", json={}, headers=auth(scene["sponsor"])).json()
    f.accept(o["id"])
    return o["id"]


def start(client, scene, offer_id):
    return client.post(f"/api/offers/{offer_id}/payments", json={}, headers=auth(scene["sponsor"]))


def gateway_says(client, payment_id, outcome, amount="21000.00"):
    pid = str(payment_id)
    return client.post(
        "/api/payments/webhook",
        json={"payment_id": pid, "status": outcome, "amount": amount, "signature": sign(pid, outcome, amount)},
    )


def age(db, payment_id, minutes):
    db.get(Payment, payment_id).created_at = datetime.now(UTC) - timedelta(minutes=minutes)
    db.flush()


def test_second_pay_click_continues_the_same_payment(client, scene, f, db):
    oid = accepted_offer(client, scene, f)
    first = start(client, scene, oid).json()
    second = start(client, scene, oid)
    assert second.status_code == 201 and second.json()["payment_id"] == first["payment_id"]
    assert len(db.scalars(select(Payment).where(Payment.offer_id == oid)).all()) == 1
    quote = client.get(f"/api/offers/{oid}/payment-quote", headers=auth(scene["sponsor"])).json()
    assert quote["payment_in_progress"] is True and quote["offer_stage"] == "accepted"


def test_paid_offer_cannot_be_paid_again(client, scene, f, db):
    oid = accepted_offer(client, scene, f)
    pid = start(client, scene, oid).json()["payment_id"]
    gateway_says(client, pid, "succeeded")
    again = start(client, scene, oid)
    assert again.status_code == 409 and again.json()["code"] == "already_paid"
    quote = client.get(f"/api/offers/{oid}/payment-quote", headers=auth(scene["sponsor"])).json()
    assert quote["offer_stage"] == "received" and quote["payment_in_progress"] is False


def test_a_second_payment_that_succeeds_is_flagged_for_refund(client, scene, f, db):
    """Even if two payments exist (an old abandoned one paid late), the sponsor is charged once."""
    admin = f.user(UserRole.admin, "Admin")
    oid = accepted_offer(client, scene, f)
    old = start(client, scene, oid).json()["payment_id"]
    age(db, old, 20)  # the sponsor closed the page; after 15 minutes they may start again
    new = start(client, scene, oid).json()["payment_id"]
    assert new != old and db.get(Payment, old).status == PaymentStatus.failed  # marked abandoned
    assert gateway_says(client, new, "succeeded").json()["status"] == "succeeded"
    # ...and then the abandoned page is paid after all
    assert gateway_says(client, old, "succeeded").json()["status"] == "refund_due"
    db.expire_all()
    statuses = sorted(p.status.value for p in db.scalars(select(Payment).where(Payment.offer_id == oid)))
    assert statuses == ["refund_due", "succeeded"]
    assert db.get(Offer, oid).stage == OfferStage.received
    told = db.scalars(
        select(Notification.user_id).where(Notification.type == NotificationType.payment_refund_due)
    ).all()
    assert scene["sponsor"].id in told and admin.id in told


def test_cannot_withdraw_while_paying(client, scene, f, db):
    oid = accepted_offer(client, scene, f)
    start(client, scene, oid)
    r = client.post(f"/api/offers/{oid}/withdraw", headers=auth(scene["sponsor"]))
    assert r.status_code == 409 and r.json()["code"] == "payment_in_progress"
    assert db.get(Offer, oid).stage == OfferStage.accepted


def test_money_arriving_after_withdrawal_is_refunded(client, scene, f, db):
    oid = accepted_offer(client, scene, f)
    pid = start(client, scene, oid).json()["payment_id"]
    age(db, pid, 20)  # page closed long ago, so withdrawing is allowed again
    assert client.post(f"/api/offers/{oid}/withdraw", headers=auth(scene["sponsor"])).status_code == 204
    assert gateway_says(client, pid, "succeeded").json()["status"] == "refund_due"
    db.expire_all()
    assert db.get(Offer, oid).stage == OfferStage.withdrawn


def test_admin_marks_refunds(client, scene, f, db):
    h = auth(f.user(UserRole.admin, "Admin"))
    oid = accepted_offer(client, scene, f)
    pid = start(client, scene, oid).json()["payment_id"]
    gateway_says(client, pid, "succeeded")
    r = client.post(f"/api/admin/payments/{pid}/refunded", headers=h)
    assert r.status_code == 409  # a normal payment is not refunded
    db.get(Payment, pid).status = PaymentStatus.refund_due
    db.flush()
    r = client.post(f"/api/admin/payments/{pid}/refunded", headers=h)
    assert r.status_code == 200 and r.json()["status"] == "refunded"
    # a payout is only for money that stays with the project
    assert client.post(f"/api/admin/payments/{pid}/payout", headers=h).status_code == 409
