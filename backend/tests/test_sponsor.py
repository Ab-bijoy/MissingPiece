"""Sponsor endpoints and the rules they enforce (build prompt 6, 7.4 and 13)."""

from sqlalchemy import select

from app.models import Booking, Need, Notification, Offer, Payment
from app.models.enums import AccountStatus, NeedStatus, NeedType, OfferStage, UserRole
from app.services.payments import sign
from tests.conftest import auth


def offer(client, scene, **body):
    return client.post(f"/api/requests/{scene['request'].id}/offers", json=body, headers=auth(scene["sponsor"]))


def test_inbox_and_detail(client, scene):
    h = auth(scene["sponsor"])
    inbox = client.get("/api/sponsor/requests", headers=h).json()
    assert [r["state"] for r in inbox] == ["new"]
    assert inbox[0]["need_amount"] == "BDT 20,000"
    d = client.get(f"/api/requests/{scene['request'].id}", headers=h).json()
    assert d["project"]["name"] == "Test Fest" and d["need"]["quantity"] == 20000
    assert d["thread_id"] and d["my_offer"] is None


def test_other_sponsor_cannot_see_request(client, scene, f):
    other = f.user(UserRole.sponsor, "Other Co.")
    r = client.get(f"/api/requests/{scene['request'].id}", headers=auth(other))
    assert r.status_code == 403 and r.json()["code"] == "forbidden"


def test_make_offer_covers_whole_need_and_notifies(client, scene, db):
    r = offer(client, scene, conditions="Name the prize after our academy.")
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["stage"] == "offered" and body["amount"] == 20000
    assert [b["label"] for b in body["benefits"]] == ["Logo on the main banner"]
    assert db.scalar(select(Notification).where(Notification.user_id == scene["org"].id)) is not None
    # A second offer on the same request is refused
    assert offer(client, scene).status_code == 409


def test_partial_money_offer_refused(client, scene):
    r = offer(client, scene, amount=5000)
    assert r.status_code == 422 and r.json()["code"] == "partial_offer"


def test_offer_refused_when_need_already_covered(client, scene, f):
    rival = f.user(UserRole.sponsor, "Rival Co.")
    rival_request = f.request(scene["project"], scene["need"], rival)
    first = client.post(f"/api/requests/{rival_request.id}/offers", json={}, headers=auth(rival)).json()
    f.accept(first["id"])
    r = offer(client, scene)
    assert r.status_code == 409 and r.json()["code"] == "need_covered"
    state = client.get("/api/sponsor/requests", headers=auth(scene["sponsor"])).json()[0]["state"]
    assert state == "covered_by_other"


def test_withdraw_accepted_reopens_need_and_removes_booking(client, f, db):
    """Build prompt test 5, first half."""
    org = f.user(UserRole.organizer, "Org")
    sponsor = f.user(UserRole.sponsor, "Sp")
    p = f.project(org)
    n = f.need(p, NeedType.equipment, 1, "projector")
    r = f.request(p, n, sponsor)
    o = client.post(f"/api/requests/{r.id}/offers", json={}, headers=auth(sponsor)).json()
    f.accept(o["id"])
    db.add(
        Booking(
            offer_id=o["id"],
            resource_key="item:x:projector",
            slot_start=p.created_at,
            slot_end=p.created_at.replace(year=p.created_at.year + 1),
        )
    )
    db.flush()

    assert client.post(f"/api/offers/{o['id']}/withdraw", headers=auth(sponsor)).status_code == 204
    db.expire_all()
    assert db.get(Need, n.id).status == NeedStatus.open
    assert db.get(Offer, o["id"]).stage == OfferStage.withdrawn
    assert db.scalar(select(Booking).where(Booking.offer_id == o["id"])) is None


def test_withdraw_after_received_refused(client, scene, f, db):
    """Build prompt test 5, second half."""
    o = offer(client, scene).json()
    db.get(Offer, o["id"]).stage = OfferStage.received
    db.flush()
    r = client.post(f"/api/offers/{o['id']}/withdraw", headers=auth(scene["sponsor"]))
    assert r.status_code == 409 and r.json()["code"] == "already_received"


def pay(client, scene, offer_id, outcome):
    h = auth(scene["sponsor"])
    start = client.post(f"/api/offers/{offer_id}/payments", json={"method": "wallet"}, headers=h)
    assert start.status_code == 201, start.text
    pid = start.json()["payment_id"]
    assert start.json()["checkout_url"].endswith(f"/api/payments/mock-checkout/{pid}")
    amount = "21000.00"
    hook = client.post(
        "/api/payments/webhook",
        json={"payment_id": pid, "status": outcome, "amount": amount, "signature": sign(pid, outcome, amount)},
    )
    assert hook.status_code == 200, hook.text
    return pid


def test_payment_success(client, scene, f, db):
    """Build prompt test 8: BDT 20,000 offer -> gross 21,000, commission 1,000, offer received."""
    o = offer(client, scene).json()
    f.accept(o["id"])
    q = client.get(f"/api/offers/{o['id']}/payment-quote", headers=auth(scene["sponsor"])).json()
    assert (q["amount"], q["commission"], q["total"]) == (20000, 1000, 21000)

    pid = pay(client, scene, o["id"], "succeeded")
    db.expire_all()
    p = db.get(Payment, pid)
    assert (p.gross_amount, p.commission_amount, p.net_amount) == (21000, 1000, 20000)
    assert p.status.value == "succeeded"
    assert db.get(Offer, o["id"]).stage == OfferStage.received
    # Now the impact report opens, with totals only
    rep = client.get(f"/api/sponsor/reports/{scene['project'].id}", headers=auth(scene["sponsor"]))
    assert rep.status_code == 200 and rep.json()["contribution"]["what"] == "BDT 20,000"


def test_payment_failure_then_retry(client, scene, f, db):
    """Build prompt test 9: a failed payment leaves the offer accepted; a retry works."""
    o = offer(client, scene).json()
    f.accept(o["id"])
    pay(client, scene, o["id"], "failed")
    db.expire_all()
    assert db.get(Offer, o["id"]).stage == OfferStage.accepted
    pay(client, scene, o["id"], "succeeded")
    db.expire_all()
    assert db.get(Offer, o["id"]).stage == OfferStage.received


def test_webhook_rejects_bad_signature_and_ignores_repeats(client, scene, f):
    o = offer(client, scene).json()
    f.accept(o["id"])
    pid = client.post(f"/api/offers/{o['id']}/payments", json={}, headers=auth(scene["sponsor"])).json()["payment_id"]
    bad = client.post(
        "/api/payments/webhook", json={"payment_id": pid, "status": "succeeded", "amount": "21000.00", "signature": "x"}
    )
    assert bad.status_code == 401
    good = {
        "payment_id": pid,
        "status": "succeeded",
        "amount": "21000.00",
        "signature": sign(pid, "succeeded", "21000.00"),
    }
    assert client.post("/api/payments/webhook", json=good).json()["status"] == "succeeded"
    failed_sig = {
        "payment_id": pid,
        "status": "failed",
        "amount": "21000.00",
        "signature": sign(pid, "failed", "21000.00"),
    }
    assert client.post("/api/payments/webhook", json=failed_sig).json()["status"] == "succeeded"  # already settled


def test_cannot_pay_before_acceptance(client, scene):
    o = offer(client, scene).json()
    r = client.post(f"/api/offers/{o['id']}/payments", json={}, headers=auth(scene["sponsor"]))
    assert r.status_code == 409


def test_report_needs_a_received_offer(client, scene):
    r = client.get(f"/api/sponsor/reports/{scene['project'].id}", headers=auth(scene["sponsor"]))
    assert r.status_code == 403 and r.json()["code"] == "no_received_offer"


def test_profile_update(client, scene):
    h = auth(scene["sponsor"])
    r = client.patch(
        "/api/sponsor/profile",
        json={
            "company": "Renamed Co.",
            "interests": ["Youth", "youth", " Tech "],
            "preferred_types": ["money", "skill"],
        },
        headers=h,
    )
    assert r.status_code == 200, r.text
    assert r.json()["interests"] == ["Youth", "Tech"] and r.json()["preferred_types"] == ["money", "skill"]
    assert client.patch("/api/sponsor/profile", json={"preferred_types": ["gold"]}, headers=h).status_code == 422


def test_pending_sponsor_refused(client, f):
    """Like build prompt test 12, for sponsors."""
    pending = f.user(UserRole.sponsor, "Pending Co.", status=AccountStatus.pending_approval)
    r = client.get("/api/sponsor/requests", headers=auth(pending))
    assert r.status_code == 403 and r.json()["code"] == "not_active"


def test_wrong_role_and_no_token(client, scene):
    assert client.get("/api/sponsor/requests", headers=auth(scene["org"])).json()["code"] == "wrong_role"
    assert client.get("/api/sponsor/requests").status_code == 401


def test_events_list_and_detail(client, scene):
    h = auth(scene["sponsor"])
    events = client.get("/api/events", headers=h).json()
    mine = next(e for e in events if e["id"] == str(scene["project"].id))
    assert mine["needs_money"] and mine["still_needed"] == ["BDT 20,000 for prize fund"]
    d = client.get(f"/api/events/{scene['project'].id}", headers=h).json()
    assert d["needs"][0]["state"] == "open"
