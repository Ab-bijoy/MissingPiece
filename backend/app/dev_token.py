"""Print a test token for a seeded account (needs DEV_AUTH=true in .env).

    poetry run python -m app.dev_token csr@examplesoftware.example

Use it as `Authorization: Bearer <token>`, for example in the /docs page's
Authorize button. Development only.
"""

import sys

from sqlalchemy import select

from app.auth import make_dev_token
from app.config import get_settings
from app.db import SessionLocal
from app.models import AppUser


def main() -> None:
    if not get_settings().dev_auth:
        raise SystemExit("DEV_AUTH is off. Set DEV_AUTH=true in backend/.env to use dev tokens.")
    email = (sys.argv[1] if len(sys.argv) > 1 else "csr@examplesoftware.example").lower()
    with SessionLocal() as db:
        u = db.scalar(select(AppUser).where(AppUser.email == email))
        if u is None:
            raise SystemExit(f"No account with email {email}. Run: poetry run python -m app.seed")
        print(make_dev_token(u.supabase_user_id, u.email))


if __name__ == "__main__":
    main()
