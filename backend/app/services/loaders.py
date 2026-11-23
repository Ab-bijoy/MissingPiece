"""Batch loaders: fetch what a whole page needs in a few queries, not a few per row.

The database is reached over the network, so every query costs a round trip
(about 0.2 s from a development PC). Looping "for each program, query its needs,
then for each need query its offer" multiplies that cost by the number of rows.
Each helper here takes a list of ids and answers for all of them in one query,
returning a dict the caller looks rows up in.

Rule of thumb for new list endpoints: load the page's rows, collect their ids,
call these helpers once, then build the response in plain Python.
"""

import uuid
from collections import defaultdict
from collections.abc import Iterable

from sqlalchemy import func, select, true
from sqlalchemy.orm import Session, aliased

from app.models import AppUser, Benefit, Comment, EventMembership, Need, Offer, Payment, Project, Template
from app.models.enums import CommentStatus, MembershipRole, MembershipStatus, OfferStage
from app.schemas.common import EventFacts

HOLDING = (OfferStage.accepted, OfferStage.received)
# A membership whose offer ended in one of these no longer counts as "joined"
ENDED = (OfferStage.withdrawn, OfferStage.expired, OfferStage.declined)


def _ids(values: Iterable[uuid.UUID | None]) -> list[uuid.UUID]:
    return list({v for v in values if v is not None})


def names(db: Session, user_ids: Iterable[uuid.UUID | None]) -> dict[uuid.UUID, str]:
    """Display names; look up with .get(id, "Someone")."""
    ids = _ids(user_ids)
    if not ids:
        return {}
    return dict(db.execute(select(AppUser.id, AppUser.name).where(AppUser.id.in_(ids))).all())


def needs_by_project(db: Session, project_ids: list[uuid.UUID]) -> dict[uuid.UUID, list[Need]]:
    out: dict[uuid.UUID, list[Need]] = defaultdict(list)
    if project_ids:
        rows = db.scalars(select(Need).where(Need.project_id.in_(project_ids)).order_by(Need.created_at, Need.id)).all()
        for n in rows:
            out[n.project_id].append(n)
    return out


def holding_offers(db: Session, need_ids: Iterable[uuid.UUID]) -> dict[uuid.UUID, Offer]:
    """The accepted or received offer covering each need, for the needs that have one."""
    ids = _ids(need_ids)
    if not ids:
        return {}
    out: dict[uuid.UUID, Offer] = {}
    rows = db.scalars(
        select(Offer).where(Offer.need_id.in_(ids), Offer.stage.in_(HOLDING)).order_by(Offer.created_at)
    ).all()
    for o in rows:
        out.setdefault(o.need_id, o)
    return out


def member_counts(db: Session, project_ids: list[uuid.UUID]) -> dict[uuid.UUID, dict[MembershipRole, int]]:
    """Approved participants and contributors per program."""
    out: dict[uuid.UUID, dict[MembershipRole, int]] = defaultdict(dict)
    if project_ids:
        rows = db.execute(
            select(EventMembership.project_id, EventMembership.role, func.count())
            .where(EventMembership.project_id.in_(project_ids), EventMembership.status == MembershipStatus.approved)
            .group_by(EventMembership.project_id, EventMembership.role)
        ).all()
        for pid, role, count in rows:
            out[pid][role] = count
    return out


def template_types(db: Session, projects: Iterable[Project]) -> dict[uuid.UUID, str]:
    ids = _ids(p.template_id for p in projects)
    if not ids:
        return {}
    return dict(db.execute(select(Template.id, Template.project_type).where(Template.id.in_(ids))).all())


def stat_columns() -> list:
    """Per-program numbers as correlated subqueries, to add to a query on Project.

    Selecting `Project, *stat_columns()` loads the programs and their organizer name,
    type, member counts and comment count in one round trip.
    """

    def members(role: MembershipRole):
        return (
            select(func.count())
            .where(
                EventMembership.project_id == Project.id,
                EventMembership.status == MembershipStatus.approved,
                EventMembership.role == role,
            )
            .correlate(Project)
            .scalar_subquery()
        )

    return [
        select(AppUser.name)
        .where(AppUser.id == Project.organizer_id)
        .correlate(Project)
        .scalar_subquery()
        .label("organizer_name"),
        select(Template.project_type)
        .where(Template.id == Project.template_id)
        .correlate(Project)
        .scalar_subquery()
        .label("project_type"),
        members(MembershipRole.participant).label("participants"),
        members(MembershipRole.contributor).label("contributors"),
        select(func.count())
        .where(Comment.project_id == Project.id, Comment.status == CommentStatus.visible)
        .correlate(Project)
        .scalar_subquery()
        .label("comment_count"),
    ]


STAT_KEYS = ("organizer_name", "project_type", "participants", "contributors", "comment_count")


def stats_of(row) -> dict:
    """The numbers from one row of select(Project, *stat_columns())."""
    return {k: getattr(row, k) for k in STAT_KEYS}


def project_stats(db: Session, projects: list[Project]) -> dict[uuid.UUID, dict]:
    """The same numbers for programs that are already loaded: one query."""
    if not projects:
        return {}
    rows = db.execute(select(Project.id, *stat_columns()).where(Project.id.in_([p.id for p in projects]))).all()
    return {row.id: stats_of(row) for row in rows}


def event_facts_many(
    db: Session, projects: list[Project], known_names: dict | None = None, stats: dict | None = None
) -> dict[uuid.UUID, EventFacts]:
    """EventFacts for every program: one query, or none when `stats` is passed in."""
    stats = stats if stats is not None else project_stats(db, projects)
    return {p.id: build_facts(p, stats[p.id]) for p in projects}


def build_facts(p: Project, st: dict) -> EventFacts:
    return EventFacts(
        id=p.id,
        name=p.name,
        project_type=st["project_type"] if p.template_id else None,
        organizer_name=st["organizer_name"] or "Someone",
        institution=p.institution,
        event_date=p.event_date,
        venue=p.venue,
        audience=p.audience,
        status=p.status.value,
        participants=st["participants"] or 0,
        contributors=st["contributors"] or 0,
    )


def needs_and_holds(
    db: Session, project_ids: list[uuid.UUID]
) -> tuple[dict[uuid.UUID, list[Need]], dict[uuid.UUID, OfferStage]]:
    """Each program's needs, and the stage of the offer covering each covered need: one query."""
    needs: dict[uuid.UUID, list[Need]] = defaultdict(list)
    holds: dict[uuid.UUID, OfferStage] = {}
    if not project_ids:
        return needs, holds
    hold = (
        select(Offer.stage)
        .where(Offer.need_id == Need.id, Offer.stage.in_(HOLDING))
        .order_by(Offer.created_at)
        .limit(1)
        .correlate(Need)
        .scalar_subquery()
        .label("hold")
    )
    rows = db.execute(
        select(Need, hold).where(Need.project_id.in_(project_ids)).order_by(Need.created_at, Need.id)
    ).all()
    for n, stage in rows:
        needs[n.project_id].append(n)
        if stage is not None:
            holds[n.id] = stage
    return needs, holds


def visible_comment_counts(db: Session, project_ids: list[uuid.UUID]) -> dict[uuid.UUID, int]:
    if not project_ids:
        return {}
    return dict(
        db.execute(
            select(Comment.project_id, func.count())
            .where(Comment.project_id.in_(project_ids), Comment.status == CommentStatus.visible)
            .group_by(Comment.project_id)
        ).all()
    )


def my_memberships(db: Session, project_ids: list[uuid.UUID], user: AppUser | None) -> dict[uuid.UUID, dict]:
    """The viewer's membership per program as {"membership": {...} | None, "offer_id": ...}.

    A membership whose contribution offer was withdrawn, declined or expired counts
    as not joined (the person may apply again). One query.
    """
    if user is None or not project_ids:
        return {}
    rows = db.execute(
        select(EventMembership, Offer.stage)
        .outerjoin(Offer, Offer.id == EventMembership.offer_id)
        .where(EventMembership.project_id.in_(project_ids), EventMembership.user_id == user.id)
    ).all()
    out = {}
    for m, stage in rows:
        if m.offer_id and stage in ENDED:
            continue
        out[m.project_id] = {"membership": {"id": m.id, "role": m.role, "status": m.status}, "offer_id": m.offer_id}
    return out


def community_fields_many(
    db: Session,
    projects: list[Project],
    user: AppUser | None,
    facts: dict[uuid.UUID, EventFacts],
    stats: dict | None = None,
) -> dict[uuid.UUID, dict]:
    pids = [p.id for p in projects]
    mine = my_memberships(db, pids, user)
    if stats is not None:
        counts = {pid: st["comment_count"] or 0 for pid, st in stats.items()}
    else:
        counts = visible_comment_counts(db, pids)
    out = {}
    for p in projects:
        m = mine.get(p.id)
        out[p.id] = {
            "my_membership": m["membership"] if m else None,
            "my_offer_id": m["offer_id"] if m else None,
            "comment_count": counts.get(p.id, 0),
            "seats_left": max(0, p.audience - facts[p.id].participants),
        }
    return out


def comment_previews(
    db: Session, project_ids: list[uuid.UUID]
) -> tuple[list[Comment], dict[uuid.UUID, Comment], dict[uuid.UUID, str]]:
    """The two newest visible top-level comments per program, the first visible reply to
    each, and the authors' names. One query for any number of programs: a window
    function picks the top comments, a lateral join picks each one's first reply.
    """
    if not project_ids:
        return [], {}, {}
    rank = (
        func.row_number()
        .over(partition_by=Comment.project_id, order_by=(Comment.created_at.desc(), Comment.id))
        .label("rank")
    )
    top = (
        select(Comment.id, rank)
        .where(
            Comment.project_id.in_(project_ids),
            Comment.status == CommentStatus.visible,
            Comment.parent_id.is_(None),
        )
        .subquery()
    )
    reply_table = aliased(Comment)
    first_reply = (
        select(reply_table)
        .where(reply_table.parent_id == Comment.id, reply_table.status == CommentStatus.visible)
        .order_by(reply_table.created_at, reply_table.id)
        .limit(1)
        .correlate(Comment)
        .lateral("first_reply")
    )
    Reply = aliased(Comment, first_reply)
    author = aliased(AppUser)
    reply_author = aliased(AppUser)
    rows = db.execute(
        select(Comment, author.name, Reply, reply_author.name)
        .join(top, top.c.id == Comment.id)
        .outerjoin(author, author.id == Comment.user_id)
        .outerjoin(first_reply, true())
        .outerjoin(reply_author, reply_author.id == first_reply.c.user_id)
        .where(top.c.rank <= 2)
        .order_by(Comment.project_id, top.c.rank)
    ).all()
    roots, replies, nm = [], {}, {}
    for c, name, reply, reply_name in rows:
        roots.append(c)
        if name is not None:
            nm[c.user_id] = name
        if reply is not None:
            replies[c.id] = reply
            if reply_name is not None:
                nm[reply.user_id] = reply_name
    return roots, replies, nm


def comment_dict(c: Comment, nm: dict[uuid.UUID, str], organizer_id: uuid.UUID) -> dict:
    return {
        "id": c.id,
        "project_id": c.project_id,
        "user_id": c.user_id,
        "author_name": nm.get(c.user_id, "Someone"),
        "is_organizer": c.user_id == organizer_id,
        "parent_id": c.parent_id,
        "kind": c.kind,
        "body": c.body,
        "status": c.status,
        "created_at": c.created_at,
    }


def latest_payment_status(db: Session, offer_ids: Iterable[uuid.UUID]) -> dict[uuid.UUID, str]:
    """Status of each offer's most recent payment attempt."""
    ids = _ids(offer_ids)
    if not ids:
        return {}
    rank = func.row_number().over(partition_by=Payment.offer_id, order_by=Payment.created_at.desc()).label("rank")
    sub = select(Payment.offer_id, Payment.status, rank).where(Payment.offer_id.in_(ids)).subquery()
    rows = db.execute(select(sub.c.offer_id, sub.c.status).where(sub.c.rank == 1)).all()
    return {oid: getattr(status, "value", status) for oid, status in rows}


def benefit_flags(db: Session, offer_ids: Iterable[uuid.UUID]) -> dict[uuid.UUID, list[bool]]:
    """The `given` flag of every benefit, per offer."""
    ids = _ids(offer_ids)
    out: dict[uuid.UUID, list[bool]] = defaultdict(list)
    if ids:
        for oid, given in db.execute(select(Benefit.offer_id, Benefit.given).where(Benefit.offer_id.in_(ids))):
            out[oid].append(given)
    return out
