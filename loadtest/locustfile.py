"""Load test for the MissingPiece API (read-only: no offers, payments, messages or projects are created).

Run from your laptop, never on the server itself:

    pip install locust
    locust -f loadtest/locustfile.py --host https://52-65-55-167.sslip.io

then open http://localhost:8089, pick the number of users and the spawn rate, and press Start.

Simulated visitors (each logged-in kind uses ONE test account of that role):
- Visitor    not logged in: health check, public feed, comments on events
- Member     general user: profile, feed, events and event pages, comments, notifications, messages
- Sponsor    sponsor: inbox, request pages, my offers, profile, notifications, messages
- Organizer  organizer: my projects, project dashboard (gaps, readiness, offers, suggestions,
             sent requests, members), templates, profile

Each account logs in to Supabase once at the start and every simulated user of that kind
reuses the token, so the test does not hit Supabase's sign-in rate limit. Tokens last about
an hour: keep runs shorter than that.

Set the accounts you want to include (PowerShell). Use TEST accounts, never a real person's.
A kind whose account is not set simply does not run.
    $env:LOCUST_SUPABASE_URL = "https://<project>.supabase.co"
    $env:LOCUST_SUPABASE_ANON_KEY = "<anon / publishable key>"
    $env:LOCUST_EMAIL = "<general test account>";    $env:LOCUST_PASSWORD = "..."
    $env:LOCUST_SPONSOR_EMAIL = "<sponsor test>";    $env:LOCUST_SPONSOR_PASSWORD = "..."
    $env:LOCUST_ORGANIZER_EMAIL = "<organizer test>"; $env:LOCUST_ORGANIZER_PASSWORD = "..."
"""

import os
import random

from locust import HttpUser, between, events, task  # locust first: it patches networking before requests loads

import requests

TOKENS: dict[str, str] = {}  # role -> access token
ACCOUNTS = {
    "general": ("LOCUST_EMAIL", "LOCUST_PASSWORD"),
    "sponsor": ("LOCUST_SPONSOR_EMAIL", "LOCUST_SPONSOR_PASSWORD"),
    "organizer": ("LOCUST_ORGANIZER_EMAIL", "LOCUST_ORGANIZER_PASSWORD"),
}


@events.test_start.add_listener
def log_in_once(environment, **_):
    """Get one access token per test account before any simulated user starts."""
    url = os.getenv("LOCUST_SUPABASE_URL", "").rstrip("/")
    key = os.getenv("LOCUST_SUPABASE_ANON_KEY", "")
    if not (url and key):
        print("No LOCUST_SUPABASE_URL / LOCUST_SUPABASE_ANON_KEY: running Visitor only.")
        return
    for role, (email_var, password_var) in ACCOUNTS.items():
        email, password = os.getenv(email_var, ""), os.getenv(password_var, "")
        if not (email and password):
            print(f"{role}: no test account set, skipped.")
            continue
        r = requests.post(
            f"{url}/auth/v1/token?grant_type=password",
            headers={"apikey": key, "Content-Type": "application/json"},
            json={"email": email, "password": password},
            timeout=15,
        )
        if r.status_code == 200:
            TOKENS[role] = r.json()["access_token"]
            print(f"{role}: logged in.")
        else:
            print(f"{role}: login failed ({r.status_code}), skipped.")


def pick(items, key="id"):
    """A random id from a list the API returned, or None."""
    ids = [i.get(key) for i in items or [] if isinstance(i, dict) and i.get(key)]
    return random.choice(ids) if ids else None


class SignedIn(HttpUser):
    """Shared setup: attach this role's token, or stop if there is none."""

    abstract = True
    role = ""
    wait_time = between(1, 3)  # seconds between clicks, like a real person

    def on_start(self):
        token = TOKENS.get(self.role)
        if token is None:
            self.stop()
            return
        self.client.headers["Authorization"] = f"Bearer {token}"
        self.event_ids: list = []
        self.thread_ids: list = []

    def get_json(self, path, name):
        with self.client.get(path, name=name, catch_response=True) as r:
            if r.status_code == 200:
                r.success()
                try:
                    return r.json()
                except ValueError:
                    return None
            r.failure(f"HTTP {r.status_code}")
            return None

    def open_threads(self):
        threads = self.get_json("/api/threads?limit=20", "/api/threads")
        thread_id = pick(threads)
        if thread_id:
            self.client.get(f"/api/threads/{thread_id}/messages", name="/api/threads/[id]/messages")


class Visitor(HttpUser):
    """Someone browsing without an account."""

    weight = 1
    wait_time = between(1, 3)

    @task(1)
    def health(self):
        self.client.get("/api/health", name="/api/health")

    @task(4)
    def feed_and_comments(self):
        r = self.client.get("/api/feed?limit=20", name="/api/feed")
        try:
            items = r.json() if r.status_code == 200 else []
        except ValueError:
            items = []
        project_id = pick(items)  # each feed item is a program with its "id"
        if project_id:
            self.client.get(f"/api/events/{project_id}/comments", name="/api/events/[id]/comments")


class Member(SignedIn):
    """A logged-in general user."""

    weight = 3
    role = "general"

    @task(2)
    def me(self):
        self.client.get("/api/auth/me", name="/api/auth/me")

    @task(3)
    def feed(self):
        self.client.get("/api/feed?limit=20", name="/api/feed (logged in)")

    @task(3)
    def events_and_detail(self):
        listed = self.get_json("/api/events?limit=20", "/api/events")
        event_id = pick(listed)
        if event_id:
            self.client.get(f"/api/events/{event_id}", name="/api/events/[id]")
            self.client.get(f"/api/events/{event_id}/comments", name="/api/events/[id]/comments")

    @task(2)
    def notifications(self):
        self.client.get("/api/notifications", name="/api/notifications")

    @task(1)
    def memberships(self):
        self.client.get("/api/me/memberships", name="/api/me/memberships")

    @task(1)
    def profile(self):
        self.client.get("/api/me/profile", name="/api/me/profile")

    @task(1)
    def messages(self):
        self.open_threads()


class Sponsor(SignedIn):
    """A logged-in sponsor."""

    weight = 1
    role = "sponsor"

    @task(3)
    def inbox_and_request(self):
        inbox = self.get_json("/api/sponsor/requests?limit=20", "/api/sponsor/requests")
        request_id = pick(inbox)
        if request_id:
            self.client.get(f"/api/requests/{request_id}", name="/api/requests/[id]")

    @task(2)
    def offers(self):
        self.client.get("/api/sponsor/offers?limit=20", name="/api/sponsor/offers")

    @task(1)
    def profile(self):
        self.client.get("/api/sponsor/profile", name="/api/sponsor/profile")

    @task(2)
    def notifications(self):
        self.client.get("/api/notifications", name="/api/notifications")

    @task(1)
    def messages(self):
        self.open_threads()


class Organizer(SignedIn):
    """A logged-in organizer looking at their project dashboard."""

    weight = 1
    role = "organizer"

    @task(4)
    def dashboard(self):
        projects = self.get_json("/api/projects/mine", "/api/projects/mine")
        project_id = pick(projects)
        if not project_id:
            return
        base = f"/api/projects/{project_id}"
        self.client.get(base, name="/api/projects/[id]")
        self.client.get(f"{base}/gaps", name="/api/projects/[id]/gaps")
        self.client.get(f"{base}/readiness", name="/api/projects/[id]/readiness")
        self.client.get(f"{base}/offers", name="/api/projects/[id]/offers")
        self.client.get(f"{base}/sponsor-matches", name="/api/projects/[id]/sponsor-matches")
        self.client.get(f"{base}/requests", name="/api/projects/[id]/requests")
        self.client.get(f"{base}/memberships", name="/api/projects/[id]/memberships")

    @task(1)
    def templates(self):
        self.client.get("/api/templates", name="/api/templates")

    @task(1)
    def profile(self):
        self.client.get("/api/organizer/profile", name="/api/organizer/profile")

    @task(1)
    def notifications(self):
        self.client.get("/api/notifications", name="/api/notifications")
