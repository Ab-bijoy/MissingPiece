"""Contributor application round trips on PostgreSQL, rolled back per test."""

from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import func, select

from app.models import Booking, EventMembership, Notification, Offer
from app.models.enums import (
    MembershipStatus,
    NeedStatus,
    NeedType,
    NotificationType,
    OfferStage,
    ProjectStatus,
    UserRole,
)
from tests.conftest import auth


def program(f, db, org=None):
    org = org or f.user(UserRole.organizer, "Organizer")
    p = f.project(org)
    n = f.need(p, NeedType.skill, 1, "trainer")
    n.slot_start = datetime.now(UTC) + timedelta(days=2)
    n.slot_end = n.slot_start + timedelta(hours=2)
    db.flush()
    return org, p, n


def apply(client, f, db, p, n, person=None):
    person = person or f.user(UserRole.general, "Applicant")
    body = {"role": "contributor", "contribution_role": "trainer", "need_id": str(n.id)}
    response = client.post(f"/api/events/{p.id}/join", headers=auth(person), json=body)
    assert response.status_code == 204, response.text
    m = db.scalar(
        select(EventMembership).where(EventMembership.project_id == p.id, EventMembership.user_id == person.id)
    )
    return person, m, db.get(Offer, m.offer_id)


def decide(client, org, m, decision):
    return client.post(f"/api/memberships/{m.id}/{decision}", headers=auth(org))


def test_application_visible_approval_syncs_booking_counts_and_competitors(client, f, db):
    org, p, n = program(f, db)
    person, m, offer = apply(client, f, db, p, n)
    _, competitor, other_offer = apply(client, f, db, p, n)
    row = next(
        r for r in client.get(f"/api/projects/{p.id}/memberships", headers=auth(org)).json() if r["id"] == str(m.id)
    )
    assert row["name"] == person.name and row["need_title"] == n.title
    assert row["contribution_role"] == "trainer" and row["offer_stage"] == "offered" and row["status"] == "pending"
    assert row["slot_start"] and row["slot_end"]
    response = decide(client, org, m, "approve")
    assert response.status_code == 200, response.text
    db.refresh(m)
    db.refresh(offer)
    db.refresh(n)
    db.refresh(competitor)
    db.refresh(other_offer)
    assert (m.status, offer.stage, n.status) == (MembershipStatus.approved, OfferStage.accepted, NeedStatus.covered)
    assert (competitor.status, other_offer.stage) == (MembershipStatus.rejected, OfferStage.declined)
    booking = db.scalar(select(Booking).where(Booking.offer_id == offer.id))
    assert booking and booking.resource_key == f"user:{person.id}"
    mine = client.get("/api/me/memberships", headers=auth(person)).json()[0]
    assert mine["status"] == "approved" and mine["offer"]["stage"] == "accepted"
    detail = client.get(f"/api/events/{p.id}", headers=auth(person))
    assert detail.status_code == 200, detail.text
    assert detail.json()["contributors"] == 1
    assert decide(client, org, m, "approve").status_code == 200
    assert db.scalar(select(func.count()).select_from(Booking).where(Booking.offer_id == offer.id)) == 1
    assert (
        db.scalar(
            select(func.count())
            .select_from(Notification)
            .where(Notification.ref_id == m.id, Notification.type == NotificationType.membership_approved)
        )
        == 1
    )


def test_rejection_syncs_offer_and_allows_reapplication(client, f, db):
    org, p, n = program(f, db)
    person, m, offer = apply(client, f, db, p, n)
    assert decide(client, org, m, "reject").status_code == 200
    db.refresh(m)
    db.refresh(offer)
    db.refresh(n)
    assert m.status == MembershipStatus.rejected and offer.stage == OfferStage.declined and n.status == NeedStatus.open
    assert decide(client, org, m, "reject").status_code == 200
    assert decide(client, org, m, "approve").status_code == 409
    _, reapplied, new_offer = apply(client, f, db, p, n, person)
    assert reapplied.id == m.id and new_offer.id != offer.id and reapplied.status == MembershipStatus.pending


def test_rejecting_approved_helper_releases_booking_and_need(client, f, db):
    org, p, n = program(f, db)
    _, m, offer = apply(client, f, db, p, n)
    assert decide(client, org, m, "approve").status_code == 200
    assert decide(client, org, m, "reject").status_code == 200
    db.refresh(m)
    db.refresh(offer)
    db.refresh(n)
    assert m.status == MembershipStatus.rejected and offer.stage == OfferStage.declined and n.status == NeedStatus.open
    assert db.scalar(select(Booking).where(Booking.offer_id == offer.id)) is None


def test_booking_clash_rolls_back_both_records_and_need(client, f, db):
    org, p, n = program(f, db)
    person, m, _ = apply(client, f, db, p, n)
    assert decide(client, org, m, "approve").status_code == 200
    _, p2, n2 = program(f, db, org)
    n2.slot_start, n2.slot_end = n.slot_start, n.slot_end
    db.flush()
    _, m2, o2 = apply(client, f, db, p2, n2, person)
    response = decide(client, org, m2, "approve")
    assert response.status_code == 409 and response.json()["code"] == "booking_conflict"
    db.refresh(m2)
    db.refresh(o2)
    db.refresh(n2)
    assert (m2.status, o2.stage, n2.status) == (MembershipStatus.pending, OfferStage.offered, NeedStatus.open)
    assert db.scalar(select(Booking).where(Booking.offer_id == o2.id)) is None


def test_access_control_and_participant_cannot_be_reviewed(client, f, db):
    org, p, n = program(f, db)
    person, m, _ = apply(client, f, db, p, n)
    other_org = f.user(UserRole.organizer, "Other organizer")
    for decision in ("approve", "reject"):
        assert decide(client, other_org, m, decision).status_code == 403
        assert decide(client, person, m, decision).status_code == 403
        assert client.post(f"/api/memberships/{m.id}/{decision}").status_code == 401
    assert client.get(f"/api/projects/{p.id}/memberships", headers=auth(other_org)).status_code == 403
    attendee = f.user(UserRole.general, "Attendee")
    assert (
        client.post(f"/api/events/{p.id}/join", headers=auth(attendee), json={"role": "participant"}).status_code == 204
    )
    member = db.scalar(select(EventMembership).where(EventMembership.user_id == attendee.id))
    assert decide(client, org, member, "reject").status_code == 409


@pytest.mark.parametrize("closed", ["withdrawn", "past", "complete"])
def test_stale_applications_cannot_be_approved(client, f, db, closed):
    org, p, n = program(f, db)
    person, m, offer = apply(client, f, db, p, n)
    if closed == "withdrawn":
        assert client.post(f"/api/offers/{offer.id}/withdraw", headers=auth(person)).status_code == 204
    elif closed == "past":
        p.event_date = datetime.now(UTC).date() - timedelta(days=2)
    else:
        p.status = ProjectStatus.complete
    db.flush()
    assert decide(client, org, m, "approve").status_code == 409
    db.refresh(offer)
    assert offer.stage != OfferStage.accepted


def test_direct_offer_decisions_also_sync_membership(client, f, db):
    org, p, n = program(f, db)
    _, m, offer = apply(client, f, db, p, n)
    assert client.post(f"/api/offers/{offer.id}/accept", headers=auth(org)).status_code == 200
    db.refresh(m)
    assert m.status == MembershipStatus.approved
    assert client.post(f"/api/offers/{offer.id}/decline", headers=auth(org)).status_code == 200
    db.refresh(m)
    db.refresh(n)
    assert m.status == MembershipStatus.rejected and n.status == NeedStatus.open


def test_old_incomplete_approval_can_be_confirmed(client, f, db):
    org, p, n = program(f, db)
    _, m, offer = apply(client, f, db, p, n)
    m.status = MembershipStatus.approved  # reproduces the previous endpoint's bug
    db.flush()
    assert decide(client, org, m, "approve").status_code == 200
    db.refresh(offer)
    assert offer.stage == OfferStage.accepted
    assert db.scalar(select(Booking.id).where(Booking.offer_id == offer.id))


def test_approved_contributor_can_withdraw_and_free_the_need(client, f, db):
    org, p, n = program(f, db)
    person, m, offer = apply(client, f, db, p, n)
    assert decide(client, org, m, "approve").status_code == 200
    assert client.post(f"/api/offers/{offer.id}/withdraw", headers=auth(person)).status_code == 204
    db.refresh(m)
    db.refresh(offer)
    db.refresh(n)
    assert m.status == MembershipStatus.rejected and offer.stage == OfferStage.withdrawn and n.status == NeedStatus.open
    assert db.scalar(select(Booking.id).where(Booking.offer_id == offer.id)) is None


def test_sponsor_selected_for_same_need_rejects_pending_helper(client, f, db):
    org, p, n = program(f, db)
    _, m, helper_offer = apply(client, f, db, p, n)
    sponsor = f.user(UserRole.sponsor, "Sponsor")
    offer = Offer(
        need_id=n.id, from_user_id=sponsor.id, stage=OfferStage.offered, slot_start=n.slot_start, slot_end=n.slot_end
    )
    db.add(offer)
    db.flush()
    assert client.post(f"/api/offers/{offer.id}/accept", headers=auth(org)).status_code == 200
    db.refresh(m)
    db.refresh(helper_offer)
    assert m.status == MembershipStatus.rejected and helper_offer.stage == OfferStage.declined
