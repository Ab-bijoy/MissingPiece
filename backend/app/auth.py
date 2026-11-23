"""The token check (build prompt 3.2).

1. The browser logs in with Supabase and gets an access token (a signed JWT).
2. It sends `Authorization: Bearer <token>` on every API call.
3. Here we verify the signature, expiry and audience, read `sub` (the Supabase
   user id) and `email`, and load our own `app_user` row. Roles and account
   status come from our database, never from the token.

Supabase projects sign tokens one of two ways; both are supported:
- JWT secret (HS256): set SUPABASE_JWT_SECRET.
- Signing keys (ES256/RS256, newer projects): set SUPABASE_JWKS_URL, or just
  SUPABASE_URL and the standard JWKS address is used.
With DEV_AUTH=true, tokens signed with DEV_JWT_SECRET are accepted too, so the
API can be used before Supabase is set up (and by the tests).
"""

import logging
import uuid
from dataclasses import dataclass
from functools import lru_cache
from typing import Annotated

import jwt
from fastapi import Depends, Header
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db import get_db
from app.errors import ApiError
from app.models import AppUser
from app.models.enums import AccountStatus, UserRole

DEV_ISSUER = "missingpiece-dev"
# Seconds of clock difference to tolerate between this server and Supabase.
CLOCK_LEEWAY_SECONDS = 60
log = logging.getLogger("app.auth")


@dataclass(frozen=True)
class Claims:
    supabase_user_id: uuid.UUID
    email: str


@lru_cache
def _jwks_client() -> jwt.PyJWKClient | None:
    s = get_settings()
    url = s.supabase_jwks_url or (
        f"{s.supabase_url.rstrip('/')}/auth/v1/.well-known/jwks.json" if s.supabase_url else ""
    )
    return jwt.PyJWKClient(url, cache_keys=True, lifespan=3600) if url else None


def decode_token(token: str) -> Claims:
    s = get_settings()
    unauthorized = ApiError(401, "Please log in again.", "unauthenticated")
    try:
        header = jwt.get_unverified_header(token)
        unverified = jwt.decode(token, options={"verify_signature": False})
    except jwt.PyJWTError:
        raise unauthorized from None

    # Allow for small clock differences between this server and Supabase; otherwise a
    # brand-new token can look "issued in the future" and be refused.
    leeway = CLOCK_LEEWAY_SECONDS
    aud = s.supabase_jwt_audience
    try:
        if s.dev_auth and unverified.get("iss") == DEV_ISSUER:
            if s.is_placeholder(s.dev_jwt_secret):
                log.error("Refused a dev token: DEV_JWT_SECRET is an example value. Set a long random secret.")
                raise unauthorized
            payload = jwt.decode(token, s.dev_jwt_secret, algorithms=["HS256"], audience=aud, leeway=leeway)
        elif header.get("alg") == "HS256":
            if not s.supabase_jwt_secret:
                log.warning("Refused an HS256 token: SUPABASE_JWT_SECRET is not set")
                raise unauthorized
            payload = jwt.decode(token, s.supabase_jwt_secret, algorithms=["HS256"], audience=aud, leeway=leeway)
        else:
            client = _jwks_client()
            if client is None:
                log.warning("Refused a %s token: set SUPABASE_URL or SUPABASE_JWKS_URL", header.get("alg"))
                raise unauthorized
            key = client.get_signing_key_from_jwt(token)
            payload = jwt.decode(token, key.key, algorithms=["ES256", "RS256"], audience=aud, leeway=leeway)
        return Claims(supabase_user_id=uuid.UUID(payload["sub"]), email=str(payload.get("email", "")).lower())
    except (jwt.PyJWTError, KeyError, ValueError) as e:
        # Say why in the server log (never the token itself), so a refused log-in is easy to diagnose.
        log.warning("Refused a token: %s: %s", type(e).__name__, e)
        raise unauthorized from None


def make_dev_token(supabase_user_id: uuid.UUID, email: str, minutes: int = 600) -> str:
    """A token the API accepts when DEV_AUTH=true. For local testing and pytest only."""
    import datetime as dt

    s = get_settings()
    now = dt.datetime.now(dt.UTC)
    return jwt.encode(
        {
            "sub": str(supabase_user_id),
            "email": email,
            "aud": s.supabase_jwt_audience,
            "iss": DEV_ISSUER,
            "iat": now,
            "exp": now + dt.timedelta(minutes=minutes),
        },
        s.dev_jwt_secret,
        algorithm="HS256",
    )


# ---- FastAPI dependencies ----------------------------------------------------


def token_claims(authorization: Annotated[str | None, Header()] = None) -> Claims:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise ApiError(401, "Please log in.", "unauthenticated")
    return decode_token(authorization.split(" ", 1)[1].strip())


def current_user_optional(
    claims: Annotated[Claims, Depends(token_claims)], db: Annotated[Session, Depends(get_db)]
) -> AppUser | None:
    """The app_user for this token, or None while someone is still signing up."""
    return db.scalar(select(AppUser).where(AppUser.supabase_user_id == claims.supabase_user_id))


def current_user(user: Annotated[AppUser | None, Depends(current_user_optional)]) -> AppUser:
    """Any account with a profile. Without one, only the three register endpoints may be called."""
    if user is None:
        raise ApiError(404, "No profile yet. Finish signing up first.", "no_profile")
    return user


_STATUS_MESSAGE = {
    AccountStatus.pending_approval: "Your registration is still waiting for an admin to check it.",
    AccountStatus.rejected: "Your registration was not approved.",
    AccountStatus.suspended: "This account has been suspended.",
}


def require_active(user: Annotated[AppUser, Depends(current_user)]) -> AppUser:
    """The back end refuses every non-auth call from a user who is not active (build prompt 3.4)."""
    if user.status != AccountStatus.active:
        raise ApiError(403, _STATUS_MESSAGE.get(user.status, "Your account is not active."), "not_active")
    return user


def require_role(*roles: UserRole):
    """Dependency factory: an active account with one of these roles."""

    def dep(user: Annotated[AppUser, Depends(require_active)]) -> AppUser:
        if user.role not in roles:
            raise ApiError(403, "Your account cannot do this.", "wrong_role")
        return user

    return dep


CurrentUser = Annotated[AppUser, Depends(current_user)]
ActiveUser = Annotated[AppUser, Depends(require_active)]
Sponsor = Annotated[AppUser, Depends(require_role(UserRole.sponsor))]
Organizer = Annotated[AppUser, Depends(require_role(UserRole.organizer))]
Admin = Annotated[AppUser, Depends(require_role(UserRole.admin))]
DB = Annotated[Session, Depends(get_db)]
