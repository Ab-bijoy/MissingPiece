import json
from types import SimpleNamespace
from unittest.mock import Mock

import pytest
from sqlalchemy import select

from app.config import get_settings
from app.errors import ApiError
from app.models import Message, MessageThread, Notification, SponsorMatch, SponsorRequest
from app.models.enums import AccountStatus, CommentStatus, MatchStatus, UserRole
from app.services import matching
from tests.conftest import auth


def sample():
    project = SimpleNamespace(
        name="Digital learning",
        purpose="Teach digital skills",
        description="Computer workshop",
        venue="Public hall",
        institution=None,
        audience=30,
        needs=[],
    )
    sponsor = SimpleNamespace(
        name="Learning Co",
        sponsor_profile=SimpleNamespace(
            company="Learning Co",
            industry="Education",
            interests=["digital education"],
            preferred_types=["skill"],
            location="Dhaka",
            description="Training provider",
            phone="PRIVATE PHONE",
            contact_person="PRIVATE PERSON",
            trade_license_number="PRIVATE LICENCE",
        ),
        email="PRIVATE EMAIL",
    )
    return project, [sponsor]


def provider(monkeypatch, ratings):
    create = Mock(
        return_value=SimpleNamespace(
            choices=[
                SimpleNamespace(finish_reason="stop", message=SimpleNamespace(content=json.dumps({"ratings": ratings})))
            ]
        )
    )
    monkeypatch.setattr(
        matching,
        "_client",
        lambda *args: SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(create=create))),
    )
    monkeypatch.setattr(get_settings(), "groq_api_key", "test-unused-key")
    return create


def test_matching_validates_and_minimizes_payload(monkeypatch):
    create = provider(monkeypatch, [{"candidate_id": "0", "score": 80, "reason": "Education interests fit."}])
    project, sponsors = sample()
    result = matching.rank_sponsors(project, sponsors)
    assert result == [(80, "Education interests fit.", sponsors[0])]
    payload = create.call_args.kwargs["messages"][1]["content"]
    assert "PRIVATE" not in payload
    assert create.call_args.kwargs["response_format"]["json_schema"]["strict"] is True


@pytest.mark.parametrize(
    "ratings",
    [
        [],
        [{"candidate_id": "unknown", "score": 80, "reason": "Fit"}],
        [{"candidate_id": "0", "score": 101, "reason": "Fit"}],
        [{"candidate_id": "0", "score": 80, "reason": ""}],
        [{"candidate_id": "0", "score": 80, "reason": "Fit"}] * 2,
    ],
)
def test_invalid_ai_rankings_fail_without_fabricated_scores(monkeypatch, ratings):
    provider(monkeypatch, ratings)
    with pytest.raises(ApiError):
        matching.rank_sponsors(*sample())


@pytest.mark.parametrize("sender_role", ["org", "sponsor"])
def test_hidden_messages_only_admin_can_read(client, scene, f, db, sender_role):
    tid = db.scalar(select(MessageThread.id).where(MessageThread.request_id == scene["request"].id))
    admin = f.user(UserRole.admin, "Admin")
    outsider = f.user(UserRole.general, "Other")
    url = f"/api/threads/{tid}/messages"
    response = client.post(url, headers=auth(scene[sender_role]), json={"body": "FUCK U"})
    assert response.status_code == 201
    assert set(response.json()) == {"id", "status"} and response.json()["status"] == "hidden"
    mid = response.json()["id"]
    assert db.get(Message, mid).status == CommentStatus.hidden
    assert not db.scalars(select(Notification).where(Notification.ref_id == tid)).all()
    for u in (scene["org"], scene["sponsor"]):
        assert client.get(url, headers=auth(u)).json() == []
        row = next(t for t in client.get("/api/threads", headers=auth(u)).json() if t["id"] == str(tid))
        assert row["last_message"] is None and row["unread"] == 0
    for u in (scene["org"], scene["sponsor"], outsider):
        assert client.get("/api/admin/messages", headers=auth(u)).status_code == 403
        assert client.post(f"/api/admin/messages/{mid}/restore", headers=auth(u)).status_code == 403
        assert client.delete(f"/api/admin/messages/{mid}", headers=auth(u)).status_code == 403
    assert client.get(url, headers=auth(outsider)).status_code == 403
    listed = client.get("/api/admin/messages", headers=auth(admin)).json()
    assert next(m for m in listed if m["id"] == mid)["body"] == "FUCK U"
    # Manual review can deliver a false positive, and admin deletion removes it.
    assert client.post(f"/api/admin/messages/{mid}/restore", headers=auth(admin)).status_code == 204
    assert client.get(url, headers=auth(scene["org"])).json()[0]["id"] == mid
    assert client.delete(f"/api/admin/messages/{mid}", headers=auth(admin)).status_code == 204
    assert client.get(url, headers=auth(scene["sponsor"])).json() == []


def test_organizer_and_sponsor_comments_are_moderated(client, scene, f):
    url = f"/api/events/{scene['project'].id}/comments"
    for u in (scene["org"], scene["sponsor"]):
        response = client.post(url, headers=auth(u), json={"kind": "comment", "body": "email: test@example.com"})
        assert response.status_code == 201 and set(response.json()) == {"id", "status"}
        hidden_again = client.post(f"/api/comments/{response.json()['id']}/hide", headers=auth(scene["org"]))
        assert hidden_again.status_code == 200 and set(hidden_again.json()) == {"id", "status"}
        assert client.get(url, headers=auth(u)).json() == []
    assert len(client.get(url, headers=auth(f.user(UserRole.admin, "Admin"))).json()) == 2


def test_ai_matches_persist_no_requests_and_preserve_results_on_failure(client, scene, f, db, monkeypatch):
    target = f.user(UserRole.sponsor, "Education sponsor")
    target.sponsor_profile.preferred_types = ["money"]
    inactive = f.user(UserRole.sponsor, "Suspended", status=AccountStatus.suspended)
    dismissed = f.user(UserRole.sponsor, "Dismissed")
    db.add(
        SponsorMatch(
            project_id=scene["project"].id,
            sponsor_id=dismissed.id,
            score=90,
            reason="Old",
            status=MatchStatus.dismissed,
        )
    )
    db.flush()

    def rank(project, sponsors):
        ids = {s.id for s in sponsors}
        assert target.id in ids
        assert not ids.intersection({inactive.id, dismissed.id, scene["sponsor"].id})
        return [(95 if s.id == target.id else 10, "Test AI assessment", s) for s in sponsors]

    monkeypatch.setattr(matching, "rank_sponsors", rank)
    url = f"/api/projects/{scene['project'].id}/sponsor-matches"
    headers = auth(scene["org"])
    response = client.post(url, headers=headers)
    assert response.status_code == 200, response.text
    own = next(m for m in response.json()["matches"] if m["sponsor_id"] == str(target.id))
    assert own["score"] == 95 and own["source"] == "ai"
    assert len(db.scalars(select(SponsorRequest).where(SponsorRequest.project_id == scene["project"].id)).all()) == 1
    assert client.post(url, headers=auth(scene["sponsor"])).status_code == 403
    assert client.get(url, headers=auth(f.user(UserRole.organizer, "Other org"))).status_code == 403

    def fail(*args):
        raise ApiError(503, "Unavailable", "ai_unavailable")

    monkeypatch.setattr(matching, "rank_sponsors", fail)
    assert client.post(url, headers=headers).status_code == 503
    assert next(m for m in client.get(url, headers=headers).json()["matches"] if m["id"] == own["id"])["score"] == 95
