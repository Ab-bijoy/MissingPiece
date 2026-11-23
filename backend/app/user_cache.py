"""Remember who is logged in for a short while, to skip one database trip per request.

Every authenticated request starts by looking up the app_user for its token: one
round trip (about 0.2 s to a far-away database), even before the page's own work.
The row is kept in memory for USER_TTL seconds instead.

Safety:
- Any change to an account through the ORM (status, name, approval, deletion) clears
  its entry at once (the after_flush hook below), so a suspended account is refused
  on its next request, not 30 seconds later.
- A cached row is attached to the request's session with merge(load=False): no query,
  and changes to it are still saved normally.
- Per process. With several server processes, a change made in one is seen by the
  others within USER_TTL seconds.
"""

import threading
import time
import uuid

from sqlalchemy import event, inspect, select
from sqlalchemy.orm import Session, make_transient_to_detached

from app.models import AppUser

USER_TTL = 30.0
_COLUMNS = [attr.key for attr in inspect(AppUser).column_attrs]
_cache: dict[uuid.UUID, tuple[float, dict]] = {}
_lock = threading.Lock()


def forget(supabase_user_id: uuid.UUID | None) -> None:
    if supabase_user_id is not None:
        with _lock:
            _cache.pop(supabase_user_id, None)


def clear() -> None:
    with _lock:
        _cache.clear()


def load_user(db: Session, supabase_user_id: uuid.UUID) -> AppUser | None:
    """The app_user for a Supabase user id, from memory when recently loaded."""
    now = time.monotonic()
    with _lock:
        hit = _cache.get(supabase_user_id)
    if hit and now - hit[0] < USER_TTL:
        u = AppUser(**hit[1])
        make_transient_to_detached(u)  # looks like a row that was loaded before
        return db.merge(u, load=False)  # attach to this session without a query
    u = db.scalar(select(AppUser).where(AppUser.supabase_user_id == supabase_user_id))
    if u is not None:
        with _lock:
            _cache[supabase_user_id] = (now, {k: getattr(u, k) for k in _COLUMNS})
    return u


@event.listens_for(Session, "after_flush")
def _forget_changed_accounts(session: Session, _context) -> None:
    for obj in (*session.new, *session.dirty, *session.deleted):
        if isinstance(obj, AppUser):
            forget(obj.supabase_user_id)
