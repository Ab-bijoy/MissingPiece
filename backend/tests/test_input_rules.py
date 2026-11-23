"""Input rules: age 13 to 100, phone numbers are 11-digit Bangladeshi mobiles."""

import pytest

from app.models.enums import UserRole
from tests.conftest import auth
from tests.test_auth import PDF, new_login, store  # noqa: F401 (store is a fixture)


@pytest.mark.parametrize(("age", "code"), [(12, 422), (101, 422), (999, 422), (13, 201), (100, 201)])
def test_age_on_sign_up(client, age, code):
    h, _ = new_login()
    assert client.post("/api/auth/register/user", json={"name": "Person", "age": age}, headers=h).status_code == code


def test_age_on_profile(client, f):
    h = auth(f.user(UserRole.general, "Person"))
    assert client.patch("/api/me/profile", json={"age": 12}, headers=h).status_code == 422
    assert client.patch("/api/me/profile", json={"age": 45}, headers=h).status_code == 200


def org_form(phone):
    return {
        "org_name": "Test Club",
        "org_type": "university",
        "registration_number": "TC-1",
        "contact_person": "Nadia",
        "phone": phone,
    }


@pytest.mark.parametrize(
    ("phone", "ok"),
    [
        ("01712345678", True),
        ("017-1234-5678", True),  # dashes and spaces are removed
        ("0171234567", False),  # 10 digits
        ("017123456789", False),  # 12 digits
        ("01212345678", False),  # 012 is not a mobile prefix
        ("+8801712345678", False),
        ("abc12", False),
    ],
)
def test_phone_on_organizer_sign_up(client, store, phone, ok):  # noqa: F811
    h, _ = new_login()
    r = client.post(
        "/api/auth/register/organizer",
        data=org_form(phone),
        files={"proof": ("certificate.pdf", PDF, "application/pdf")},
        headers=h,
    )
    assert r.status_code == (201 if ok else 422), r.text
    if ok:
        assert r.json()["profile"]["phone"] == "01712345678"


def test_phone_on_sponsor_profile(client, scene):
    h = auth(scene["sponsor"])
    assert client.patch("/api/sponsor/profile", json={"phone": "abc12"}, headers=h).status_code == 422
    assert client.patch("/api/sponsor/profile", json={"phone": "0171234567"}, headers=h).status_code == 422
    r = client.patch("/api/sponsor/profile", json={"phone": "01812345678"}, headers=h)
    assert r.status_code == 200 and r.json()["phone"] == "01812345678"
