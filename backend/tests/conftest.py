"""Test setup.

There is no separate test database, so every test runs inside one transaction
on the real database and that transaction is ROLLED BACK at the end. Services
still call commit(); those commits only release a savepoint inside it.
Tokens come from the dev token issuer (DEV_AUTH), the "fake token issuer" of
build prompt section 13.
"""

import os
import secrets
import uuid
from collections.abc import Iterator
from datetime import UTC, datetime, timedelta
from decimal import Decimal

os.environ["DEV_AUTH"] = "true"
# Fresh random secrets for each test run (example values are refused by the app).
os.environ["DEV_JWT_SECRET"] = secrets.token_urlsafe(48)
os.environ["PAYMENT_WEBHOOK_SECRET"] = secrets.token_urlsafe(48)
os.environ.setdefault("PAYMENT_PROVIDER", "mock")
# Tests never send real email, even when backend/.env has SMTP filled in.
os.environ["SMTP_HOST"] = ""

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy.orm import Session  # noqa: E402

from app.auth import make_dev_token  # noqa: E402
from app.config import get_settings  # noqa: E402
from app.db import engine, get_db  # noqa: E402
from app.main import app  # noqa: E402
from app.models import (  # noqa: E402
    AppUser,
    MessageThread,
    Need,
    Offer,
    OrganizerProfile,
    Project,
    SponsorProfile,
    SponsorRequest,
)
from app.models.enums import (  # noqa: E402
    AccountStatus,
    NeedStatus,
    NeedType,
    OfferStage,
    OrgType,
    ProjectStatus,
    UserRole,
)

get_settings.cache_clear()


@pytest.fixture(autouse=True)
def _fresh_user_cache():
    from app import user_cache

    user_cache.clear()
    yield
    user_cache.clear()


@pytest.fixture
def db() -> Iterator[Session]:
    conn = engine.connect()
    outer = conn.begin()
    session = Session(bind=conn, join_transaction_mode="create_savepoint", expire_on_commit=False)
    try:
        yield session
    finally:
        session.close()
        outer.rollback()  # nothing a test does is kept
        conn.close()


@pytest.fixture
def client(db: Session, monkeypatch) -> Iterator[TestClient]:
    # Integration tests exercise visibility deterministically, without sending
    # fixture comments to an external AI service or spending API credits.
    from app.services import moderation

    monkeypatch.setattr(get_settings(), "groq_api_key", "test-key-not-used-for-network")
    monkeypatch.setattr(
        moderation, "_request_verdict", lambda body: moderation.Verdict(decision="allow", category="none")
    )
    app.dependency_overrides[get_db] = lambda: db
    try:
        yield TestClient(app)
    finally:
        app.dependency_overrides.clear()


def auth(user: AppUser) -> dict[str, str]:
    return {"Authorization": f"Bearer {make_dev_token(user.supabase_user_id, user.email)}"}


class Factory:
    def __init__(self, db: Session):
        self.db = db

    def user(self, role: UserRole, name: str, status=AccountStatus.active) -> AppUser:
        u = AppUser(
            supabase_user_id=uuid.uuid4(),
            email=f"{uuid.uuid4().hex[:10]}@test.example",
            role=role,
            status=status,
            name=name,
        )
        self.db.add(u)
        self.db.flush()
        if role == UserRole.organizer:
            self.db.add(
                OrganizerProfile(
                    user_id=u.id,
                    org_name=name,
                    org_type=OrgType.ngo,
                    registration_number="T-1",
                    contact_person="T",
                    phone="01700000000",
                )
            )
        if role == UserRole.sponsor:
            self.db.add(
                SponsorProfile(
                    user_id=u.id,
                    company=name,
                    industry="Software",
                    trade_license_number="TL-1",
                    contact_person="T",
                    phone="01700000000",
                )
            )
        self.db.flush()
        return u

    def project(self, organizer: AppUser, days_ahead: int = 30) -> Project:
        p = Project(
            organizer_id=organizer.id,
            name="Test Fest",
            purpose="x",
            description="A test event.",
            event_date=datetime.now(UTC).date() + timedelta(days=days_ahead),
            venue="Hall",
            audience=100,
            status=ProjectStatus.live,
        )
        self.db.add(p)
        self.db.flush()
        return p

    def need(self, project: Project, type_=NeedType.money, qty=20000, unit="BDT") -> Need:
        n = Need(
            project_id=project.id,
            type=type_,
            title="Prize fund" if type_ == NeedType.money else "Projector",
            quantity=Decimal(qty),
            unit=unit,
            budget_item="prizes" if type_ == NeedType.money else None,
        )
        self.db.add(n)
        self.db.flush()
        return n

    def request(self, project: Project, need: Need, sponsor: AppUser) -> SponsorRequest:
        r = SponsorRequest(
            project_id=project.id, need_id=need.id, sponsor_id=sponsor.id, benefits=["Logo on the main banner"]
        )
        self.db.add(r)
        self.db.flush()
        self.db.add(MessageThread(request_id=r.id, organizer_id=project.organizer_id, sponsor_id=sponsor.id))
        self.db.flush()
        return r

    def accept(self, offer_id: uuid.UUID) -> None:
        """What the organizer's accept endpoint will do (organizer module comes later)."""
        o = self.db.get(Offer, offer_id)
        o.stage = OfferStage.accepted
        self.db.get(Need, o.need_id).status = NeedStatus.covered
        self.db.flush()


@pytest.fixture
def f(db: Session) -> Factory:
    return Factory(db)


@pytest.fixture
def scene(f: Factory):
    """An organizer with a live project, a BDT 20,000 money need, and a request sent to a sponsor."""
    org = f.user(UserRole.organizer, "Test Org")
    sponsor = f.user(UserRole.sponsor, "Test Sponsor Co.")
    p = f.project(org)
    n = f.need(p)
    r = f.request(p, n, sponsor)
    return {"org": org, "sponsor": sponsor, "project": p, "need": n, "request": r}
