"""Organizer: see the requests already sent for a project, and find sponsors to ask.

GET /api/projects/{id}/requests   every request sent for the project, with its state
GET /api/sponsors/search          active sponsors on the platform, by name or interest

Both are for the project's organizer only. Search shows what a sponsor chose to make
public on their profile (company, industry, location, interests): never their
contact person, phone, email or trade licence.
"""

import uuid
from typing import Literal

from fastapi import APIRouter, Query
from pydantic import BaseModel
from sqlalchemy import String, cast, exists, func, or_, select, true
from sqlalchemy.orm import aliased

from app.auth import DB, Organizer
from app.errors import ApiError, forbidden, not_found
from app.models import AppUser, MessageThread, Need, Offer, Project, SponsorProfile, SponsorRequest
from app.models.enums import AccountStatus, OfferStage, UserRole

router = APIRouter(prefix="/api", tags=["organizer"])

RequestState = Literal["waiting", "offer_received", "accepted", "received", "declined", "withdrawn", "expired"]
STATE_OF_STAGE: dict[OfferStage, RequestState] = {
    OfferStage.offered: "offer_received",
    OfferStage.accepted: "accepted",
    OfferStage.received: "received",
    OfferStage.declined: "declined",
    OfferStage.withdrawn: "withdrawn",
    OfferStage.expired: "expired",
}


class SentRequestOut(BaseModel):
    id: uuid.UUID
    need_id: uuid.UUID
    need_title: str
    sponsor_id: uuid.UUID
    sponsor_name: str
    created_at: str
    decide_by: str | None
    state: RequestState
    offer_id: uuid.UUID | None
    thread_id: uuid.UUID | None


class SponsorSearchOut(BaseModel):
    id: uuid.UUID  # the sponsor's account id, used as sponsor_id when sending a request
    name: str
    industry: str | None
    location: str | None
    interests: list[str]
    requested: bool  # already asked for something in this project


def _owned(db, project_id: uuid.UUID, user: AppUser) -> Project:
    p = db.get(Project, project_id)
    if p is None:
        raise not_found("Project")
    if p.organizer_id != user.id:
        raise forbidden("You do not own this project.")
    return p


@router.get("/projects/{project_id}/requests", response_model=list[SentRequestOut])
def sent_requests(project_id: uuid.UUID, user: Organizer, db: DB):
    """Every request sent for this project, newest first: one query."""
    p = _owned(db, project_id, user)
    latest = (
        select(Offer.id, Offer.stage)
        .where(Offer.request_id == SponsorRequest.id)
        .order_by(Offer.created_at.desc())
        .limit(1)
        .correlate(SponsorRequest)
        .lateral("latest")
    )
    sponsor = aliased(AppUser)
    thread_id = (
        select(MessageThread.id)
        .where(MessageThread.request_id == SponsorRequest.id)
        .correlate(SponsorRequest)
        .scalar_subquery()
    )
    rows = db.execute(
        select(SponsorRequest, Need.title, sponsor.name, SponsorProfile.company, latest.c.id, latest.c.stage, thread_id)
        .join(Need, Need.id == SponsorRequest.need_id)
        .join(sponsor, sponsor.id == SponsorRequest.sponsor_id)
        .outerjoin(SponsorProfile, SponsorProfile.user_id == sponsor.id)
        .outerjoin(latest, true())
        .where(SponsorRequest.project_id == p.id)
        .order_by(SponsorRequest.created_at.desc(), SponsorRequest.id)
    ).all()
    return [
        SentRequestOut(
            id=r.id,
            need_id=r.need_id,
            need_title=title,
            sponsor_id=r.sponsor_id,
            sponsor_name=company or name or "Sponsor",
            created_at=r.created_at.isoformat(),
            decide_by=r.decide_by.isoformat() if r.decide_by else None,
            state=STATE_OF_STAGE.get(stage, "waiting") if stage else "waiting",
            offer_id=offer_id,
            thread_id=thread,
        )
        for r, title, name, company, offer_id, stage, thread in rows
    ]


@router.get("/sponsors/search", response_model=list[SponsorSearchOut])
def search_sponsors(
    user: Organizer,
    db: DB,
    project_id: uuid.UUID,
    q: str = Query("", max_length=100),
    limit: int = Query(20, ge=1, le=50),
):
    """Active sponsors whose company, industry, location or interests contain the words typed."""
    p = _owned(db, project_id, user)
    requested = exists().where(SponsorRequest.project_id == p.id, SponsorRequest.sponsor_id == AppUser.id)
    stmt = (
        select(AppUser.id, AppUser.name, SponsorProfile, requested.label("requested"))
        .outerjoin(SponsorProfile, SponsorProfile.user_id == AppUser.id)
        .where(AppUser.role == UserRole.sponsor, AppUser.status == AccountStatus.active)
    )
    for word in q.split()[:5]:
        # The words are data, never SQL: wildcards typed by the user match themselves
        like = "%" + word.lower().replace("\\", "\\\\").replace("%", r"\%").replace("_", r"\_") + "%"
        stmt = stmt.where(
            or_(
                func.lower(AppUser.name).like(like, escape="\\"),
                func.lower(SponsorProfile.company).like(like, escape="\\"),
                func.lower(SponsorProfile.industry).like(like, escape="\\"),
                func.lower(SponsorProfile.location).like(like, escape="\\"),
                func.lower(cast(SponsorProfile.interests, String)).like(like, escape="\\"),
            )
        )
    rows = db.execute(stmt.order_by(func.lower(func.coalesce(SponsorProfile.company, AppUser.name))).limit(limit)).all()
    return [
        SponsorSearchOut(
            id=uid,
            name=(prof.company if prof else None) or name,
            industry=prof.industry if prof else None,
            location=prof.location if prof else None,
            interests=list(prof.interests or []) if prof else [],
            requested=bool(asked),
        )
        for uid, name, prof, asked in rows
    ]


def check_not_duplicate(db, project_id: uuid.UUID, need_id: uuid.UUID, sponsor_id: uuid.UUID) -> None:
    """One request per sponsor per need (also a database rule): say so plainly."""
    if db.scalar(
        select(SponsorRequest.id).where(
            SponsorRequest.project_id == project_id,
            SponsorRequest.need_id == need_id,
            SponsorRequest.sponsor_id == sponsor_id,
        )
    ):
        raise ApiError(409, "You already asked this sponsor for this need.", "duplicate_request")
