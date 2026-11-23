"""Approval and rejection emails: sent after the decision, safe content, never fatal."""

import smtplib

from app.models.enums import AccountStatus, UserRole
from app.services import email
from tests.conftest import auth


def test_approve_and_reject_queue_an_email(client, f, monkeypatch):
    sent = []
    monkeypatch.setattr(email, "send", lambda to, subject, text, html_body=None: sent.append((to, subject, text)))
    admin = f.user(UserRole.admin, "Admin")
    a = f.user(UserRole.sponsor, "Good Co.", status=AccountStatus.pending_approval)
    b = f.user(UserRole.organizer, "Club", status=AccountStatus.pending_approval)

    assert client.post(f"/api/admin/registrations/{a.id}/approve", headers=auth(admin)).status_code == 204
    note = {"note": "The certificate is unreadable."}
    assert client.post(f"/api/admin/registrations/{b.id}/reject", json=note, headers=auth(admin)).status_code == 204

    assert sent[0][0] == a.email and "approved" in sent[0][1] and "/sponsor/login" in sent[0][2]
    assert sent[1][0] == b.email and "not approved" in sent[1][1] and "unreadable" in sent[1][2]


def test_user_text_is_escaped_in_the_html(monkeypatch):
    captured = {}
    monkeypatch.setattr(email, "send", lambda to, subject, text, html_body=None: captured.update(html=html_body))
    email.registration_rejected("x@example.com", "<b>Eve</b>", "sponsor", '<script>alert("x")</script>')
    assert "<script>" not in captured["html"] and "&lt;script&gt;" in captured["html"]
    assert "<b>Eve</b>" not in captured["html"]


def test_header_injection_is_blocked():
    assert "\n" not in email._clean_header("a@example.com\nBcc: evil@example.com")


def test_smtp_failure_does_not_break_approval(client, f, monkeypatch):
    s = email.get_settings()
    monkeypatch.setattr(s, "smtp_host", "smtp.example.com")
    monkeypatch.setattr(s, "smtp_user", "u@example.com")
    monkeypatch.setattr(s, "smtp_password", "x")

    def boom(*args, **kwargs):
        raise smtplib.SMTPAuthenticationError(535, b"bad login")

    monkeypatch.setattr(smtplib, "SMTP_SSL", boom)
    admin = f.user(UserRole.admin, "Admin")
    p = f.user(UserRole.sponsor, "Co.", status=AccountStatus.pending_approval)
    assert client.post(f"/api/admin/registrations/{p.id}/approve", headers=auth(admin)).status_code == 204
    assert client.get("/api/auth/me", headers=auth(p)).json()["status"] == "active"
