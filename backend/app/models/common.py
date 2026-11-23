"""Shared columns: UUID primary key and created_at / updated_at on every table."""

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Annotated

from sqlalchemy import DateTime, ForeignKey, Numeric, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column

Money = Annotated[Decimal, mapped_column(Numeric(12, 2))]


class IdMixin:
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


def fk(target: str, ondelete: str = "CASCADE", nullable: bool = False, **kw) -> Mapped:
    """A UUID foreign key with an index (every foreign key is indexed: architecture section 5)."""
    return mapped_column(Uuid, ForeignKey(target, ondelete=ondelete), nullable=nullable, index=True, **kw)
