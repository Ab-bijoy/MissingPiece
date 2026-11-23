"""Community: event_membership, comment, message_thread, message, notification."""

import uuid

from sqlalchemy import Boolean, CheckConstraint, Index, Text, UniqueConstraint, text
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base
from app.models.common import IdMixin, TimestampMixin, fk
from app.models.enums import (
    CommentKind,
    CommentStatus,
    MembershipRole,
    MembershipStatus,
    NotificationType,
    pg_enum,
)


class EventMembership(IdMixin, TimestampMixin, Base):
    """One general user's role in one event."""

    __tablename__ = "event_membership"
    __table_args__ = (
        UniqueConstraint("user_id", "project_id"),
        Index("ix_membership_project_status_role", "project_id", "status", "role"),
        # Participants are approved on joining; only contributors wait (rule 14).
        CheckConstraint("role <> 'participant' OR status = 'approved'", name="participant_approved"),
    )

    user_id: Mapped[uuid.UUID] = fk("app_user.id")
    project_id: Mapped[uuid.UUID] = fk("project.id")
    role: Mapped[MembershipRole] = mapped_column(pg_enum(MembershipRole, "membership_role"), nullable=False)
    status: Mapped[MembershipStatus] = mapped_column(pg_enum(MembershipStatus, "membership_status"), nullable=False)
    offer_id: Mapped[uuid.UUID | None] = fk("offer.id", ondelete="SET NULL", nullable=True)  # the contributor's offer


class Comment(IdMixin, TimestampMixin, Base):
    """A comment, question or reply under an event."""

    __tablename__ = "comment"
    __table_args__ = (
        Index("ix_comment_project_status_created", "project_id", "status", "created_at"),
        CheckConstraint("kind <> 'reply' OR parent_id IS NOT NULL", name="reply_has_parent"),
        CheckConstraint("length(btrim(body)) > 0", name="body_not_blank"),
    )

    project_id: Mapped[uuid.UUID] = fk("project.id")
    user_id: Mapped[uuid.UUID] = fk("app_user.id")
    parent_id: Mapped[uuid.UUID | None] = fk("comment.id", nullable=True)
    kind: Mapped[CommentKind] = mapped_column(pg_enum(CommentKind, "comment_kind"), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[CommentStatus] = mapped_column(
        pg_enum(CommentStatus, "comment_status"),
        nullable=False,
        server_default="visible",
        default=CommentStatus.visible,
    )


class MessageThread(IdMixin, TimestampMixin, Base):
    """Opened only when an organizer sends a request (rule 6)."""

    __tablename__ = "message_thread"

    request_id: Mapped[uuid.UUID] = fk("request.id", unique=True)
    organizer_id: Mapped[uuid.UUID] = fk("app_user.id")
    sponsor_id: Mapped[uuid.UUID] = fk("app_user.id")


class Message(IdMixin, TimestampMixin, Base):
    __tablename__ = "message"
    __table_args__ = (CheckConstraint("length(btrim(body)) > 0", name="body_not_blank"),)

    thread_id: Mapped[uuid.UUID] = fk("message_thread.id")
    sender_id: Mapped[uuid.UUID] = fk("app_user.id")
    body: Mapped[str] = mapped_column(Text, nullable=False)
    read: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"), default=False)


class Notification(IdMixin, TimestampMixin, Base):
    __tablename__ = "notification"
    __table_args__ = (
        # Fast "unread" lookups for the bell.
        Index("ix_notification_unread", "user_id", postgresql_where=text("read = false")),
    )

    user_id: Mapped[uuid.UUID] = fk("app_user.id")
    type: Mapped[NotificationType] = mapped_column(pg_enum(NotificationType, "notification_type"), nullable=False)
    ref_id: Mapped[uuid.UUID | None] = mapped_column()  # the record the alert is about
    read: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"), default=False)
    # Short plain-language line for the bell (the frontend shows it as written)
    text: Mapped[str] = mapped_column(Text, nullable=False, server_default="")
