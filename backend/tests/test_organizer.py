"""Organizer endpoints answer in the shapes the organizer screens use
(frontend/src/api/types.ts) and follow the build prompt's rules."""

from datetime import date, timedelta

from sqlalchemy import select

from app.models import Benefit, Offer, SponsorMatch
from app.models.enums import MatchStatus, NeedType, UserRole
from tests.conftest import auth

PROJECT = {
    "template_id": None,
    "name": "Science Fair",
    "purpose": "Show projects",
    "description": "Students show their projects",
    "event_date": str(date.today() + timedelta(days=30)),
    "venue": "Hall",
    "audience": 50,
    "institution": None,
    "needs": [
        {"type": "money", "title": "Prize fund", "quantity": 20000, "unit": "kg", "budget_item": "Prizes"},
        {
            "type": "skill",
            "title": "Trainers",
            "quantity": 3,
            "unit": "trainers",
            "slot_start": f"{date.today() + timedelta(days=30)}T10:00:00+06:00",
            "slot_end": f"{date.today() + timedelta(days=30)}T12:00:00+06:00",
        },
    ],
}


def test_project_screens_get_their_fields(client, f):
    org = auth(f.user(UserRole.organizer, "Org"))
    p = client.post("/api/projects", json=PROJECT, headers=org)
    assert p.status_code == 201, p.text
    p = p.json()
    assert {"organizer_id", "template_id", "project_type", "needs"} <= set(p)
    money = next(n for n in p["needs"] if n["type"] == "money")
    assert money["unit"] == "BDT"  # a money need is always in BDT, whatever was sent

    mine = client.get("/api/projects/mine", headers=org).json()
    row = next(x for x in mine if x["id"] == p["id"])
    assert (row["open_needs"], row["total_needs"]) == (2, 2)

    gaps = client.get(f"/api/projects/{p['id']}/gaps", headers=org).json()
    assert set(gaps) == {"needs", "summary"}
    # Needs saved together keep no fixed order, so either order is right
    assert gaps["summary"] in (
        "Still needed: BDT 20,000 for prize fund and 3 trainers.",
        "Still needed: 3 trainers and BDT 20,000 for prize fund.",
    )
    assert gaps["needs"][0]["state"] == "open" and gaps["needs"][0]["note"] == "No requests yet"

    ready = client.get(f"/api/projects/{p['id']}/readiness", headers=org).json()
    assert [c["key"] for c in ready["checks"]] == ["plan", "commitments", "items", "activity"]
    assert {"ok", "value", "detail"} <= set(ready["checks"][0]) and ready["can_complete"] is False

    report = client.get(f"/api/projects/{p['id']}/report", headers=org).json()
    assert report == {
        "people_taking_part": 0,
        "sessions_held": 0,
        "money_received": 0,
        "items_received": [],
        "needs_total": 2,
        "needs_received": 0,
    }

    offers = client.get(f"/api/projects/{p['id']}/offers", headers=org).json()
    assert offers == {"offers": [], "conflicts": []}
    matches = client.get(f"/api/projects/{p['id']}/sponsor-matches", headers=org).json()
    assert set(matches) == {"matches", "requests_left"} and matches["requests_left"] == 5


def test_request_offer_accept_and_benefits(client, f, db):
    org_user = f.user(UserRole.organizer, "Org")
    org = auth(org_user)
    sponsor = f.user(UserRole.sponsor, "Giver Co.")
    rival = f.user(UserRole.sponsor, "Rival Co.")
    p = client.post("/api/projects", json=PROJECT, headers=org).json()
    client.post(f"/api/projects/{p['id']}/publish", headers=org)
    money = next(n for n in p["needs"] if n["type"] == "money")
    # Publishing may already have suggested this sponsor; add the suggestion only if not
    suggested = select(SponsorMatch.id).where(SponsorMatch.project_id == p["id"], SponsorMatch.sponsor_id == sponsor.id)
    if db.scalar(suggested) is None:
        db.add(
            SponsorMatch(
                project_id=p["id"], sponsor_id=sponsor.id, score=80, reason="Fits", status=MatchStatus.suggested
            )
        )
        db.flush()

    # Send requests as the screen does: the sponsor id, no suggestion id
    body = {
        "need_id": money["id"],
        "sponsor_id": str(sponsor.id),
        "benefits": ["Logo on banner"],
        "conditions": None,
        "exclusive_category": None,
        "decide_by": str(date.today() + timedelta(days=2)),
        "deliver_by": str(date.today() + timedelta(days=10)),
    }
    sent = client.post(f"/api/projects/{p['id']}/requests", json=body, headers=org)
    assert sent.status_code == 201, sent.text
    assert {"id", "thread_id"} <= set(sent.json())
    db.expire_all()
    assert db.scalar(select(SponsorMatch.status).where(SponsorMatch.sponsor_id == sponsor.id)) == MatchStatus.requested
    rival_body = {**body, "sponsor_id": str(rival.id)}
    rival_req = client.post(f"/api/projects/{p['id']}/requests", json=rival_body, headers=org).json()
    assert client.get(f"/api/projects/{p['id']}/sponsor-matches", headers=org).json()["requests_left"] == 3

    # Two sponsors offer for the same need: shown as a conflict
    o1 = client.post(f"/api/requests/{sent.json()['id']}/offers", json={}, headers=auth(sponsor)).json()
    client.post(f"/api/requests/{rival_req['id']}/offers", json={}, headers=auth(rival))
    listed = client.get(f"/api/projects/{p['id']}/offers", headers=org).json()
    assert len(listed["offers"]) == 2 and listed["conflicts"][0]["reason"] == "These offers are for the same need"
    assert {"from_name", "benefits", "membership_id", "payment_status"} <= set(listed["offers"][0])

    # Accept one; the gaps panel shows it covered
    assert client.post(f"/api/offers/{o1['id']}/accept", headers=org).status_code == 200
    gaps = client.get(f"/api/projects/{p['id']}/gaps", headers=org).json()
    row = next(r for r in gaps["needs"] if r["need_id"] == money["id"])
    assert row["state"] == "covered" and row["covered_by"] == "Giver Co."

    # Benefits: tick and untick (the screen sends {"given": ...} in the body)
    bid = db.scalar(select(Benefit.id).where(Benefit.offer_id == o1["id"]))
    assert client.patch(f"/api/benefits/{bid}", json={"given": True}, headers=org).json()["given"] is True
    assert client.patch(f"/api/benefits/{bid}", json={"given": False}, headers=org).json()["given"] is False


def test_complete_only_when_ready(client, f, db):
    org = auth(f.user(UserRole.organizer, "Org"))
    p = client.post("/api/projects", json=PROJECT, headers=org).json()
    r = client.post(f"/api/projects/{p['id']}/complete", headers=org)
    assert r.status_code == 409 and r.json()["code"] == "not_ready"


def test_other_organizers_cannot_see_a_project(client, f):
    owner = auth(f.user(UserRole.organizer, "Owner"))
    other = auth(f.user(UserRole.organizer, "Other"))
    p = client.post("/api/projects", json=PROJECT, headers=owner).json()
    for path in ("", "/gaps", "/readiness", "/report", "/offers", "/sponsor-matches"):
        assert client.get(f"/api/projects/{p['id']}{path}", headers=other).status_code == 403


def test_need_wording(client, f, db):
    from app.services.views import need_phrase

    org = auth(f.user(UserRole.organizer, "Org"))
    p = client.post("/api/projects", json=PROJECT, headers=org).json()
    need = db.get(
        __import__("app.models", fromlist=["Need"]).Need, next(n["id"] for n in p["needs"] if n["type"] == "skill")
    )
    assert need_phrase(need) == "3 trainers"
    assert NeedType.skill == need.type
    assert db.scalar(select(Offer).limit(0)) is None


def _request_body(need_id, sponsor_id):
    return {
        "need_id": need_id,
        "sponsor_id": str(sponsor_id),
        "benefits": ["Logo on banner"],
        "conditions": None,
        "exclusive_category": None,
        "decide_by": str(date.today() + timedelta(days=2)),
        "deliver_by": str(date.today() + timedelta(days=10)),
    }


def test_requests_sent_list_and_states(client, f, db):
    org = auth(f.user(UserRole.organizer, "Org"))
    sponsor = f.user(UserRole.sponsor, "Giver Co.")
    p = client.post("/api/projects", json=PROJECT, headers=org).json()
    client.post(f"/api/projects/{p['id']}/publish", headers=org)
    money = next(n for n in p["needs"] if n["type"] == "money")
    sent = client.post(f"/api/projects/{p['id']}/requests", json=_request_body(money["id"], sponsor.id), headers=org)
    assert sent.status_code == 201, sent.text

    rows = client.get(f"/api/projects/{p['id']}/requests", headers=org).json()
    assert len(rows) == 1 and rows[0]["state"] == "waiting" and rows[0]["thread_id"]
    assert rows[0]["sponsor_name"] == "Giver Co." and rows[0]["need_title"] == "Prize fund"

    client.post(f"/api/requests/{sent.json()['id']}/offers", json={}, headers=auth(sponsor))
    rows = client.get(f"/api/projects/{p['id']}/requests", headers=org).json()
    assert rows[0]["state"] == "offer_received" and rows[0]["offer_id"]

    # Asking the same sponsor again for the same need: a plain message, not a database error
    again = client.post(f"/api/projects/{p['id']}/requests", json=_request_body(money["id"], sponsor.id), headers=org)
    assert again.status_code == 409 and again.json()["code"] == "duplicate_request"
    # Another organizer cannot see them
    other = auth(f.user(UserRole.organizer, "Other"))
    assert client.get(f"/api/projects/{p['id']}/requests", headers=other).status_code == 403


def test_sixth_sponsor_is_refused_with_the_screens_code(client, f):
    org = auth(f.user(UserRole.organizer, "Org"))
    p = client.post("/api/projects", json=PROJECT, headers=org).json()
    money = next(n for n in p["needs"] if n["type"] == "money")
    for i in range(5):
        s = f.user(UserRole.sponsor, f"Co {i}")
        assert (
            client.post(
                f"/api/projects/{p['id']}/requests", json=_request_body(money["id"], s.id), headers=org
            ).status_code
            == 201
        )
    sixth = f.user(UserRole.sponsor, "Co 6")
    r = client.post(f"/api/projects/{p['id']}/requests", json=_request_body(money["id"], sixth.id), headers=org)
    assert r.status_code == 409 and r.json()["code"] == "request_limit"


def test_request_dates_are_required_and_sensible(client, f):
    """Decide by and Deliver by: both required, deliver not before decide, not in the past, not after the event."""
    org = auth(f.user(UserRole.organizer, "Org"))
    p = client.post("/api/projects", json=PROJECT, headers=org).json()
    money = next(n for n in p["needs"] if n["type"] == "money")
    sponsor = f.user(UserRole.sponsor, "Dates Co.")
    url = f"/api/projects/{p['id']}/requests"
    good = _request_body(money["id"], sponsor.id)
    day = lambda n: str(date.today() + timedelta(days=n))  # noqa: E731

    # Missing dates
    for missing in ("decide_by", "deliver_by"):
        body = {k: v for k, v in good.items() if k != missing}
        assert client.post(url, json=body, headers=org).status_code == 422
        assert client.post(url, json={**good, missing: None}, headers=org).status_code == 422
    # Deliver before decide
    assert client.post(url, json={**good, "decide_by": day(5), "deliver_by": day(3)}, headers=org).status_code == 422
    # Decide by in the past (yesterday in Dhaka is always in the past)
    r = client.post(url, json={**good, "decide_by": day(-2), "deliver_by": day(3)}, headers=org)
    assert r.status_code == 422 and r.json()["code"] == "invalid_dates"
    # Deliver by after the event (the project is 30 days away)
    r = client.post(url, json={**good, "deliver_by": day(31)}, headers=org)
    assert r.status_code == 422 and r.json()["code"] == "invalid_dates"
    # Valid dates, deliver on the event day itself
    assert client.post(url, json={**good, "deliver_by": day(30)}, headers=org).status_code == 201


def test_sponsor_search(client, f):
    from app.models.enums import AccountStatus

    org = auth(f.user(UserRole.organizer, "Org"))
    p = client.post("/api/projects", json=PROJECT, headers=org).json()
    active = f.user(UserRole.sponsor, "Zeta Robotics Ltd.")
    f.user(UserRole.sponsor, "Zeta Pending Ltd.", status=AccountStatus.pending_approval)
    found = client.get("/api/sponsors/search", params={"project_id": p["id"], "q": "zeta"}, headers=org).json()
    names = [s["name"] for s in found]
    assert "Zeta Robotics Ltd." in names and "Zeta Pending Ltd." not in names  # only approved sponsors
    hit = next(s for s in found if s["name"] == "Zeta Robotics Ltd.")
    assert set(hit) == {"id", "name", "industry", "location", "interests", "requested"}  # no contact details
    assert hit["id"] == str(active.id) and hit["requested"] is False
    # Words are text, never patterns: "%" matches only a real "%"
    assert client.get("/api/sponsors/search", params={"project_id": p["id"], "q": "%"}, headers=org).json() == []
    # Only for the project's own organizer
    other = auth(f.user(UserRole.organizer, "Other"))
    assert client.get("/api/sponsors/search", params={"project_id": p["id"]}, headers=other).status_code == 403
    assert client.get("/api/sponsors/search", params={"project_id": p["id"]}, headers=auth(active)).status_code == 403


def test_organizer_profile_view_and_edit(client, f):
    org_user = f.user(UserRole.organizer, "Old Club Name")
    h = auth(org_user)
    me = client.get("/api/organizer/profile", headers=h)
    assert me.status_code == 200, me.text
    assert set(me.json()) == {
        "org_name",
        "org_type",
        "registration_number",
        "contact_person",
        "phone",
        "email",
        "status",
    }

    r = client.patch(
        "/api/organizer/profile",
        json={"org_name": " New Club Name ", "contact_person": "Nadia", "phone": "017-1234-5678"},
        headers=h,
    )
    assert r.status_code == 200, r.text
    assert r.json()["org_name"] == "New Club Name" and r.json()["phone"] == "01712345678"
    # The new name is used everywhere the organizer is shown
    assert client.get("/api/auth/me", headers=h).json()["name"] == "New Club Name"

    # Checked fields cannot change; bad input is refused
    assert client.patch("/api/organizer/profile", json={"registration_number": "X"}, headers=h).json()["org_name"] == (
        "New Club Name"
    )
    assert client.get("/api/organizer/profile", headers=h).json()["registration_number"] != "X"
    assert client.patch("/api/organizer/profile", json={"phone": "123"}, headers=h).status_code == 422
    assert client.patch("/api/organizer/profile", json={"org_name": "  "}, headers=h).status_code == 422
    # Only organizers
    assert client.get("/api/organizer/profile", headers=auth(f.user(UserRole.sponsor, "Co"))).status_code == 403


def test_sponsor_public_profile(client, f):
    from app.models.enums import AccountStatus

    org = auth(f.user(UserRole.organizer, "Org"))
    sponsor = f.user(UserRole.sponsor, "Giver Co.")
    r = client.get(f"/api/sponsors/{sponsor.id}", headers=org)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["name"] == "Giver Co." and body["contributions_received"] == 0
    # Never contact details
    assert not {"phone", "contact_person", "email", "trade_license_number"} & set(body)
    # Not for pending sponsors, other roles, or non-sponsors
    pending = f.user(UserRole.sponsor, "Waiting Co.", status=AccountStatus.pending_approval)
    assert client.get(f"/api/sponsors/{pending.id}", headers=org).status_code == 404
    assert (
        client.get(f"/api/sponsors/{sponsor.id}", headers=auth(f.user(UserRole.general, "Person"))).status_code == 403
    )
    assert client.get(f"/api/sponsors/{f.user(UserRole.organizer, 'Other').id}", headers=org).status_code == 404
