"""Auth and registration (build prompt 3 and 7.1)."""

import uuid

import pytest

from app.auth import make_dev_token
from app.routers import auth as auth_router

PDF = b"%PDF-1.4 demo document"


class MemoryStorage:
    def __init__(self):
        self.files: dict[str, bytes] = {}

    def upload(self, key, data, content_type):
        self.files[key] = data

    def signed_url(self, key, seconds=300):
        return None


@pytest.fixture
def store(monkeypatch):
    s = MemoryStorage()
    monkeypatch.setattr(auth_router, "storage", lambda: s)  # never touch real storage in tests
    return s


def new_login(email=None):
    """A verified Supabase user who has no profile yet."""
    email = email or f"{uuid.uuid4().hex[:10]}@test.example"
    return {"Authorization": f"Bearer {make_dev_token(uuid.uuid4(), email)}"}, email


def test_me_before_and_after_registering_a_general_user(client):
    h, email = new_login()
    r = client.get("/api/auth/me", headers=h)
    assert r.status_code == 404 and r.json()["code"] == "no_profile"
    r = client.post("/api/auth/register/user", json={"name": " Aisha Test ", "age": 34}, headers=h)
    assert r.status_code == 201, r.text
    assert r.json() | {"id": None} == {
        "id": None,
        "email": email,
        "role": "general",
        "status": "active",
        "name": "Aisha Test",
        "age": 34,
        "rejection_note": None,
        "profile": None,
    }
    assert client.get("/api/auth/me", headers=h).json()["status"] == "active"
    # Registering twice is refused
    assert (
        client.post("/api/auth/register/user", json={"name": "Again"}, headers=h).json()["code"] == "already_registered"
    )


def test_register_organizer_with_proof_waits_for_admin(client, store):
    h, _ = new_login()
    r = client.post(
        "/api/auth/register/organizer",
        data={
            "org_name": "Test Club",
            "org_type": "university",
            "registration_number": "TC-1",
            "contact_person": "Nadia",
            "phone": "01700000000",
        },
        files={"proof": ("certificate.pdf", PDF, "application/pdf")},
        headers=h,
    )
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["role"] == "organizer" and body["status"] == "pending_approval"
    assert body["profile"]["org_type"] == "university"
    assert list(store.files.values()) == [PDF]
    # A pending organizer is refused on every non-auth endpoint (build prompt test 12)
    assert client.get("/api/events", headers=h).json()["code"] == "not_active"


def test_register_sponsor_with_trade_licence(client, store):
    h, _ = new_login()
    png = b"\x89PNG\r\n\x1a\n" + b"0" * 100
    r = client.post(
        "/api/auth/register/sponsor",
        data={
            "company": "Test Co.",
            "industry": "Food",
            "trade_license_number": "TL-9",
            "contact_person": "Tanvir",
            "phone": "01700000000",
        },
        files={"trade_license": ("licence.png", png, "image/png")},
        headers=h,
    )
    assert r.status_code == 201, r.text
    assert r.json()["role"] == "sponsor" and r.json()["profile"]["company"] == "Test Co."


@pytest.mark.parametrize(
    ("filename", "content", "ctype", "code"),
    [
        ("virus.exe", b"MZ....", "application/octet-stream", "file_type"),
        ("fake.pdf", b"MZ not a pdf", "application/pdf", "file_type"),
        ("big.pdf", b"%PDF" + b"0" * (5 * 1024 * 1024), "application/pdf", "file_too_large"),
    ],
)
def test_bad_documents_refused(client, store, filename, content, ctype, code):
    h, _ = new_login()
    r = client.post(
        "/api/auth/register/organizer",
        data={
            "org_name": "X",
            "org_type": "ngo",
            "registration_number": "1",
            "contact_person": "Y",
            "phone": "01700000000",
        },
        files={"proof": (filename, content, ctype)},
        headers=h,
    )
    assert r.status_code == 422 and r.json()["code"] == code
    assert store.files == {}


def test_email_already_used_by_another_account(client, f):
    from app.models.enums import UserRole

    taken = f.user(UserRole.general, "Someone")
    h, _ = new_login(taken.email)
    r = client.post("/api/auth/register/user", json={"name": "Copy"}, headers=h)
    assert r.status_code == 409 and r.json()["code"] == "email_taken"


def test_bad_token_refused(client):
    r = client.get("/api/auth/me", headers={"Authorization": "Bearer nonsense"})
    assert r.status_code == 401
