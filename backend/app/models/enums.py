"""PostgreSQL enums (database architecture section 4)."""

from enum import StrEnum

from sqlalchemy import Enum as SAEnum


class UserRole(StrEnum):
    general = "general"
    organizer = "organizer"
    sponsor = "sponsor"
    admin = "admin"


class AccountStatus(StrEnum):
    pending_approval = "pending_approval"
    active = "active"
    rejected = "rejected"
    suspended = "suspended"


class OrgType(StrEnum):
    ngo = "ngo"
    university = "university"
    community_group = "community_group"


class DocumentKind(StrEnum):
    registration_proof = "registration_proof"
    trade_license = "trade_license"


class TemplateStatus(StrEnum):
    live = "live"
    draft = "draft"


class ProjectStatus(StrEnum):
    draft = "draft"
    live = "live"
    complete = "complete"


class NeedType(StrEnum):
    money = "money"
    product = "product"
    skill = "skill"
    time = "time"
    equipment = "equipment"
    space = "space"


class NeedStatus(StrEnum):
    open = "open"
    covered = "covered"


class OfferStage(StrEnum):
    offered = "offered"
    accepted = "accepted"
    received = "received"
    declined = "declined"
    withdrawn = "withdrawn"
    expired = "expired"


class ContributionRole(StrEnum):
    trainer = "trainer"
    contributor = "contributor"


class MembershipRole(StrEnum):
    participant = "participant"
    contributor = "contributor"


class MembershipStatus(StrEnum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"


class MatchStatus(StrEnum):
    suggested = "suggested"
    requested = "requested"
    dismissed = "dismissed"


class PaymentStatus(StrEnum):
    pending = "pending"
    succeeded = "succeeded"
    failed = "failed"
    paid_out = "paid_out"


class CommentKind(StrEnum):
    comment = "comment"
    question = "question"
    reply = "reply"


class CommentStatus(StrEnum):
    visible = "visible"
    hidden = "hidden"


class NotificationType(StrEnum):
    request_received = "request_received"
    offer_received = "offer_received"
    offer_accepted = "offer_accepted"
    offer_declined = "offer_declined"
    offer_withdrawn = "offer_withdrawn"
    offer_expired = "offer_expired"
    need_covered = "need_covered"
    item_received = "item_received"
    membership_pending = "membership_pending"
    membership_approved = "membership_approved"
    membership_rejected = "membership_rejected"
    payment_succeeded = "payment_succeeded"
    payment_failed = "payment_failed"
    message_received = "message_received"
    comment_posted = "comment_posted"
    comment_replied = "comment_replied"
    registration_approved = "registration_approved"
    registration_rejected = "registration_rejected"


def pg_enum(enum_cls: type[StrEnum], name: str) -> SAEnum:
    """A native PostgreSQL enum that stores the lower-case values."""
    return SAEnum(enum_cls, name=name, values_callable=lambda e: [m.value for m in e], validate_strings=True)
