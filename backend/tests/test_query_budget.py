"""Query budgets: list pages must not run more queries when they show more rows.

Each database query is a network round trip (about 0.2 s to the hosted database),
so a page that queries once per row gets slower with every row. These tests fail
if a per-row query loop creeps back into a list endpoint.
"""

from contextlib import contextmanager
from datetime import UTC, datetime, timedelta

from sqlalchemy import event

from app.db import engine
from app.models import Comment, EventMembership
from app.models.enums import CommentKind, MembershipRole, MembershipStatus, NeedType, UserRole
from tests.conftest import auth


@contextmanager
def count_queries():
    seen = []

    def on_query(conn, cursor, statement, *args):
        seen.append(statement)

    event.listen(engine, "before_cursor_execute", on_query)
    try:
        yield seen
    finally:
        event.remove(engine, "before_cursor_execute", on_query)


def busy_program(f, db, org, commenter):
    """A live program with needs of several kinds, members, and comments with replies."""
    p = f.project(org)
    f.need(p)  # money
    skill = f.need(p, NeedType.skill, 2, "trainers")
    skill.slot_start = datetime.now(UTC) + timedelta(days=5)
    skill.slot_end = skill.slot_start + timedelta(hours=2)
    db.add(
        EventMembership(
            user_id=commenter.id, project_id=p.id, role=MembershipRole.participant, status=MembershipStatus.approved
        )
    )
    for i in range(3):
        c = Comment(project_id=p.id, user_id=commenter.id, kind=CommentKind.question, body=f"Question {i}")
        db.add(c)
        db.flush()
        db.add(Comment(project_id=p.id, user_id=org.id, kind=CommentKind.reply, body="Answer", parent_id=c.id))
    db.flush()
    return p


def queries_for(client, url, headers=None):
    # Warm up first, so the brief account cache (app/user_cache.py) is in the same state
    # for every measurement: only the page's own queries are counted.
    client.get(url, headers=headers or {})
    with count_queries() as seen:
        r = client.get(url, headers=headers or {})
    assert r.status_code == 200, r.text
    return len(seen)


def test_feed_and_events_do_not_grow_with_programs(client, f, db):
    org = f.user(UserRole.organizer, "Busy Org")
    person = f.user(UserRole.general, "Member")
    sponsor = f.user(UserRole.sponsor, "Budget Co.")
    busy_program(f, db, org, person)
    one = {
        "feed": queries_for(client, "/api/feed?limit=200"),
        "feed_signed_in": queries_for(client, "/api/feed?limit=200", auth(person)),
        "events": queries_for(client, "/api/events?limit=200", auth(sponsor)),
    }
    for _ in range(5):
        busy_program(f, db, org, person)
    six = {
        "feed": queries_for(client, "/api/feed?limit=200"),
        "feed_signed_in": queries_for(client, "/api/feed?limit=200", auth(person)),
        "events": queries_for(client, "/api/events?limit=200", auth(sponsor)),
    }
    assert six == one, f"query count grew with more programs: {one} -> {six}"
    # Merged queries (Nov 2026): feed 3 logged out, 4 signed in; events list 2
    assert six["feed"] <= 3 and six["feed_signed_in"] <= 4 and six["events"] <= 2, six


def test_my_contributions_and_comments_do_not_grow(client, f, db):
    org = f.user(UserRole.organizer, "Org")
    person = f.user(UserRole.general, "Member")
    first = busy_program(f, db, org, person)
    one = queries_for(client, "/api/me/memberships", auth(person))
    comments_one = queries_for(client, f"/api/events/{first.id}/comments", auth(person))
    for _ in range(4):
        busy_program(f, db, org, person)
    for i in range(6):
        db.add(
            Comment(
                project_id=first.id,
                user_id=f.user(UserRole.general, f"Guest {i}").id,
                kind=CommentKind.comment,
                body="Hi",
            )
        )
    db.flush()
    assert queries_for(client, "/api/me/memberships", auth(person)) == one
    assert queries_for(client, f"/api/events/{first.id}/comments", auth(person)) == comments_one


def test_sponsor_lists_do_not_grow(client, scene, f, db):
    h = auth(scene["sponsor"])
    inbox_one = queries_for(client, "/api/sponsor/requests", h)
    client.post(f"/api/requests/{scene['request'].id}/offers", json={}, headers=h)
    offers_one = queries_for(client, "/api/sponsor/offers", h)
    for _ in range(4):
        p = f.project(scene["org"])
        n = f.need(p)
        r = f.request(p, n, scene["sponsor"])
        client.post(f"/api/requests/{r.id}/offers", json={}, headers=h)
    assert queries_for(client, "/api/sponsor/requests", h) == inbox_one
    assert queries_for(client, "/api/sponsor/offers", h) == offers_one
