"""Make an existing account an admin, so it can use /admin/login.

    poetry run python -m app.make_admin you@example.com

The account must already exist (sign up in the app first). This only changes our
database: the role becomes admin and the status active. Run it only for people
on the platform team.
"""

import sys

from sqlalchemy import select

from app.db import SessionLocal
from app.models import AppUser
from app.models.enums import AccountStatus, UserRole


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit("Usage: poetry run python -m app.make_admin you@example.com")
    email = sys.argv[1].strip().lower()
    with SessionLocal() as db:
        u = db.scalar(select(AppUser).where(AppUser.email == email))
        if u is None:
            raise SystemExit(f"No account with email {email}. Sign up in the app first.")
        if u.role in (UserRole.organizer, UserRole.sponsor):
            raise SystemExit(f"{email} is an {u.role.value} account. Use a separate account for admin work.")
        u.role = UserRole.admin
        u.status = AccountStatus.active
        db.commit()
        print(f"{email} is now an admin. Log in at /admin/login.")


if __name__ == "__main__":
    main()
