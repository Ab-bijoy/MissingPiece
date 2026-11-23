"""Forgot password, per log-in screen.

Each log-in screen (general user, organizer, sponsor, admin) has its own "Forgot
password?" page. The reset email is sent only when the email belongs to an account
of that screen's role, so an admin cannot be sent a reset link from the sponsor page.

The answer is always the same ("if an account uses this email..."), whatever the
outcome, so the page cannot be used to find out which emails have accounts or
which role an email has.

Note: Supabase's own public reset endpoint can still be called directly by anyone
with the public key. That is safe: the link only ever goes to the account owner's
inbox. This check keeps our screens consistent and is the place for future rules.
"""

import logging
import threading
import time

import httpx
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models import AppUser
from app.models.enums import UserRole

log = logging.getLogger("app.password_reset")

COOLDOWN_SECONDS = 60  # one reset email per address per minute
_last_sent: dict[str, float] = {}
_lock = threading.Lock()


def _cooling_down(email: str) -> bool:
    now = time.monotonic()
    with _lock:
        for key in [k for k, t in _last_sent.items() if now - t > COOLDOWN_SECONDS]:
            del _last_sent[key]  # forget old entries
        if email in _last_sent:
            return True
        _last_sent[email] = now
        return False


def send_supabase_reset(email: str) -> None:
    """Ask Supabase to email its reset link, which opens /reset-password."""
    s = get_settings()
    if not (s.supabase_url and s.supabase_service_role_key):
        log.info("[reset email not sent: Supabase is not set up] %s", email)
        return
    key = s.supabase_service_role_key
    try:
        r = httpx.post(
            f"{s.supabase_url.rstrip('/')}/auth/v1/recover",
            params={"redirect_to": f"{s.frontend_url.rstrip('/')}/reset-password"},
            headers={"apikey": key, "Authorization": f"Bearer {key}"},
            json={"email": email},
            timeout=20,
        )
        if r.status_code >= 300:
            log.warning("Supabase refused the reset email (%s): %s", r.status_code, r.text[:200])
    except httpx.HTTPError as e:
        log.error("Could not reach Supabase for a reset email: %s", type(e).__name__)


def should_send(db: Session, email: str, role: UserRole) -> bool:
    """True only if the address belongs to an account of this role (and was not just sent one)."""
    email = email.strip().lower()
    account_role = db.scalar(select(AppUser.role).where(func.lower(AppUser.email) == email))
    if account_role is None:
        # No account here. (Someone who never finished signing up uses the sign-up page again.)
        log.info("Reset asked for an email with no account (%s screen)", role.value)
        return False
    if account_role != role:
        log.info("Reset asked on the %s screen for a %s account: not sent", role.value, account_role.value)
        return False
    if _cooling_down(email):
        log.info("Reset email for this address was sent less than a minute ago: not sent again")
        return False
    return True
