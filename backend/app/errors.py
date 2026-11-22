"""Errors return { detail, code } with the right HTTP status (build prompt 7)."""

import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError
from starlette.exceptions import HTTPException as StarletteHTTPException

log = logging.getLogger("app.errors")


class ApiError(Exception):
    """Raise from routers or services: ApiError(409, "This need is already covered.", "need_covered")."""

    def __init__(self, status: int, detail: str, code: str):
        self.status = status
        self.detail = detail
        self.code = code


def must[T](value: T | None, what: str = "Item") -> T:
    """Return value, or stop with a 404 if a row that should exist is missing."""
    if value is None:
        raise not_found(what)
    return value


def not_found(what: str = "Item") -> ApiError:
    return ApiError(404, f"{what} not found.", "not_found")


def forbidden(detail: str = "You are not allowed to do this.") -> ApiError:
    return ApiError(403, detail, "forbidden")


def install_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(ApiError)
    async def _api_error(_: Request, exc: ApiError) -> JSONResponse:
        return JSONResponse(status_code=exc.status, content={"detail": exc.detail, "code": exc.code})

    @app.exception_handler(StarletteHTTPException)
    async def _http_error(_: Request, exc: StarletteHTTPException) -> JSONResponse:
        return JSONResponse(status_code=exc.status_code, content={"detail": str(exc.detail), "code": "http_error"})

    @app.exception_handler(IntegrityError)
    async def _integrity(_: Request, exc: IntegrityError) -> JSONResponse:
        # Two requests raced, or a unique value is already taken. Never show the SQL.
        log.warning("Integrity error: %s", str(exc.orig).splitlines()[0])
        return JSONResponse(
            status_code=409, content={"detail": "That conflicts with existing data.", "code": "conflict"}
        )

    @app.exception_handler(Exception)
    async def _unexpected(_: Request, exc: Exception) -> JSONResponse:
        log.exception("Unhandled error")
        return JSONResponse(
            status_code=500, content={"detail": "Something went wrong on our side.", "code": "server_error"}
        )

    @app.exception_handler(RequestValidationError)
    async def _validation(_: Request, exc: RequestValidationError) -> JSONResponse:
        first = exc.errors()[0] if exc.errors() else {}
        field = ".".join(str(p) for p in first.get("loc", [])[1:])
        msg = first.get("msg", "Invalid input.")
        return JSONResponse(
            status_code=422,
            content={"detail": f"{field}: {msg}" if field else msg, "code": "validation"},
        )
