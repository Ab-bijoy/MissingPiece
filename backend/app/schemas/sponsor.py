"""Sponsor request and response models (build prompt 7.4)."""

import uuid
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator

from app.models.enums import NeedType
from app.schemas.common import BenefitOut, EventFacts, NeedOut, Num, OfferOut, Schema

RequestState = Literal["new", "offer_sent", "accepted", "received", "covered_by_other", "withdrawn", "expired"]


class SponsorRequestSummary(Schema):
    id: uuid.UUID
    project_id: uuid.UUID
    project_name: str
    need_title: str
    need_amount: str
    state: RequestState
    decide_by: date | None
    created_at: datetime


class SponsorRequestDetail(Schema):
    id: uuid.UUID
    project: EventFacts
    need: NeedOut
    benefits: list[str]
    conditions: str | None
    exclusive_category: str | None
    decide_by: date | None
    deliver_by: date | None
    state: RequestState
    thread_id: uuid.UUID | None
    my_offer: OfferOut | None


class OfferIn(BaseModel):
    """POST /requests/{id}/offers. One offer covers the whole need (rule 1)."""

    conditions: str | None = Field(default=None, max_length=2000)
    exclusive_category: str | None = Field(default=None, max_length=60)
    # Money offers only; must equal the need amount
    amount: Num | None = None


class SponsorOfferRow(Schema):
    id: uuid.UUID
    request_id: uuid.UUID | None
    project_id: uuid.UUID
    project_name: str
    need_title: str
    need_type: str
    offer_text: str
    amount: Num | None
    stage: str
    benefits_given: int
    benefits_total: int
    payment_status: str | None
    project_status: str


class PaymentQuote(Schema):
    offer_id: uuid.UUID
    project_name: str
    organizer_name: str
    need_title: str
    amount: Num
    commission: Num
    total: Num
    last_payment_status: str | None


class PaymentIn(BaseModel):
    method: Literal["wallet", "card", "bank"] = "wallet"


class PaymentStart(Schema):
    payment_id: uuid.UUID
    checkout_url: str


class Contribution(Schema):
    what: str
    need_title: str
    received_at: datetime | None


class ReportResults(Schema):
    people_taking_part: int
    contributors: int
    sessions_held: int
    needs_covered: int
    needs_total: int


class SponsorReport(Schema):
    """Totals only. Never names, emails, ages or phone numbers (rule 12)."""

    project: EventFacts
    contribution: Contribution
    benefits: list[BenefitOut]
    results: ReportResults
    note: str | None


class SponsorProfileOut(Schema):
    company: str
    industry: str
    trade_license_number: str
    contact_person: str
    phone: str
    interests: list[str]
    preferred_types: list[str]
    location: str | None
    description: str | None


class SponsorProfileIn(BaseModel):
    """PATCH /sponsor/profile. The trade licence number was checked by an admin, so it cannot change here."""

    company: str | None = Field(default=None, min_length=1, max_length=200)
    industry: str | None = Field(default=None, min_length=1, max_length=120)
    contact_person: str | None = Field(default=None, min_length=1, max_length=200)
    phone: str | None = Field(default=None, min_length=5, max_length=40)
    interests: list[str] | None = Field(default=None, max_length=30)
    preferred_types: list[NeedType] | None = None
    location: str | None = Field(default=None, max_length=120)
    description: str | None = Field(default=None, max_length=2000)

    @field_validator("interests")
    @classmethod
    def clean_interests(cls, v: list[str] | None) -> list[str] | None:
        if v is None:
            return v
        out: list[str] = []
        for i in v:
            i = i.strip()[:60]
            if i and i.lower() not in (x.lower() for x in out):
                out.append(i)
        return out


class EventSummary(EventFacts):
    still_needed: list[str]
    open_needs: int
    needs_money: bool


class EventNeed(NeedOut):
    state: Literal["open", "covered", "received"]


class EventDetail(EventFacts):
    my_membership: dict | None = None
    my_offer_id: uuid.UUID | None = None
    comment_count: int = 0
    seats_left: int = 0
    description: str
    needs: list[EventNeed]
