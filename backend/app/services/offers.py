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
    Withdrawing an accepted offer reopens the need and deletes the booking."""
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
