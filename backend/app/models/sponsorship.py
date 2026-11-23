"""Sponsorship: sponsor_match, request, offer, booking, receipt, payment, benefit."""

import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB, ExcludeConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base
from app.models.common import IdMixin, TimestampMixin, fk
from app.models.enums import ContributionRole, MatchStatus, OfferStage, PaymentStatus, pg_enum


class SponsorMatch(IdMixin, TimestampMixin, Base):
    """One AI suggestion of a sponsor for a project. Scores are shown only to the organizer."""

    __tablename__ = "sponsor_match"
    __table_args__ = (
        UniqueConstraint("project_id", "sponsor_id"),
        CheckConstraint("score BETWEEN 0 AND 100", name="score_range"),
    )

    project_id: Mapped[uuid.UUID] = fk("project.id")
    sponsor_id: Mapped[uuid.UUID] = fk("app_user.id")
    score: Mapped[int] = mapped_column(Integer, nullable=False)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    source: Mapped[str] = mapped_column(String(16), nullable=False, server_default="rules", default="rules")
    status: Mapped[MatchStatus] = mapped_column(
        pg_enum(MatchStatus, "match_status"), nullable=False, server_default="suggested", default=MatchStatus.suggested
    )


class SponsorRequest(IdMixin, TimestampMixin, Base):
    """An organizer's request to one sponsor for one need. Table `request`, class SponsorRequest."""

    __tablename__ = "request"
    __table_args__ = (UniqueConstraint("need_id", "sponsor_id"),)

    project_id: Mapped[uuid.UUID] = fk("project.id")
    need_id: Mapped[uuid.UUID] = fk("need.id")
    sponsor_id: Mapped[uuid.UUID] = fk("app_user.id")
    benefits: Mapped[list] = mapped_column(JSONB, nullable=False, server_default=text("'[]'::jsonb"), default=list)
    conditions: Mapped[str | None] = mapped_column(Text)
    exclusive_category: Mapped[str | None] = mapped_column(String(60))
    decide_by: Mapped[date | None] = mapped_column(Date)
    deliver_by: Mapped[date | None] = mapped_column(Date)


class Offer(IdMixin, TimestampMixin, Base):
    """One promise to fill a whole need, from a sponsor or a contributor."""

    __tablename__ = "offer"
    __table_args__ = (
        # Rule 2: at most one accepted (or received) offer per need. Last line of defence if two accepts race.
        Index(
            "uq_offer_one_holding_per_need",
            "need_id",
            unique=True,
            postgresql_where=text("stage IN ('accepted', 'received')"),
        ),
        CheckConstraint("amount IS NULL OR amount > 0", name="amount_positive"),
        CheckConstraint("slot_start IS NULL OR slot_end IS NULL OR slot_end > slot_start", name="slot_order"),
    )

    need_id: Mapped[uuid.UUID] = fk("need.id")
    from_user_id: Mapped[uuid.UUID] = fk("app_user.id")
    request_id: Mapped[uuid.UUID | None] = fk(
        "request.id", ondelete="SET NULL", nullable=True
    )  # empty for contributors
    stage: Mapped[OfferStage] = mapped_column(
        pg_enum(OfferStage, "offer_stage"),
        nullable=False,
        index=True,
        server_default="offered",
        default=OfferStage.offered,
    )
    contribution_role: Mapped[ContributionRole | None] = mapped_column(pg_enum(ContributionRole, "contribution_role"))
    conditions: Mapped[str | None] = mapped_column(Text)
    exclusive_category: Mapped[str | None] = mapped_column(String(60))
    amount: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))  # money offers only
    resource: Mapped[str | None] = mapped_column(String(200))  # for example: projector
    slot_start: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    slot_end: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    benefits: Mapped[list["Benefit"]] = relationship(back_populates="offer", order_by="Benefit.created_at")


class Booking(IdMixin, TimestampMixin, Base):
    """Time-slot reservation for an accepted skill, time, equipment or space offer."""

    __tablename__ = "booking"
    __table_args__ = (
        CheckConstraint("slot_end > slot_start", name="slot_order"),
        # Rule 4: the same person or item is never double-booked (needs the btree_gist extension).
        ExcludeConstraint(
            ("resource_key", "="),
            (func.tstzrange(text("slot_start"), text("slot_end")), "&&"),
            name="ex_booking_no_overlap",
            using="gist",
        ),
    )

    offer_id: Mapped[uuid.UUID] = fk("offer.id", unique=True)
    # Who or what is booked: user:<id> or item:<owner id>:projector
    resource_key: Mapped[str] = mapped_column(String(300), nullable=False)
    slot_start: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    slot_end: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class Receipt(IdMixin, TimestampMixin, Base):
    """Proof that an accepted offer was received in full."""

    __tablename__ = "receipt"

    offer_id: Mapped[uuid.UUID] = fk("offer.id", unique=True)
    received_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    confirmed_by: Mapped[uuid.UUID] = fk("app_user.id", ondelete="RESTRICT")


class Payment(IdMixin, TimestampMixin, Base):
    """One payment attempt for an accepted money offer. A failed attempt can be followed by a retry."""

    __tablename__ = "payment"
    __table_args__ = (
        CheckConstraint(
            "gross_amount >= 0 AND commission_amount >= 0 AND net_amount >= 0"
            " AND gross_amount = net_amount + commission_amount",
            name="amounts_add_up",
        ),
        CheckConstraint("status <> 'paid_out' OR paid_out_at IS NOT NULL", name="paid_out_has_date"),
    )

    offer_id: Mapped[uuid.UUID] = fk("offer.id", ondelete="RESTRICT")  # money records are never lost
    gross_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)  # what the sponsor pays
    commission_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)  # 5% kept by MissingPiece
    net_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)  # goes to the project
    gateway_ref: Mapped[str | None] = mapped_column(String(200), unique=True)
    status: Mapped[PaymentStatus] = mapped_column(
        pg_enum(PaymentStatus, "payment_status"),
        nullable=False,
        index=True,
        server_default="pending",
        default=PaymentStatus.pending,
    )
    paid_out_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class Benefit(IdMixin, TimestampMixin, Base):
    """A benefit promised to a sponsor, ticked off at completion."""

    __tablename__ = "benefit"

    offer_id: Mapped[uuid.UUID] = fk("offer.id")
    label: Mapped[str] = mapped_column(String(300), nullable=False)  # for example: Logo on the main banner
    given: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"), default=False)
    given_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    offer: Mapped[Offer] = relationship(back_populates="benefits")
