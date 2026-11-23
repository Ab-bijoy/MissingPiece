"""The logged-in account is kept in memory briefly (app/user_cache.py).

It must never let a changed account keep its old rights: a suspension, approval or
name change takes effect on the very next request.
"""

from sqlalchemy import event

from app.db import engine
from app.models.enums import UserRole
from tests.conftest import auth


def queries(client, url, headers):
    seen = []

    def on_query(conn, cursor, statement, *args):
        seen.append(statement)

    event.listen(engine, "before_cursor_execute", on_query)
    try:
        r = client.get(url, headers=headers)
    finally:
        event.remove(engine, "before_cursor_execute", on_query)
    return r, len(seen)


def test_second_request_skips_the_account_lookup(client, f):
    h = auth(f.user(UserRole.general, "Person"))
    _, first = queries(client, "/api/me/profile", h)
    r, second = queries(client, "/api/me/profile", h)
    assert r.status_code == 200 and second == first - 1


def test_suspension_takes_effect_at_once(client, f):
    admin = f.user(UserRole.admin, "Admin")
    person = f.user(UserRole.general, "Person")
    h = auth(person)
    assert client.get("/api/me/profile", headers=h).status_code == 200  # now remembered
    r = client.patch(f"/api/admin/users/{person.id}", json={"status": "suspended"}, headers=auth(admin))
    assert r.status_code == 200, r.text
    assert client.get("/api/me/profile", headers=h).json()["code"] == "not_active"


def test_changes_through_a_remembered_account_are_saved(client, f):
    h = auth(f.user(UserRole.general, "Old Name"))
    client.get("/api/me/profile", headers=h)  # remembered
    assert client.patch("/api/me/profile", json={"name": "New Name"}, headers=h).status_code == 200
    assert client.get("/api/me/profile", headers=h).json()["name"] == "New Name"
    assert client.get("/api/auth/me", headers=h).json()["name"] == "New Name"
