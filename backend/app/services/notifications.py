"""Every state change creates the matching notification (rule 16)."""

import uuid

from sqlalchemy.orm import Session

from app.models import Notification
from app.models.enums import NotificationType


def notify(db: Session, user_id: uuid.UUID, type_: NotificationType, ref_id: uuid.UUID | None, text: str) -> None:
    """Adds a notification in the caller's transaction; it is saved when the caller commits."""
    db.add(Notification(user_id=user_id, type=type_, ref_id=ref_id, text=text))
