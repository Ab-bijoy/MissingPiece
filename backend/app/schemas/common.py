"""Shared schema pieces. Response shapes match frontend/src/api/types.ts."""

import re
import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Annotated

from pydantic import BaseModel, ConfigDict, PlainSerializer

# Money and quantities are Decimal in Python (never float for maths) but go out
# as JSON numbers, which is what the frontend expects.
Num = Annotated[Decimal, PlainSerializer(lambda v: float(v), return_type=float, when_used="json")]


class Schema(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class NeedOut(Schema):
    id: uuid.UUID
    project_id: uuid.UUID
    type: str
    title: str
    quantity: Num
    unit: str
    budget_item: str | None
    slot_start: datetime | None
    slot_end: datetime | None
    deadline: date | None
    status: str


class BenefitOut(Schema):
    id: uuid.UUID
    offer_id: uuid.UUID
    label: str
    given: bool
    given_at: datetime | None


class OfferOut(Schema):
    id: uuid.UUID
    need_id: uuid.UUID
    need_title: str
    need_type: str
    from_user_id: uuid.UUID
    from_name: str
    request_id: uuid.UUID | None
    stage: str
    contribution_role: str | None
    conditions: str | None
    exclusive_category: str | None
    amount: Num | None
    slot_start: datetime | None
    slot_end: datetime | None
    benefits: list[BenefitOut]
    membership_id: uuid.UUID | None
    membership_status: str | None
    payment_status: str | None
    created_at: datetime


class EventFacts(Schema):
    id: uuid.UUID
    name: str
    project_type: str | None
    organizer_name: str
    institution: str | None
    event_date: date
    venue: str
    audience: int
    status: str
    participants: int
    contributors: int


# ---- Shared input rules -------------------------------------------------------------

AGE_MIN, AGE_MAX = 13, 100  # general users: teenagers and up
_PHONE = re.compile(r"^01[3-9]\d{8}$")  # Bangladeshi mobile: 11 digits, 013-019


def clean_phone(value: str) -> str:
    """An 11-digit Bangladeshi mobile number, like 01712345678. Spaces and dashes are removed."""
    digits = re.sub(r"[\s-]", "", value or "")
    if not _PHONE.fullmatch(digits):
        raise ValueError("Enter an 11-digit mobile number, like 01712345678.")
    return digits
