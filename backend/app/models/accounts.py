"""Accounts and registration: app_user, organizer_profile, sponsor_profile, registration_document."""

import uuid
from datetime import datetime

from sqlalchemy import Boolean, CheckConstraint, DateTime, Integer, String, Text, Uuid, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base
from app.models.common import IdMixin, TimestampMixin, fk
from app.models.enums import AccountStatus, DocumentKind, OrgType, UserRole, pg_enum


class AppUser(IdMixin, TimestampMixin, Base):
    """One row per person or company account. Roles and status live here, not in Supabase."""

    __tablename__ = "app_user"
    __table_args__ = (CheckConstraint("age IS NULL OR (age BETWEEN 0 AND 130)", name="age_range"),)

    supabase_user_id: Mapped[uuid.UUID] = mapped_column(Uuid, unique=True, nullable=False)
    email: Mapped[str] = mapped_column(String(320), unique=True, nullable=False)
    role: Mapped[UserRole] = mapped_column(pg_enum(UserRole, "user_role"), nullable=False)
    status: Mapped[AccountStatus] = mapped_column(pg_enum(AccountStatus, "account_status"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    age: Mapped[int | None] = mapped_column(Integer)
    skills: Mapped[list] = mapped_column(JSONB, nullable=False, server_default=text("'[]'::jsonb"), default=list)
    items: Mapped[list] = mapped_column(JSONB, nullable=False, server_default=text("'[]'::jsonb"), default=list)
    verified: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"), default=False)
    is_demo: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"), default=False)
    rejection_note: Mapped[str | None] = mapped_column(Text)
    # Audit trail for registration decisions: which admin approved or rejected, and when.
    reviewed_by: Mapped[uuid.UUID | None] = fk("app_user.id", ondelete="SET NULL", nullable=True)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    organizer_profile: Mapped["OrganizerProfile | None"] = relationship(back_populates="user", uselist=False)
    sponsor_profile: Mapped["SponsorProfile | None"] = relationship(back_populates="user", uselist=False)
    documents: Mapped[list["RegistrationDocument"]] = relationship(back_populates="user")


class OrganizerProfile(IdMixin, TimestampMixin, Base):
    __tablename__ = "organizer_profile"

    user_id: Mapped[uuid.UUID] = fk("app_user.id", unique=True)
    org_name: Mapped[str] = mapped_column(String(200), nullable=False)
    org_type: Mapped[OrgType] = mapped_column(pg_enum(OrgType, "org_type"), nullable=False)
    registration_number: Mapped[str] = mapped_column(String(100), nullable=False)
    contact_person: Mapped[str] = mapped_column(String(200), nullable=False)
    phone: Mapped[str] = mapped_column(String(40), nullable=False)

    user: Mapped[AppUser] = relationship(back_populates="organizer_profile")


class SponsorProfile(IdMixin, TimestampMixin, Base):
    """Read by AI matching."""

    __tablename__ = "sponsor_profile"

    user_id: Mapped[uuid.UUID] = fk("app_user.id", unique=True)
    company: Mapped[str] = mapped_column(String(200), nullable=False)
    industry: Mapped[str] = mapped_column(String(120), nullable=False)
    trade_license_number: Mapped[str] = mapped_column(String(100), nullable=False)
    contact_person: Mapped[str] = mapped_column(String(200), nullable=False)
    phone: Mapped[str] = mapped_column(String(40), nullable=False)
    interests: Mapped[list] = mapped_column(JSONB, nullable=False, server_default=text("'[]'::jsonb"), default=list)
    # Need types the sponsor usually gives
    preferred_types: Mapped[list] = mapped_column(
        JSONB, nullable=False, server_default=text("'[]'::jsonb"), default=list
    )
    location: Mapped[str | None] = mapped_column(String(120))
    description: Mapped[str | None] = mapped_column(Text)

    user: Mapped[AppUser] = relationship(back_populates="sponsor_profile")


class RegistrationDocument(IdMixin, TimestampMixin, Base):
    """A proof file uploaded at registration. The file is in storage; this row holds its key."""

    __tablename__ = "registration_document"
    __table_args__ = (
        CheckConstraint("content_type IN ('application/pdf', 'image/jpeg', 'image/png')", name="content_type_allowed"),
        CheckConstraint("size_bytes BETWEEN 1 AND 5242880", name="size_limit"),
    )

    user_id: Mapped[uuid.UUID] = fk("app_user.id")
    storage_key: Mapped[str] = mapped_column(String(500), unique=True, nullable=False)
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    content_type: Mapped[str] = mapped_column(String(100), nullable=False)
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    kind: Mapped[DocumentKind] = mapped_column(pg_enum(DocumentKind, "document_kind"), nullable=False)

    user: Mapped[AppUser] = relationship(back_populates="documents")
