"""All 19 tables. Importing this package registers every model on Base.metadata (Alembic needs that)."""

from app.models.accounts import AppUser, OrganizerProfile, RegistrationDocument, SponsorProfile
from app.models.community import Comment, EventMembership, Message, MessageThread, Notification
from app.models.projects import Need, Project, Template
from app.models.sponsorship import Benefit, Booking, Offer, Payment, Receipt, SponsorMatch, SponsorRequest

__all__ = [
    "AppUser",
    "OrganizerProfile",
    "SponsorProfile",
    "RegistrationDocument",
    "Template",
    "Project",
    "Need",
    "SponsorMatch",
    "SponsorRequest",
    "Offer",
    "Booking",
    "Receipt",
    "Payment",
    "Benefit",
    "EventMembership",
    "Comment",
    "MessageThread",
    "Message",
    "Notification",
]
