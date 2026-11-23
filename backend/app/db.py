"""Engine, session and the declarative Base.

Small pool and a retry on start-up, because free database tiers sleep when idle
(build prompt 11). Every connection runs in UTC.

Speed: the database is reached over the network, so each round trip costs about
0.2 s from a development PC. Two things avoid trips that do no useful work:
- Connections are checked only after sitting idle for a while, not before every
  request (SQLAlchemy's pool_pre_ping costs one round trip per request).
- GET requests use autocommit sessions: no BEGIN before and no ROLLBACK after,
  saving two round trips. Changes (POST, PATCH, DELETE) keep full transactions.
"""

import time
from collections.abc import Iterator

from fastapi import Request
from sqlalchemy import MetaData, create_engine, event, text
from sqlalchemy.engine import Engine
from sqlalchemy.exc import DisconnectionError, OperationalError
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

# A pooled connection idle longer than this is checked before use (one quick round trip)
IDLE_CHECK_SECONDS = 60


class Base(DeclarativeBase):
    metadata = MetaData(naming_convention=NAMING)


def make_engine(url: str) -> Engine:
    engine = create_engine(
        url,
        pool_size=5,
        max_overflow=2,
        pool_recycle=1800,  # replace connections every 30 minutes
        connect_args={
            "options": "-c timezone=UTC",
            # TCP keepalives, so the network does not silently drop idle connections
            "keepalives": 1,
            "keepalives_idle": 60,
            "keepalives_interval": 10,
            "keepalives_count": 3,
        },
    )

    @event.listens_for(engine, "checkin")
    def _remember_idle(dbapi_conn, record):
        record.info["idle_since"] = time.monotonic()

    @event.listens_for(engine, "checkout")
    def _check_if_idle(dbapi_conn, record, proxy):
        since = record.info.get("idle_since")
        if since is None or time.monotonic() - since < IDLE_CHECK_SECONDS:
            return  # new or recently used: no check needed
        try:
            was = dbapi_conn.autocommit
            dbapi_conn.autocommit = True  # a single round trip, no transaction
            with dbapi_conn.cursor() as cur:
                cur.execute("SELECT 1")
            dbapi_conn.autocommit = was
        except Exception as e:
            # The pool throws this connection away and opens a fresh one
            raise DisconnectionError() from e

    return engine


engine = make_engine(get_settings().database_url)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
# For GET requests: every statement commits on its own, so no BEGIN/ROLLBACK round trips
ReadSessionLocal = sessionmaker(
    bind=engine.execution_options(isolation_level="AUTOCOMMIT"), autoflush=False, expire_on_commit=False
)


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


def get_db(request: Request) -> Iterator[Session]:
    """FastAPI dependency: one session per request, committed by the service that changes data.

    GET and HEAD requests get an autocommit session (see the module notes).
    """
    db = ReadSessionLocal() if request.method in ("GET", "HEAD") else SessionLocal()
    try:
        yield db
    finally:
        db.close()
