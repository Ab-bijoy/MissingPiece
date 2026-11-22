"""FastAPI app: CORS, error format and routers. All paths start with /api."""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.db import wait_for_database
from app.errors import install_error_handlers
from app.routers import admin, auth, events, payments, shared, sponsor


@asynccontextmanager
async def lifespan(_: FastAPI):
    wait_for_database()  # free database tiers sleep when idle
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
    app.include_router(sponsor.router)
    app.include_router(events.router)
    app.include_router(payments.router)
    app.include_router(shared.router)
    app.include_router(admin.router)
    return app


app = create_app()
