"""Alembic environment: uses DATABASE_URL from settings and the app's models."""

from logging.config import fileConfig

from sqlalchemy import create_engine

import app.models  # noqa: F401  registers every table on Base.metadata
from alembic import context
from app.config import get_settings
from app.db import Base

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def _url() -> str:
    # `-x db=test` runs migrations against TEST_DATABASE_URL instead.
    s = get_settings()
    if context.get_x_argument(as_dictionary=True).get("db") == "test":
        if not s.test_database_url:
            raise SystemExit("TEST_DATABASE_URL is not set")
        return s.test_database_url
    return s.database_url


def run_migrations_offline() -> None:
    context.configure(url=_url(), target_metadata=target_metadata, literal_binds=True, compare_type=True)
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    engine = create_engine(_url(), connect_args={"options": "-c timezone=UTC"})
    with engine.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata, compare_type=True)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
