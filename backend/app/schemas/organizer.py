import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field

from app.models.enums import NeedType
from app.schemas.common import EventFacts, NeedOut, Num, Schema


class DefaultNeedSpec(BaseModel):
    type: NeedType
    title: str = Field(..., min_length=1, max_length=200)
    quantity: Num = Field(..., gt=0)
    unit: str = Field(..., min_length=1, max_length=60)
    budget_item: str | None = Field(default=None, max_length=120)


class TemplateOut(Schema):
    id: uuid.UUID
    name: str
    project_type: str
    blurb: str
    default_needs: list[DefaultNeedSpec]
    status: str


class NeedCreateIn(BaseModel):
    type: NeedType
    title: str = Field(..., min_length=1, max_length=200)
    quantity: Decimal = Field(..., gt=0)
    unit: str = Field(..., min_length=1, max_length=60)
    budget_item: str | None = Field(default=None, max_length=120)
    slot_start: datetime | None = None
    slot_end: datetime | None = None
    deadline: date | None = None


class ProjectCreateIn(BaseModel):
    template_id: uuid.UUID | None = None
    name: str = Field(..., min_length=1, max_length=200)
    purpose: str = Field(..., min_length=1)
    description: str = Field(..., min_length=1)
    event_date: date
    venue: str = Field(..., min_length=1, max_length=200)
    audience: int = Field(..., ge=0)
    institution: str | None = Field(default=None, max_length=200)
    needs: list[NeedCreateIn] = Field(default_factory=list)


class ProjectUpdateIn(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    purpose: str | None = Field(default=None, min_length=1)
    description: str | None = Field(default=None, min_length=1)
    event_date: date | None = None
    venue: str | None = Field(default=None, min_length=1, max_length=200)
    audience: int | None = Field(default=None, ge=0)
    institution: str | None = Field(default=None, max_length=200)


class ProjectSummaryOut(Schema):
    id: uuid.UUID
    organizer_id: uuid.UUID
    template_id: uuid.UUID | None
    name: str
    purpose: str
    event_date: date
    venue: str
    audience: int
    institution: str | None
    status: str
    created_at: datetime


class ProjectDetailOut(EventFacts):
    purpose: str
    description: str
    needs: list[NeedOut]


class NeedUpdateIn(BaseModel):
    type: NeedType | None = None
    title: str | None = Field(default=None, min_length=1, max_length=200)
    quantity: Decimal | None = Field(default=None, gt=0)
    unit: str | None = Field(default=None, min_length=1, max_length=60)
    budget_item: str | None = Field(default=None, max_length=120)
    slot_start: datetime | None = None
    slot_end: datetime | None = None
    deadline: date | None = None


class NeedGapItem(BaseModel):
    need_id: uuid.UUID
    title: str
    type: str
    unit: str
    required: Num
    accepted: Num
    received: Num
    still_needed: Num
    status: str


class ProjectGapsOut(Schema):
    project_id: uuid.UUID
    summary: str
    items: list[NeedGapItem]


class ReadinessCheckItem(BaseModel):
    key: Literal["plan_works", "commitments_covered", "items_received", "activity_confirmed"]
    label: str
    passed: bool
    detail: str


class ProjectReadinessOut(Schema):
    project_id: uuid.UUID
    ready: bool
    checks: list[ReadinessCheckItem]


class ProjectReportOut(Schema):
    """Totals only — no names, emails, phones, or other PII."""

    project_id: uuid.UUID
    project_name: str
    status: str
    needs_total: int
    needs_covered: int
    offers_total: int
    offers_accepted: int
    offers_received: int
    committed_amount: Num
    received_amount: Num


class SponsorMatchOut(Schema):
    id: uuid.UUID
    project_id: uuid.UUID
    sponsor_id: uuid.UUID
    sponsor_user_id: uuid.UUID | None = None
    sponsor_name: str
    score: int
    reason: str
    status: str


class SponsorRequestCreateIn(BaseModel):
    sponsor_id: uuid.UUID | None = None
    sponsor_user_id: uuid.UUID | None = None
    match_id: uuid.UUID | None = None
    need_id: uuid.UUID | None = None
    benefits: list[str] = Field(default_factory=list)
    conditions: str | None = Field(default=None, max_length=2000)
    exclusive_category: str | None = Field(default=None, max_length=60)
    decide_by: date | None = None
    deliver_by: date | None = None


class SponsorRequestOut(Schema):
    request_id: uuid.UUID
    project_id: uuid.UUID
    need_id: uuid.UUID | None = None
    sponsor_id: uuid.UUID
    thread_id: uuid.UUID | None = None
    status: str


class OfferBenefitOut(Schema):
    id: uuid.UUID
    offer_id: uuid.UUID
    label: str
    given: bool
    given_at: datetime | None = None


class OrganizerOfferOut(Schema):
    id: uuid.UUID
    need_id: uuid.UUID
    need_title: str
    need_type: str
    project_id: uuid.UUID
    stage: str
    amount: Num | None = None
    conditions: str | None = None
    exclusive_category: str | None = None
    conflicting: bool = False
    received_at: datetime | None = None
    benefits: list[OfferBenefitOut] = []


class BookingOut(Schema):
    id: uuid.UUID
    offer_id: uuid.UUID
    resource_key: str
    slot_start: datetime
    slot_end: datetime


class ProjectMemberOut(Schema):
    id: uuid.UUID
    project_id: uuid.UUID
    user_id: uuid.UUID
    name: str
    role: str
    status: str
    offer_id: uuid.UUID | None = None


class CommentModerationOut(Schema):
    id: uuid.UUID
    project_id: uuid.UUID
    user_id: uuid.UUID
    kind: str
    body: str
    status: str


class ThreadSummaryOut(Schema):
    id: uuid.UUID
    request_id: uuid.UUID
    organizer_id: uuid.UUID
    sponsor_id: uuid.UUID
    last_message: str | None = None


class MessageCreateIn(BaseModel):
    body: str = Field(..., min_length=1, max_length=4000)


class MessageOut(Schema):
    id: uuid.UUID
    thread_id: uuid.UUID
    sender_id: uuid.UUID
    body: str
    read: bool
    created_at: datetime | None = None