"""FastAPI app: CORS, error format and routers. All paths start with /api."""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.db import wait_for_database
from app.errors import install_error_handlers
from app.routers import (
    admin,
    auth,
    community,
    events,
    jobs,
    organizer,
    organizer_profile,
    organizer_requests,
    payments,
    shared,
    sponsor,
)


@asynccontextmanager
async def lifespan(_: FastAPI):
    wait_for_database()  # free database tiers sleep when idle
    # Settings are read once at start: after editing .env, restart the server.
    s = get_settings()
    payments_mode = s.payment_provider
    if s.payment_provider == "sslcommerz":
        payments_mode += " (sandbox)" if s.sslcommerz_sandbox else " (LIVE, real money)"
    logging.getLogger("uvicorn.error").info(
        "Payments: %s | Emails: %s | Test tokens: %s",
        payments_mode,
        "SMTP" if s.smtp_enabled else "log only",
        "on" if s.dev_auth else "off",
    )
    yield


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title="MissingPiece API", version="0.1.0", lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    install_error_handlers(app)

    @app.get("/api/health", tags=["health"])
    def health() -> dict[str, str]:
        """For the host's health check."""
        return {"status": "ok"}

    # Routers are added as each module is built (sponsor first).
    app.include_router(auth.router)
    app.include_router(community.router)
    app.include_router(jobs.router)
    app.include_router(sponsor.router)
    app.include_router(events.router)
    app.include_router(payments.router)
    app.include_router(shared.router)
    app.include_router(admin.router)
    app.include_router(organizer.router)
    app.include_router(organizer_requests.router)
    app.include_router(organizer_profile.router)
    return app


app = create_app()
