"""Auth and registration (build prompt 7.1)."""

import uuid

from pydantic import BaseModel, Field

from app.schemas.common import Schema


class OrganizerProfileOut(Schema):
    org_name: str
    org_type: str
    registration_number: str
    contact_person: str
    phone: str


class SponsorProfileShort(Schema):
    company: str
    industry: str
    trade_license_number: str
    contact_person: str
    phone: str
    interests: list[str]
    preferred_types: list[str]
    location: str | None
    description: str | None


class MeOut(Schema):
    """GET /auth/me: role, status, profile and rejection note."""

    id: uuid.UUID
    email: str
    role: str
    status: str
    name: str
    age: int | None
    rejection_note: str | None
    profile: OrganizerProfileOut | SponsorProfileShort | None


class RegisterUserIn(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    age: int | None = Field(default=None, ge=0, le=130)
