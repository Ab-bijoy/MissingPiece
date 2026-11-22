"""Projects and needs: template, project, need."""

import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import CheckConstraint, Date, DateTime, Integer, Numeric, String, Text, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base
from app.models.common import IdMixin, TimestampMixin, fk
from app.models.enums import NeedStatus, NeedType, ProjectStatus, TemplateStatus, pg_enum


class Template(IdMixin, TimestampMixin, Base):
    __tablename__ = "template"

    name: Mapped[str] = mapped_column(String(120), unique=True, nullable=False)
    project_type: Mapped[str] = mapped_column(String(60), nullable=False)
    # One line for the template card, e.g. "Fills in snack packs, prize money, projector, volunteers"
    blurb: Mapped[str] = mapped_column(String(300), nullable=False, server_default="", default="")
    # List of needs to pre-fill: [{type, title, quantity, unit, budget_item}]
    default_needs: Mapped[list] = mapped_column(JSONB, nullable=False, server_default=text("'[]'::jsonb"), default=list)
    status: Mapped[TemplateStatus] = mapped_column(
        pg_enum(TemplateStatus, "template_status"), nullable=False, server_default="draft", default=TemplateStatus.draft
    )


class Project(IdMixin, TimestampMixin, Base):
    __tablename__ = "project"
    __table_args__ = (CheckConstraint("audience >= 0", name="audience_not_negative"),)

    organizer_id: Mapped[uuid.UUID] = fk("app_user.id")
    template_id: Mapped[uuid.UUID | None] = fk("template.id", ondelete="SET NULL", nullable=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    purpose: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)  # read by AI matching
    event_date: Mapped[date] = mapped_column(Date, nullable=False)  # used by the expiry job
    venue: Mapped[str] = mapped_column(String(200), nullable=False)
    audience: Mapped[int] = mapped_column(Integer, nullable=False)
    institution: Mapped[str | None] = mapped_column(String(200))
    status: Mapped[ProjectStatus] = mapped_column(
        pg_enum(ProjectStatus, "project_status"),
        nullable=False,
        index=True,
        server_default="draft",
        default=ProjectStatus.draft,
    )

    needs: Mapped[list["Need"]] = relationship(back_populates="project", order_by="Need.created_at")
    template: Mapped[Template | None] = relationship()


class Need(IdMixin, TimestampMixin, Base):
    __tablename__ = "need"
    __table_args__ = (
        CheckConstraint("quantity > 0", name="quantity_positive"),
        CheckConstraint("type <> 'money' OR budget_item IS NOT NULL", name="money_has_budget_item"),
        CheckConstraint("slot_start IS NULL OR slot_end IS NULL OR slot_end > slot_start", name="slot_order"),
    )

    project_id: Mapped[uuid.UUID] = fk("project.id")
    type: Mapped[NeedType] = mapped_column(pg_enum(NeedType, "need_type"), nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    quantity: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    unit: Mapped[str] = mapped_column(String(60), nullable=False)
    budget_item: Mapped[str | None] = mapped_column(String(120))
    slot_start: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    slot_end: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    deadline: Mapped[date | None] = mapped_column(Date)
    status: Mapped[NeedStatus] = mapped_column(
        pg_enum(NeedStatus, "need_status"), nullable=False, index=True, server_default="open", default=NeedStatus.open
    )

    project: Mapped[Project] = relationship(back_populates="needs")
