"""Organizer profile, and the sponsor profile an organizer may look at.

GET   /api/organizer/profile        the organizer's own organization details
PATCH /api/organizer/profile        change name, contact person or phone
GET   /api/sponsors/{sponsor_id}    a sponsor's public profile (for organizers)

The organization type and registration number were checked by an admin, so they
cannot be changed here. A sponsor's public profile never includes their contact
person, phone, email or trade licence: organizers reach sponsors through Messages.
"""

import uuid
from datetime import datetime

from fastapi import APIRouter
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import func, select

from app.auth import DB, Organizer
from app.errors import ApiError, not_found
from app.models import AppUser, Need, Offer, OrganizerProfile, Project, SponsorProfile
from app.models.enums import AccountStatus, OfferStage, UserRole
from app.schemas.common import clean_phone

router = APIRouter(prefix="/api", tags=["organizer"])


class OrganizerProfileOut(BaseModel):
    org_name: str
    org_type: str
    registration_number: str
    contact_person: str
    phone: str
    email: str
    status: str


class OrganizerProfileIn(BaseModel):
    org_name: str | None = Field(default=None, max_length=200)
    contact_person: str | None = Field(default=None, max_length=200)
    phone: str | None = Field(default=None, max_length=40)

    @field_validator("org_name", "contact_person")
    @classmethod
    def not_blank(cls, v: str | None) -> str | None:
        if v is not None and not v.strip():
            raise ValueError("Please fill this in")
        return v.strip() if v is not None else None

    @field_validator("phone")
    @classmethod
    def check_phone(cls, v: str | None) -> str | None:
        return None if v is None else clean_phone(v)


class SponsorPublicProfileOut(BaseModel):
    id: uuid.UUID
    name: str
    industry: str | None
    location: str | None
    interests: list[str]
    preferred_types: list[str]
    description: str | None
    member_since: datetime
    # Totals only: how many contributions this sponsor has delivered on MissingPiece
    contributions_received: int
    projects_supported: int


def _organizer_profile(db, user: AppUser) -> OrganizerProfile:
    prof = db.scalar(select(OrganizerProfile).where(OrganizerProfile.user_id == user.id))
    if prof is None:
        raise ApiError(404, "No organization profile yet. Finish registering first.", "no_profile")
    return prof


def _out(user: AppUser, prof: OrganizerProfile) -> OrganizerProfileOut:
    return OrganizerProfileOut(
        org_name=prof.org_name,
        org_type=prof.org_type.value,
        registration_number=prof.registration_number,
        contact_person=prof.contact_person,
        phone=prof.phone,
        email=user.email,
        status=user.status.value,
    )


@router.get("/organizer/profile", response_model=OrganizerProfileOut)
def get_organizer_profile(user: Organizer, db: DB):
    return _out(user, _organizer_profile(db, user))


@router.patch("/organizer/profile", response_model=OrganizerProfileOut)
def update_organizer_profile(body: OrganizerProfileIn, user: Organizer, db: DB):
    prof = _organizer_profile(db, user)
    changes = body.model_dump(exclude_unset=True, exclude_none=True)
    for key, value in changes.items():
        setattr(prof, key, value)
    if "org_name" in changes:
        user.name = prof.org_name  # the name shown on projects, offers and messages
    db.commit()
    return _out(user, prof)


@router.get("/sponsors/{sponsor_id}", response_model=SponsorPublicProfileOut)
def sponsor_public_profile(sponsor_id: uuid.UUID, user: Organizer, db: DB):
    row = db.execute(
        select(AppUser, SponsorProfile)
        .outerjoin(SponsorProfile, SponsorProfile.user_id == AppUser.id)
        .where(AppUser.id == sponsor_id, AppUser.role == UserRole.sponsor, AppUser.status == AccountStatus.active)
    ).first()
    if row is None:
        raise not_found("Sponsor")
    sponsor, prof = row
    received = (
        select(func.count(Offer.id), func.count(func.distinct(Need.project_id)))
        .join(Need, Need.id == Offer.need_id)
        .join(Project, Project.id == Need.project_id)
        .where(Offer.from_user_id == sponsor.id, Offer.stage == OfferStage.received)
    )
    contributions, projects = db.execute(received).one()
    return SponsorPublicProfileOut(
        id=sponsor.id,
        name=(prof.company if prof else None) or sponsor.name,
        industry=prof.industry if prof else None,
        location=prof.location if prof else None,
        interests=list(prof.interests or []) if prof else [],
        preferred_types=list(prof.preferred_types or []) if prof else [],
        description=prof.description if prof else None,
        member_since=sponsor.created_at,
        contributions_received=contributions or 0,
        projects_supported=projects or 0,
    )
