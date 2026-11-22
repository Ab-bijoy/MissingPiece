"""Admin (7.2), shared threads and notifications (7.6), and security checks."""

import uuid
from decimal import Decimal

from sqlalchemy import select, text

from app.config import get_settings
from app.models import Comment, Offer, Payment, RegistrationDocument
from app.models.enums import AccountStatus, CommentKind, CommentStatus, OfferStage, PaymentStatus, UserRole
from app.routers import admin as admin_router
from app.services.payments import sign
from tests.conftest import auth

# ---- Security -------------------------------------------------------------------------


def test_sql_injection_text_is_stored_as_plain_text(client, db):
    from app.auth import make_dev_token

    nasty = "Robert'); DROP TABLE app_user;--"
    h = {"Authorization": f"Bearer {make_dev_token(uuid.uuid4(), f'{uuid.uuid4().hex[:8]}@test.example')}"}
    r = client.post("/api/auth/register/user", json={"name": nasty}, headers=h)
    assert r.status_code == 201 and r.json()["name"] == nasty
    assert db.execute(text("select count(*) from app_user")).scalar() > 0  # table still there


def test_injection_in_search_and_filters(client, f):
    admin = f.user(UserRole.admin, "Admin")
    f.user(UserRole.general, "Plain Person")
    h = auth(admin)
    # The quote trick matches nothing instead of everything
    assert client.get("/api/admin/users", params={"q": "' OR 1=1 --"}, headers=h).json() == []
    # Values outside the allowed list are refused before reaching the database
    assert client.get("/api/admin/users", params={"role": "general'; DROP TABLE x;--"}, headers=h).status_code == 422
    assert client.get("/api/admin/registrations", params={"status": "pending' OR '1'='1"}, headers=h).status_code == 422


def test_example_dev_secret_is_refused(client, f, monkeypatch):
    user = f.user(UserRole.general, "Someone")
    token_headers = auth(user)
    monkeypatch.setattr(get_settings(), "dev_jwt_secret", "change-me-to-a-long-random-string-at-least-32-bytes")
    assert client.get("/api/auth/me", headers=token_headers).status_code == 401


def test_example_webhook_secret_is_refused(client, scene, f, monkeypatch):
    o = client.post(f"/api/requests/{scene['request'].id}/offers", json={}, headers=auth(scene["sponsor"])).json()
    f.accept(o["id"])
    pid = client.post(f"/api/offers/{o['id']}/payments", json={}, headers=auth(scene["sponsor"])).json()["payment_id"]
    monkeypatch.setattr(get_settings(), "payment_webhook_secret", "change-me")
    forged = {
        "payment_id": pid,
        "status": "succeeded",
        "amount": "21000.00",
        "signature": sign(pid, "succeeded", "21000.00"),
    }
    assert client.post("/api/payments/webhook", json=forged).status_code == 401


# ---- Threads and notifications (rule 6, build prompt test 10) -------------------------


def thread_id(client, scene):
    return client.get(f"/api/requests/{scene['request'].id}", headers=auth(scene["sponsor"])).json()["thread_id"]


def test_messages_between_organizer_and_sponsor(client, scene):
    tid = thread_id(client, scene)
    r = client.post(
        f"/api/threads/{tid}/messages",
        json={"body": "Can we present the prizes on stage?"},
        headers=auth(scene["sponsor"]),
    )
    assert r.status_code == 201 and r.json()["sender_name"] == "Test Sponsor Co."
    org_threads = client.get("/api/threads", headers=auth(scene["org"])).json()
    assert org_threads[0]["unread"] == 1 and org_threads[0]["last_message"].startswith("Can we")
    msgs = client.get(f"/api/threads/{tid}/messages", headers=auth(scene["org"])).json()
    assert [m["body"] for m in msgs] == ["Can we present the prizes on stage?"]
    assert client.get("/api/threads", headers=auth(scene["org"])).json()[0]["unread"] == 0  # opening marks read
    # The organizer got a bell notification; read-all clears it
    bell = client.get("/api/notifications", headers=auth(scene["org"])).json()
    assert any(n["type"] == "message_received" and not n["read"] for n in bell)
    assert client.post("/api/notifications/read-all", headers=auth(scene["org"])).status_code == 204
    assert all(n["read"] for n in client.get("/api/notifications", headers=auth(scene["org"])).json())


def test_outsider_cannot_read_or_post_in_thread(client, scene, f):
    """Build prompt test 10: a sponsor without a request cannot post in a thread."""
    tid = thread_id(client, scene)
    outsider = f.user(UserRole.sponsor, "Outsider Co.")
    assert client.post(f"/api/threads/{tid}/messages", json={"body": "hi"}, headers=auth(outsider)).status_code == 403
    assert client.get(f"/api/threads/{tid}/messages", headers=auth(outsider)).status_code == 403
    assert (
        client.post(f"/api/threads/{tid}/messages", json={"body": ""}, headers=auth(scene["sponsor"])).status_code
        == 422
    )


# ---- Admin: registration approvals ----------------------------------------------------


def test_admin_approves_a_sponsor_who_can_then_work(client, f):
    """Build prompt test 12: pending is refused everywhere until approved."""
    admin = f.user(UserRole.admin, "Admin")
    pending = f.user(UserRole.sponsor, "Waiting Co.", status=AccountStatus.pending_approval)
    assert client.get("/api/sponsor/requests", headers=auth(pending)).json()["code"] == "not_active"

    listed = client.get("/api/admin/registrations", params={"status": "pending"}, headers=auth(admin)).json()
    assert any(r["user_id"] == str(pending.id) and r["kind"] == "Software" for r in listed)
    detail = client.get(f"/api/admin/registrations/{pending.id}", headers=auth(admin)).json()
    assert detail["profile"]["company"] == "Waiting Co." and detail["documents"] == []

    assert client.post(f"/api/admin/registrations/{pending.id}/approve", headers=auth(admin)).status_code == 204
    assert client.get("/api/sponsor/requests", headers=auth(pending)).status_code == 200
    me = client.get("/api/auth/me", headers=auth(pending)).json()
    assert me["status"] == "active"
    # The audit trail records which admin approved, and when
    decided = client.get(f"/api/admin/registrations/{pending.id}", headers=auth(admin)).json()
    assert decided["reviewed_by_name"] == "Admin" and decided["reviewed_at"]
    approved = client.get("/api/admin/registrations", params={"status": "approved"}, headers=auth(admin)).json()
    assert any(r["user_id"] == str(pending.id) and r["reviewed_by_name"] == "Admin" for r in approved)
    # Deciding twice is refused
    assert client.post(f"/api/admin/registrations/{pending.id}/approve", headers=auth(admin)).status_code == 409


def test_admin_rejects_with_a_note(client, f):
    admin = f.user(UserRole.admin, "Admin")
    pending = f.user(UserRole.organizer, "Unclear Club", status=AccountStatus.pending_approval)
    r = client.post(f"/api/admin/registrations/{pending.id}/reject", json={"note": "  "}, headers=auth(admin))
    assert r.status_code == 422
    r = client.post(
        f"/api/admin/registrations/{pending.id}/reject",
        json={"note": "The certificate is unreadable."},
        headers=auth(admin),
    )
    assert r.status_code == 204
    me = client.get("/api/auth/me", headers=auth(pending)).json()
    assert me["status"] == "rejected" and me["rejection_note"] == "The certificate is unreadable."
    decided = client.get(f"/api/admin/registrations/{pending.id}", headers=auth(admin)).json()
    assert decided["reviewed_by_name"] == "Admin" and decided["reviewed_at"]


def test_only_admins_use_admin_endpoints(client, scene):
    for who in (scene["sponsor"], scene["org"]):
        assert client.get("/api/admin/registrations", headers=auth(who)).json()["code"] == "wrong_role"


# ---- Admin: accounts ------------------------------------------------------------------


def test_suspend_and_reactivate(client, f):
    admin = f.user(UserRole.admin, "Admin")
    sponsor = f.user(UserRole.sponsor, "Busy Co.")
    h = auth(admin)
    assert (
        client.patch(f"/api/admin/users/{sponsor.id}", json={"status": "suspended"}, headers=h).json()["status"]
        == "suspended"
    )
    assert client.get("/api/sponsor/requests", headers=auth(sponsor)).json()["code"] == "not_active"
    assert client.patch(f"/api/admin/users/{sponsor.id}", json={"status": "active"}, headers=h).status_code == 200
    assert client.get("/api/sponsor/requests", headers=auth(sponsor)).status_code == 200
    # An admin cannot suspend themselves
    assert (
        client.patch(f"/api/admin/users/{admin.id}", json={"status": "suspended"}, headers=h).json()["code"] == "self"
    )
    # Only active/suspended can be set here
    assert (
        client.patch(f"/api/admin/users/{sponsor.id}", json={"status": "pending_approval"}, headers=h).status_code
        == 422
    )


def test_delete_only_demo_accounts(client, f, db):
    admin = f.user(UserRole.admin, "Admin")
    real = f.user(UserRole.general, "Real Person")
    demo = f.user(UserRole.general, "Demo Person")
    demo.is_demo = True
    db.flush()
    assert client.delete(f"/api/admin/users/{real.id}", headers=auth(admin)).json()["code"] == "not_demo"
    assert client.delete(f"/api/admin/users/{demo.id}", headers=auth(admin)).status_code == 204


# ---- Admin: templates, payments, comments, files --------------------------------------


def test_templates(client, f):
    h = auth(f.user(UserRole.admin, "Admin"))
    body = {
        "name": f"Test template {uuid.uuid4().hex[:6]}",
        "project_type": "test",
        "blurb": "Fills in a hall",
        "status": "draft",
        "default_needs": [{"type": "space", "title": "Hall", "quantity": 1, "unit": "hall"}],
    }
    r = client.post("/api/admin/templates", json=body, headers=h)
    assert r.status_code == 201, r.text
    tid = r.json()["id"]
    assert client.post("/api/admin/templates", json=body, headers=h).json()["code"] == "duplicate"
    bad = {"default_needs": [{"type": "money", "title": "Prizes", "quantity": 100, "unit": "BDT"}]}
    assert client.patch(f"/api/admin/templates/{tid}", json=bad, headers=h).status_code == 422
    live = client.patch(f"/api/admin/templates/{tid}", json={"status": "live"}, headers=h).json()
    assert live["status"] == "live" and live["default_needs"][0]["title"] == "Hall"


def test_payout_only_after_success(client, scene, f, db):
    h = auth(f.user(UserRole.admin, "Admin"))
    o = client.post(f"/api/requests/{scene['request'].id}/offers", json={}, headers=auth(scene["sponsor"])).json()
    f.accept(o["id"])
    pay = Payment(
        offer_id=o["id"], gross_amount=Decimal("21000"), commission_amount=Decimal("1000"), net_amount=Decimal("20000")
    )
    db.add(pay)
    db.flush()
    assert client.post(f"/api/admin/payments/{pay.id}/payout", headers=h).json()["code"] == "bad_status"
    pay.status = PaymentStatus.succeeded
    db.get(Offer, o["id"]).stage = OfferStage.received
    db.flush()
    done = client.post(f"/api/admin/payments/{pay.id}/payout", headers=h).json()
    assert done["status"] == "paid_out" and done["paid_out_at"] and done["net_amount"] == 20000
    listed = client.get("/api/admin/payments", headers=h).json()
    assert any(p["id"] == str(pay.id) and p["sponsor_name"] == "Test Sponsor Co." for p in listed)


def test_hidden_comments_review_and_delete(client, scene, f, db):
    h = auth(f.user(UserRole.admin, "Admin"))
    c = Comment(
        project_id=scene["project"].id,
        user_id=scene["sponsor"].id,
        kind=CommentKind.comment,
        body="Call me on 017...",
        status=CommentStatus.hidden,
    )
    db.add(c)
    db.flush()
    hidden = client.get("/api/admin/comments", params={"status": "hidden"}, headers=h).json()
    assert any(x["id"] == str(c.id) and x["project_name"] == "Test Fest" for x in hidden)
    assert client.delete(f"/api/admin/comments/{c.id}", headers=h).status_code == 204
    assert db.scalar(select(Comment).where(Comment.id == c.id)) is None


def test_file_links_for_admin_or_owner_only(client, f, db, monkeypatch):
    monkeypatch.setattr(
        admin_router, "storage", lambda: type("S", (), {"signed_url": lambda self, k, s=300: f"https://files/{k}"})()
    )
    owner = f.user(UserRole.organizer, "Owner Club", status=AccountStatus.pending_approval)
    doc = RegistrationDocument(
        user_id=owner.id,
        storage_key=f"registration/{owner.id}/x.pdf",
        file_name="x.pdf",
        content_type="application/pdf",
        size_bytes=10,
        kind="registration_proof",
    )
    db.add(doc)
    db.flush()
    admin = f.user(UserRole.admin, "Admin")
    other = f.user(UserRole.organizer, "Other Club")
    assert client.get(f"/api/files/{doc.id}", headers=auth(admin)).json()["url"].endswith("x.pdf")
    assert client.get(f"/api/files/{doc.id}", headers=auth(other)).status_code == 403


def test_search_wildcards_are_literal(client, f):
    admin = f.user(UserRole.admin, "Admin")
    f.user(UserRole.general, "Plain Person")
    f.user(UserRole.general, "Fifty%Off Shop")
    h = auth(admin)
    # "%" alone used to match everyone; now it only matches names containing a real "%"
    names = [u["name"] for u in client.get("/api/admin/users", params={"q": "%"}, headers=h).json()]
    assert names == ["Fifty%Off Shop"]
    assert client.get("/api/admin/users", params={"q": "_"}, headers=h).json() == []


def test_template_name_is_not_a_search_pattern(client, f):
    h = auth(f.user(UserRole.admin, "Admin"))
    body = {"name": "%", "project_type": "x", "default_needs": []}
    # A name like "%" must not be mistaken for a duplicate of every template
    assert client.post("/api/admin/templates", json=body, headers=h).status_code == 201
