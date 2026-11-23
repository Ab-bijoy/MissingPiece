"""Validated community requests and frontend response contracts."""

import uuid
from typing import Annotated, Literal

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, StringConstraints, model_validator

from app.schemas.common import AGE_MAX, AGE_MIN, Schema

Text = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]


class ProfileOut(Schema):
    name: str
    age: int | None
    skills: list[str]
    items: list[str]


class ProfilePatch(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: Text | None = None
    age: int | None = Field(default=None, ge=AGE_MIN, le=AGE_MAX, strict=True)
    skills: list[Text] | None = Field(default=None, max_length=50)
    items: list[Text] | None = Field(default=None, max_length=50)

    @model_validator(mode="after")
    def nonnullable(self):
        for key in self.model_fields_set - {"age"}:
            if getattr(self, key) is None:
                raise ValueError(f"{key} cannot be null")
        return self


class JoinIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    role: Literal["participant", "contributor"]
    contribution_role: Literal["trainer", "contributor"] | None = None
    need_id: uuid.UUID | None = None
    slot_start: AwareDatetime | None = None
    slot_end: AwareDatetime | None = None
    switch_from_participant: bool = False

    @model_validator(mode="after")
    def valid_role(self):
        if self.switch_from_participant and self.role != "contributor":
            raise ValueError("Only a helper application can switch from participant")
        if self.role == "contributor" and (not self.need_id or not self.contribution_role):
            raise ValueError("Choose a need and contribution role")
        if self.role == "participant" and any((self.need_id, self.contribution_role, self.slot_start, self.slot_end)):
            raise ValueError("Participants cannot submit contribution details")
        if bool(self.slot_start) != bool(self.slot_end):
            raise ValueError("Provide both slot boundaries")
        if self.slot_start and self.slot_end <= self.slot_start:
            raise ValueError("Slot end must follow start")
        return self


class CommentIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    kind: Literal["comment", "question", "reply"]
    body: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=5000)]
    parent_id: uuid.UUID | None = None

    @model_validator(mode="after")
    def valid_parent(self):
        if (self.kind == "reply") != (self.parent_id is not None):
            raise ValueError("Only replies must have a parent_id")
        return self
