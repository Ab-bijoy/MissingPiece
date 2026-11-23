"""EmailService (build prompt 10): approval and rejection notices.

Supabase only sends its own log-in emails (confirm sign-up, reset password),
so notices like "your registration was approved" are sent by this backend.

- SMTP (for example the same Gmail account and App password you set in
  Supabase) when SMTP_HOST, SMTP_USER and SMTP_PASSWORD are filled in.
- Otherwise the email is written to the server log instead (the fake).

Emails are sent in the background after the decision is saved, so a mail
problem never undoes an approval; it is logged instead.
"""

import html
import logging
import smtplib
import ssl
from email.message import EmailMessage
from email.utils import formataddr

from app.config import get_settings

log = logging.getLogger("app.email")


def _clean_header(value: str) -> str:
    # No line breaks in headers: they could be used to add fake headers.
    return value.replace("\r", " ").replace("\n", " ").strip()


def send(to: str, subject: str, text: str, html_body: str | None = None) -> bool:
    """Send one email. Returns True when it was handed to the SMTP server."""
    s = get_settings()
    to, subject = _clean_header(to), _clean_header(subject)
    if not s.smtp_enabled:
        log.info("[email not sent: SMTP is off] to=%s subject=%s\n%s", to, subject, text)
        return False

    msg = EmailMessage()
    msg["From"] = formataddr((s.smtp_from_name, s.smtp_from or s.smtp_user))
    msg["To"] = to
    msg["Subject"] = subject
    msg.set_content(text)
    if html_body:
        msg.add_alternative(html_body, subtype="html")

    try:
        context = ssl.create_default_context()
        if s.smtp_port == 465:
            with smtplib.SMTP_SSL(s.smtp_host, s.smtp_port, context=context, timeout=20) as server:
                server.login(s.smtp_user, s.smtp_password)
                server.send_message(msg)
        else:
            with smtplib.SMTP(s.smtp_host, s.smtp_port, timeout=20) as server:
                server.starttls(context=context)
                server.login(s.smtp_user, s.smtp_password)
                server.send_message(msg)
        log.info("Email sent to %s: %s", to, subject)
        return True
    except (smtplib.SMTPException, OSError) as e:
        # Never show the password; the class and message are enough to fix it.
        log.error("Email to %s failed: %s: %s", to, type(e).__name__, e)
        return False


def _layout(title: str, paragraphs: list[str], button: tuple[str, str] | None) -> str:
    """A plain, readable HTML email. Every piece of user text is escaped."""
    body = "".join(f'<p style="margin:0 0 14px">{p}</p>' for p in paragraphs)
    btn = ""
    if button:
        label, url = button
        btn = (
            f'<p style="margin:20px 0"><a href="{html.escape(url, quote=True)}" '
            'style="background:#0E5E52;color:#fff;padding:12px 20px;border-radius:10px;'
            f'text-decoration:none;font-weight:700">{html.escape(label)}</a></p>'
        )
    return (
        '<div style="font:16px/1.5 Arial,sans-serif;color:#1B1F24;max-width:520px">'
        f'<h1 style="font-size:22px;margin:0 0 16px;color:#0E5E52">{html.escape(title)}</h1>'
        f"{body}{btn}"
        '<p style="margin:24px 0 0;color:#4A5259;font-size:14px">MissingPiece</p></div>'
    )


def _login_url(role: str) -> str:
    base = get_settings().frontend_url.rstrip("/")
    return f"{base}/{'organizer' if role == 'organizer' else 'sponsor'}/login"


def registration_approved(to: str, name: str, role: str) -> bool:
    url = _login_url(role)
    who = "organization" if role == "organizer" else "company"
    text = (
        f"Hello {name},\n\nGood news: your {who} has been approved on MissingPiece. "
        f"You can log in now:\n{url}\n\nMissingPiece"
    )
    page = _layout(
        "Your registration was approved",
        [
            f"Hello {html.escape(name)},",
            f"Good news: your {who} has been approved on MissingPiece. You can log in now.",
        ],
        ("Log in", url),
    )
    return send(to, "Your MissingPiece registration was approved", text, page)


def registration_rejected(to: str, name: str, role: str, note: str) -> bool:
    signup = get_settings().frontend_url.rstrip("/") + (
        "/organizer/register" if role == "organizer" else "/sponsor/register"
    )
    text = (
        f"Hello {name},\n\nWe could not approve your MissingPiece registration.\n\nReason: {note}\n\n"
        f"You are welcome to register again with corrected details:\n{signup}\n\nMissingPiece"
    )
    page = _layout(
        "We could not approve your registration",
        [
            f"Hello {html.escape(name)},",
            "We could not approve your MissingPiece registration.",
            f"<strong>Reason:</strong> {html.escape(note)}",
            "You are welcome to register again with corrected details.",
        ],
        ("Register again", signup),
    )
    return send(to, "Your MissingPiece registration was not approved", text, page)
