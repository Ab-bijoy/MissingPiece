"""Idempotent, authenticated offer expiry. Dates use the event timezone."""

import secrets
from typing import Annotated

from fastapi import APIRouter, Header
from sqlalchemy import delete, select

from app.auth import DB
from app.config import get_settings
from app.errors import ApiError
from app.models import Booking, EventMembership, Need, Offer, Project, SponsorRequest
from app.models.enums import MembershipStatus, NeedStatus, NotificationType, OfferStage
from app.services.community import local_today
from app.services.notifications import notify

router = APIRouter(prefix="/api/internal/jobs", tags=["jobs"])


@router.post("/expire-offers")
def expire_offers(db: DB, jobs_secret: Annotated[str | None, Header(alias="JOBS_SECRET")] = None):
    settings = get_settings()
    if settings.is_placeholder(settings.jobs_secret) or not secrets.compare_digest(
        jobs_secret or "",
        settings.jobs_secret,
    ):
        raise ApiError(401, "Invalid job credentials.", "unauthenticated")
    count = 0
    today = local_today()
    offers = db.scalars(
        select(Offer)
        .where(Offer.stage.in_((OfferStage.offered, OfferStage.accepted)))
        .order_by(Offer.id)
        .with_for_update(skip_locked=True)
    ).all()
    for o in offers:
        n = db.scalar(select(Need).where(Need.id == o.need_id).with_for_update())
        p = db.get(Project, n.project_id)
        request = db.get(SponsorRequest, o.request_id) if o.request_id else None
        deadlines = [p.event_date, n.deadline]
        if request:
            deadlines.append(request.decide_by if o.stage == OfferStage.offered else request.deliver_by)
        if not any(d and d < today for d in deadlines):
            continue
        if o.stage == OfferStage.accepted:
            n.status = NeedStatus.open
        o.stage = OfferStage.expired
        db.execute(delete(Booking).where(Booking.offer_id == o.id))
        m = db.scalar(select(EventMembership).where(EventMembership.offer_id == o.id))
        if m:
            m.status = MembershipStatus.rejected
        for recipient in {o.from_user_id, p.organizer_id}:
            notify(db, recipient, NotificationType.offer_expired, o.id, f"The offer for {n.title} has expired.")
        count += 1
    db.commit()
    return {"expired": count}
