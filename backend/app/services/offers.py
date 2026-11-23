"""Offer changes shared by sponsors and contributors."""

import uuid

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.errors import ApiError, forbidden, must, not_found
from app.models import AppUser, Booking, EventMembership, Need, Offer, Project
from app.models.enums import MembershipStatus, NeedStatus, NotificationType, OfferStage
from app.services.notifications import notify


def withdraw(db: Session, user: AppUser, offer_id: uuid.UUID) -> None:
    """Rule 7: allowed while offered or accepted, never after received.
    Withdrawing an accepted offer reopens the need and deletes the booking.
    Not while a payment for the offer is in progress: the money could still arrive."""
    from app.services.payments import payment_in_progress  # payments imports this module's neighbours

    found = db.get(Offer, offer_id)
    if found is not None and found.from_user_id == user.id and found.stage == OfferStage.accepted:
        if payment_in_progress(db, found) is not None:  # may also settle a finished payment
            raise ApiError(
                409,
                "Your payment for this offer is still in progress, so it cannot be withdrawn now. "
                "If you closed the payment page, try again in 15 minutes.",
                "payment_in_progress",
            )
        db.expire_all()
    o = db.scalar(select(Offer).where(Offer.id == offer_id).with_for_update())
    if o is None:
        raise not_found("Offer")
    if o.from_user_id != user.id:
        raise forbidden("You can only withdraw your own offers.")
    if o.stage == OfferStage.received:
        raise ApiError(409, "This offer was already received, so it cannot be withdrawn.", "already_received")
    if o.stage not in (OfferStage.offered, OfferStage.accepted):
        raise ApiError(409, "This offer is no longer open.", "bad_stage")

    need = must(db.scalar(select(Need).where(Need.id == o.need_id).with_for_update()), "Need")
    if o.stage == OfferStage.accepted:
        need.status = NeedStatus.open
        db.execute(delete(Booking).where(Booking.offer_id == o.id))
    o.stage = OfferStage.withdrawn
    membership = db.scalar(select(EventMembership).where(EventMembership.offer_id == o.id))
    if membership:
        membership.status = MembershipStatus.rejected

    project = must(db.get(Project, need.project_id), "Project")
    notify(
        db,
        project.organizer_id,
        NotificationType.offer_withdrawn,
        o.id,
        f"{user.name} withdrew their offer for {need.title}.",
    )
    db.commit()
