"""Engine, session and the declarative Base.

Small pool with pre-ping and a retry on start-up, because free database tiers
sleep when idle (build prompt 11). Every connection runs in UTC.
"""

import time
from collections.abc import Iterator

from sqlalchemy import MetaData, create_engine, text
from sqlalchemy.engine import Engine
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import get_settings

# Fixed constraint names (uq_, ck_, fk_, ix_, pk_) keep Alembic migrations stable.
NAMING = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_N_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


class Base(DeclarativeBase):
    metadata = MetaData(naming_convention=NAMING)


def make_engine(url: str) -> Engine:
    return create_engine(
        url,
        pool_size=5,
        max_overflow=2,
        pool_pre_ping=True,
        connect_args={"options": "-c timezone=UTC"},
    )


engine = make_engine(get_settings().database_url)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def wait_for_database(attempts: int = 5, delay: float = 2.0) -> None:
    """Retry the first connection: a sleeping free-tier database can take a few seconds to wake."""
    for i in range(attempts):
        try:
            with engine.connect() as conn:
                conn.execute(text("select 1"))
            return
        except OperationalError:
            if i == attempts - 1:
                raise
            time.sleep(delay * (i + 1))


def get_db() -> Iterator[Session]:
    """FastAPI dependency: one session per request, committed by the service that changes data."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
