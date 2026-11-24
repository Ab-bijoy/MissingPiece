"""Atomic organizer decisions on contributor memberships and their offers."""

from datetime import UTC, datetime

from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError, OperationalError

from app.errors import ApiError, forbidden, not_found
from app.models import Booking, EventMembership, Need, Offer, Project
from app.models.enums import MembershipRole, MembershipStatus, NeedStatus, NotificationType, OfferStage, ProjectStatus
from app.services.community import local_today
from app.services.notifications import notify
from app.services.schedules import schedule_error


def decide(db, user, membership_id, approve):
    try:
        return _decide(db, user, membership_id, approve)
    except IntegrityError:
        db.rollback()
        raise ApiError(
            409,
            "This helper or resource is already booked, or the need was just filled. Refresh and try again.",
            "booking_conflict",
        ) from None
    except OperationalError as exc:
        db.rollback()
        if getattr(exc.orig, "sqlstate", None) in {"55P03", "40P01", "40001"}:
            raise ApiError(
                409, "This application is being updated. Refresh and try again.", "concurrent_update"
            ) from None
        raise


def _decide(db, user, membership_id, approve):
    m = db.get(EventMembership, membership_id)
    if m is None:
        raise not_found("Application")
    p = db.get(Project, m.project_id)
    if p.organizer_id != user.id:
        raise forbidden("You do not own this project.")
    if m.role != MembershipRole.contributor or not m.offer_id:
        raise ApiError(409, "Only contributor applications can be reviewed here.", "not_contributor")
    offer_id = m.offer_id
    found = db.get(Offer, offer_id)
    if found is None:
        raise not_found("Contributor offer")
    # Serialize decisions for a need. NOWAIT avoids deadlocks with withdrawal
    # and expiry, which can already hold an offer lock when requesting the need.
    need = db.scalar(
        select(Need)
        .where(Need.id == found.need_id)
        .with_for_update(nowait=True)
        .execution_options(populate_existing=True)
    )
    offers = list(
        db.scalars(
            select(Offer)
            .where(Offer.need_id == need.id)
            .order_by(Offer.id)
            .with_for_update(nowait=True)
            .execution_options(populate_existing=True)
        )
    )
    members = list(
        db.scalars(
            select(EventMembership)
            .where(EventMembership.offer_id.in_([o.id for o in offers]))
            .order_by(EventMembership.id)
            .with_for_update(nowait=True)
            .execution_options(populate_existing=True)
        )
    )
    member_by_offer = {member.offer_id: member for member in members}
    m = member_by_offer.get(offer_id)
    o = next(o for o in offers if o.id == offer_id)
    if (
        not m
        or m.id != membership_id
        or m.user_id != o.from_user_id
        or m.project_id != need.project_id
        or not o.contribution_role
    ):
        raise ApiError(409, "This application has changed. Refresh the list.", "stale_application")
    desired = MembershipStatus.approved if approve else MembershipStatus.rejected
    target_stage = OfferStage.accepted if approve else OfferStage.declined
    if m.status == desired and o.stage == target_stage:
        return m  # Retry: do not create another booking or notification.
    if o.stage not in (OfferStage.offered, OfferStage.accepted):
        raise ApiError(409, "This application is no longer awaiting a decision.", "invalid_stage")
    if approve:
        if m.status == MembershipStatus.rejected:
            raise ApiError(
                409, "A rejected application cannot be approved. The contributor must apply again.", "invalid_stage"
            )
        if (
            p.status != ProjectStatus.live
            or p.event_date < local_today()
            or (need.deadline and need.deadline < local_today())
        ):
            raise ApiError(409, "This program is no longer accepting contributions.", "closed")
        if not o.slot_start or not o.slot_end or o.slot_end <= datetime.now(UTC):
            raise ApiError(409, "The contribution time slot is missing or has ended.", "invalid_slot")
        if schedule_error(need.type, need.slot_start, need.slot_end):
            raise ApiError(409, "Set a valid need schedule before approving contributors.", "invalid_slot")
        if o.slot_start < need.slot_start or o.slot_end > need.slot_end:
            raise ApiError(
                409,
                "This application's time no longer fits the need schedule. Ask the contributor to reapply.",
                "invalid_slot",
            )
        if o.stage == OfferStage.offered:
            if need.status != NeedStatus.open or any(
                other.stage in (OfferStage.accepted, OfferStage.received) for other in offers
            ):
                raise ApiError(409, "This need is already covered.", "need_covered")
            db.add(
                Booking(
                    offer_id=o.id,
                    resource_key=f"item:{o.from_user_id}:{o.resource.strip().lower()}"
                    if o.resource
                    else f"user:{o.from_user_id}",
                    slot_start=o.slot_start,
                    slot_end=o.slot_end,
                )
            )
        need.status = NeedStatus.covered
        for other in offers:
            if other.id != o.id and other.stage == OfferStage.offered:
                other.stage = OfferStage.declined
                other_member = member_by_offer.get(other.id)
                if other_member:
                    other_member.status = MembershipStatus.rejected
                notify(
                    db,
                    other.from_user_id,
                    NotificationType.membership_rejected if other_member else NotificationType.offer_declined,
                    other_member.id if other_member else other.id,
                    f"Another application was selected for {need.title} in {p.name}.",
                )
    elif o.stage == OfferStage.accepted:
        db.execute(delete(Booking).where(Booking.offer_id == o.id))
        if not any(other.id != o.id and other.stage in (OfferStage.accepted, OfferStage.received) for other in offers):
            need.status = NeedStatus.open
    m.status = desired
    o.stage = target_stage
    notify(
        db,
        m.user_id,
        NotificationType.membership_approved if approve else NotificationType.membership_rejected,
        m.id,
        f"Your contribution to {p.name} was {'approved' if approve else 'rejected'}.",
    )
    db.commit()
    return m
