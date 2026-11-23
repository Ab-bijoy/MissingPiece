"""Forgot password per log-in screen: the reset email goes only to accounts of that role.

Found in testing (23 Nov 2026): the sponsor page's "Forgot password?" sent a reset
link for an admin account.
"""

import pytest

from app.models.enums import UserRole
from app.services import password_reset


@pytest.fixture
def sent(monkeypatch):
    emails = []
    monkeypatch.setattr(password_reset, "send_supabase_reset", lambda email: emails.append(email))
    monkeypatch.setattr("app.routers.auth.send_supabase_reset", lambda email: emails.append(email))
    password_reset._last_sent.clear()
    return emails


def ask(client, email, role):
    return client.post("/api/auth/password-reset", json={"email": email, "role": role})


def test_only_the_matching_role_gets_a_link(client, f, sent):
    admin = f.user(UserRole.admin, "Admin")
    sponsor = f.user(UserRole.sponsor, "Co.")
    # From the sponsor page: nothing for the admin account, but the same answer
    r = ask(client, admin.email, "sponsor")
    assert r.status_code == 202 and r.json() == {"status": "accepted"}
    assert sent == []
    # From the right pages, the link is sent (email matched without regard to case)
    assert ask(client, admin.email.upper(), "admin").status_code == 202
    assert ask(client, sponsor.email, "sponsor").status_code == 202
    assert sent == [admin.email.lower(), sponsor.email.lower()]


def test_unknown_email_gets_the_same_answer(client, sent):
    r = ask(client, "nobody-here@example.com", "general")
    assert r.status_code == 202 and r.json() == {"status": "accepted"} and sent == []


def test_one_email_per_minute(client, f, sent):
    u = f.user(UserRole.general, "Person")
    ask(client, u.email, "general")
    ask(client, u.email, "general")
    assert len(sent) == 1


def test_bad_input_is_refused(client, sent):
    assert ask(client, "not-an-email", "general").status_code == 422
    assert ask(client, "a@example.com", "superuser").status_code == 422
    assert sent == []
