import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field, model_validator

from app.models.enums import NeedType
from app.schemas.common import EventFacts, NeedOut, Num, OfferOut, Schema


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
    # For money the amount is in BDT, so the unit is not asked for (always "BDT")
    unit: str = Field(default="", max_length=60)
    budget_item: str | None = Field(default=None, max_length=120)
    slot_start: datetime | None = None
    slot_end: datetime | None = None
    deadline: date | None = None

    @model_validator(mode="after")
    def money_is_in_bdt(self):
        if self.type == NeedType.money:
            self.unit = "BDT"
        elif not self.unit.strip():
            raise ValueError("Say the unit, for example packs or hours")
        return self


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
    open_needs: int = 0
    total_needs: int = 0


class ProjectDetailOut(EventFacts):
    organizer_id: uuid.UUID
    template_id: uuid.UUID | None
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


class GapRowOut(BaseModel):
    """One need on the gaps panel."""

    need_id: uuid.UUID
    title: str
    type: str
    quantity: Num
    unit: str
    state: Literal["open", "covered", "received"]
    booked: bool
    covered_by: str | None
    note: str | None


class GapsOut(BaseModel):
    needs: list[GapRowOut]
    summary: str


class ReadinessCheckOut(BaseModel):
    key: Literal["plan", "commitments", "items", "activity"]
    label: str
    ok: bool
    value: str
    detail: str


class ReadinessOut(BaseModel):
    checks: list[ReadinessCheckOut]
    can_complete: bool


class ProjectReportOut(BaseModel):
    """Totals only: no names, emails, phones or other personal details (rule 12)."""

    people_taking_part: int
    sessions_held: int
    money_received: Num
    items_received: list[str]
    needs_total: int
    needs_received: int


class OfferConflictOut(BaseModel):
    offer_ids: list[uuid.UUID]
    reason: str


class OfferListOut(BaseModel):
    offers: list[OfferOut]
    conflicts: list[OfferConflictOut]


class SponsorMatchOut(Schema):
    id: uuid.UUID
    project_id: uuid.UUID
    sponsor_id: uuid.UUID
    sponsor_user_id: uuid.UUID | None = None
    sponsor_name: str
    score: int
    reason: str
    status: str


class SponsorMatchListOut(BaseModel):
    matches: list[SponsorMatchOut]
    requests_left: int


class BenefitGivenIn(BaseModel):
    given: bool


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
    id: uuid.UUID  # the screens read `id` and `thread_id`
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
