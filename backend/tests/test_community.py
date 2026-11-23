"""Community API integration tests; all database changes roll back."""

from datetime import UTC, datetime, timedelta

from sqlalchemy import select

from app.models import Comment, EventMembership, Offer
from app.models.enums import CommentStatus, MembershipStatus, NeedType, OfferStage, UserRole
from tests.conftest import auth


def test_public_feed_details_and_capacity(client, f, db):
    org = f.user(UserRole.organizer, "Organizer")
    p = f.project(org)
    p.audience = 1
    db.flush()
    a, b = f.user(UserRole.general, "A"), f.user(UserRole.general, "B")
    url = f"/api/events/{p.id}/join"
    assert client.post(url, json={"role": "participant"}, headers=auth(a)).status_code == 204
    assert client.post(url, json={"role": "participant"}, headers=auth(a)).status_code == 409
    assert client.post(url, json={"role": "participant"}, headers=auth(b)).status_code == 409
    detail = client.get(f"/api/events/{p.id}", headers=auth(a)).json()
    assert detail["seats_left"] == 0 and detail["my_membership"]["role"] == "participant"
    feed = client.get("/api/feed?limit=200")
    assert feed.status_code == 200
    row = next(x for x in feed.json() if x["id"] == str(p.id))
    assert row["participants"] == 1 and row["my_membership"] is None


def test_contribution_withdraw_and_reapply(client, f, db):
    p = f.project(f.user(UserRole.organizer, "Org"))
    n = f.need(p, NeedType.skill, 1, "trainer")
    n.slot_start = datetime.now(UTC) + timedelta(days=3)
    n.slot_end = n.slot_start + timedelta(hours=2)
    db.flush()
    user = f.user(UserRole.general, "Trainer")
    h = auth(user)
    body = {"role": "contributor", "contribution_role": "trainer", "need_id": str(n.id)}
    assert client.post(f"/api/events/{p.id}/join", json=body, headers=h).status_code == 204
    m = db.scalar(select(EventMembership).where(EventMembership.user_id == user.id))
    assert m.status == MembershipStatus.pending
    offer_id = m.offer_id
    assert client.post(f"/api/offers/{offer_id}/withdraw", headers=h).status_code == 204
    assert m.status == MembershipStatus.rejected
    assert client.get(f"/api/events/{p.id}", headers=h).json()["my_membership"] is None
    assert client.post(f"/api/events/{p.id}/join", json=body, headers=h).status_code == 204
    rows = client.get("/api/me/memberships", headers=h).json()
    assert len(rows) == 1 and rows[0]["offer"]["id"] != str(offer_id)


def test_profiles_roles_and_validation(client, f):
    h = auth(f.user(UserRole.general, "Person"))
    assert client.patch("/api/me/profile", headers=h, json={"name": " New ", "skills": ["Teaching"]}).status_code == 200
    assert client.get("/api/me/profile", headers=h).json()["name"] == "New"
    for body in ({"age": 131}, {"name": " "}, {"items": None}, {"role": "admin"}):
        assert client.patch("/api/me/profile", headers=h, json=body).status_code == 422
    assert client.get("/api/me/profile").status_code == 401
    assert client.get("/api/me/profile", headers=auth(f.user(UserRole.sponsor, "Co"))).status_code == 403


def test_comments_visibility_reply_validation(client, f, db):
    org = f.user(UserRole.organizer, "Org")
    p, other = f.project(org), f.project(org)
    author, outsider = f.user(UserRole.general, "Author"), f.user(UserRole.general, "Other")
    url = f"/api/events/{p.id}/comments"
    r = client.post(url, headers=auth(author), json={"kind": "question", "body": " Hello? "})
    assert r.status_code == 201, r.text
    assert r.json()["is_organizer"] is False
    c = db.get(Comment, r.json()["id"])
    c.status = CommentStatus.hidden
    db.flush()
    assert client.get(url).json() == []
    assert client.get(url, headers=auth(outsider)).json() == []
    for viewer in (author, org, f.user(UserRole.admin, "Admin")):
        assert len(client.get(url, headers=auth(viewer)).json()) == 1
    body = {"kind": "reply", "body": "Reply", "parent_id": str(c.id)}
    assert client.post(url, json=body, headers=auth(outsider)).status_code == 404
    assert client.post(f"/api/events/{other.id}/comments", json=body, headers=auth(author)).status_code == 404
    assert client.post(url, json={"kind": "reply", "body": "No parent"}, headers=auth(author)).status_code == 422

    organizer_reply = client.post(url, json=body, headers=auth(org))
    assert organizer_reply.status_code == 201
    assert organizer_reply.json()["is_organizer"] is True


def test_expiry_authorized_idempotent(client, f, db, monkeypatch):
    from app.config import get_settings

    monkeypatch.setattr(get_settings(), "jobs_secret", "x" * 48)
    p = f.project(f.user(UserRole.organizer, "Org"), days_ahead=-1)
    n = f.need(p)
    u = f.user(UserRole.sponsor, "Sponsor")
    o = Offer(need_id=n.id, from_user_id=u.id, amount=n.quantity, stage=OfferStage.accepted)
    db.add(o)
    db.flush()
    url = "/api/internal/jobs/expire-offers"
    assert client.post(url).status_code == 401
    assert client.post(url, headers={"JOBS_SECRET": "x" * 48}).status_code == 200
    db.refresh(o)
    assert o.stage == OfferStage.expired
    assert client.post(url, headers={"JOBS_SECRET": "x" * 48}).json()["expired"] == 0


def test_health(client):
    assert client.get("/api/health").json() == {"status": "ok"}
