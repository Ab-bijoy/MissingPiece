"""Schedule validation and repairing legacy needs on the real, rolled-back database."""

from datetime import UTC, datetime, timedelta

import pytest
from pydantic import ValidationError
from sqlalchemy import select

from app.models import Booking, EventMembership, Offer, Template
from app.models.enums import NeedType, ProjectStatus, UserRole
from app.schemas.organizer import NeedCreateIn
from tests.conftest import auth


def times():
    start = datetime.now(UTC).replace(hour=16, minute=0, second=0, microsecond=0) + timedelta(days=3)
    return start.isoformat(), (start + timedelta(hours=5)).isoformat()  # 22:00–03:00 Dhaka


@pytest.mark.parametrize("kind", ["skill", "time", "equipment", "space"])
def test_contributor_types_require_both_times(kind):
    with pytest.raises(ValidationError):
        NeedCreateIn(type=kind, title="Help", quantity=1, unit="person")
    start, end = times()
    assert NeedCreateIn(type=kind, title="Help", quantity=1, unit="person", slot_start=start, slot_end=end)


@pytest.mark.parametrize("problem", ["one_boundary", "reversed", "equal", "naive", "past"])
def test_invalid_schedules_rejected(problem):
    start, end = times()
    if problem == "one_boundary":
        end = None
    if problem == "reversed":
        start, end = end, start
    if problem == "equal":
        end = start
    if problem == "naive":
        start = start[:19]
    if problem == "past":
        start, end = (
            (datetime.now(UTC) - timedelta(days=2)).isoformat(),
            (datetime.now(UTC) - timedelta(days=1)).isoformat(),
        )
    with pytest.raises(ValidationError):
        NeedCreateIn(type="skill", title="Help", quantity=1, unit="person", slot_start=start, slot_end=end)


def test_create_add_patch_and_type_conversion_validate_schedules(client, f, db):
    org = f.user(UserRole.organizer, "Org")
    p = f.project(org)
    headers = auth(org)
    need = {"type": "skill", "title": "Helper", "quantity": 1, "unit": "person"}
    assert client.post(f"/api/projects/{p.id}/needs", headers=headers, json=need).status_code == 422
    assert (
        client.post(
            "/api/projects",
            headers=headers,
            json={
                "name": "Workshop",
                "purpose": "Learn",
                "description": "Learning",
                "event_date": str(p.event_date),
                "venue": "Hall",
                "audience": 20,
                "needs": [need],
            },
        ).status_code
        == 422
    )
    start, end = times()
    response = client.post(
        f"/api/projects/{p.id}/needs", headers=headers, json={**need, "slot_start": start, "slot_end": end}
    )
    assert response.status_code == 201, response.text
    nid = response.json()["id"]
    for patch in ({"slot_start": None}, {"slot_end": start}, {"slot_end": start[:19]}):
        assert client.patch(f"/api/needs/{nid}", headers=headers, json=patch).status_code == 422
    # Changing only one boundary is valid when the merged stored schedule is valid.
    later = (datetime.fromisoformat(end) + timedelta(hours=1)).isoformat()
    assert client.patch(f"/api/needs/{nid}", headers=headers, json={"slot_end": later}).status_code == 200
    product = client.post(f"/api/projects/{p.id}/needs", headers=headers, json={**need, "type": "product"}).json()
    assert client.patch(f"/api/needs/{product['id']}", headers=headers, json={"type": "time"}).status_code == 422


def test_legacy_need_blocked_then_organizer_repairs_and_contributor_applies(client, f, db):
    org = f.user(UserRole.organizer, "Org")
    person = f.user(UserRole.general, "Helper")
    p = f.project(org)
    n = f.need(p, NeedType.time, 1, "helper")  # pre-existing need with no schedule
    url = f"/api/events/{p.id}/join"
    body = {"role": "contributor", "need_id": str(n.id)}
    response = client.post(url, headers=auth(person), json=body)
    assert response.status_code == 409 and response.json()["code"] == "need_schedule_unavailable"
    start, end = times()
    # Supplying arbitrary times cannot bypass an organizer's missing schedule.
    assert (
        client.post(url, headers=auth(person), json={**body, "slot_start": start, "slot_end": end}).status_code == 409
    )
    assert db.scalar(select(EventMembership).where(EventMembership.user_id == person.id)) is None
    assert db.scalar(select(Offer).where(Offer.need_id == n.id)) is None
    other = f.user(UserRole.organizer, "Other organizer")
    assert (
        client.patch(f"/api/needs/{n.id}", headers=auth(other), json={"slot_start": start, "slot_end": end}).status_code
        == 403
    )
    assert (
        client.patch(f"/api/needs/{n.id}", headers=auth(org), json={"slot_start": start, "slot_end": end}).status_code
        == 200
    )
    assert client.post(url, headers=auth(person), json=body).status_code == 204
    m = db.scalar(select(EventMembership).where(EventMembership.user_id == person.id))
    offer = db.get(Offer, m.offer_id)
    assert offer.slot_start == datetime.fromisoformat(start) and offer.slot_end == datetime.fromisoformat(end)
    assert client.post(f"/api/memberships/{m.id}/approve", headers=auth(org)).status_code == 200
    assert db.scalar(select(Booking.id).where(Booking.offer_id == offer.id))


def test_template_draft_requires_schedule_before_publishing(client, f, db):
    org = f.user(UserRole.organizer, "Org")
    template = Template(
        name="Helper template",
        project_type="ngo_project",
        default_needs=[
            {"type": "skill", "title": "Trainer", "quantity": 1, "unit": "trainer"},
        ],
    )
    db.add(template)
    db.flush()
    response = client.post(
        "/api/projects",
        headers=auth(org),
        json={
            "template_id": str(template.id),
            "name": "Workshop",
            "purpose": "Learn",
            "description": "Training",
            "event_date": str((datetime.now(UTC) + timedelta(days=4)).date()),
            "venue": "Hall",
            "audience": 20,
        },
    )
    assert response.status_code == 201, response.text
    project = response.json()
    publish = f"/api/projects/{project['id']}/publish"
    assert client.post(publish, headers=auth(org)).status_code == 422
    assert client.get(f"/api/projects/{project['id']}", headers=auth(org)).json()["status"] == ProjectStatus.draft.value
    start, end = times()
    assert (
        client.patch(
            f"/api/needs/{project['needs'][0]['id']}", headers=auth(org), json={"slot_start": start, "slot_end": end}
        ).status_code
        == 200
    )
    assert client.post(publish, headers=auth(org)).status_code == 200


def test_schedule_change_does_not_silently_reschedule_existing_applicant(client, f, db):
    from tests.test_contributor_approvals import apply, decide, program

    org, p, n = program(f, db)
    _, member, offer = apply(client, f, db, p, n)
    original_start = offer.slot_start
    response = client.patch(
        f"/api/needs/{n.id}",
        headers=auth(org),
        json={
            "slot_start": (n.slot_start + timedelta(hours=3)).isoformat(),
            "slot_end": (n.slot_end + timedelta(hours=3)).isoformat(),
        },
    )
    assert response.status_code == 200
    response = decide(client, org, member, "approve")
    assert response.status_code == 409 and response.json()["code"] == "invalid_slot"
    db.refresh(offer)
    assert offer.slot_start == original_start and offer.stage.value == "offered"
    assert db.scalar(select(Booking.id).where(Booking.offer_id == offer.id)) is None
