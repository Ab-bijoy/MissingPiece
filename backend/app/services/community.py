"""Community queries and transactional participation changes."""

from datetime import datetime
from zoneinfo import ZoneInfo

from sqlalchemy import or_, select
from sqlalchemy.orm import aliased

from app.errors import ApiError, not_found
from app.models import AppUser, Comment, EventMembership, Need, Offer, Project
from app.models.enums import (
    CommentStatus,
    MembershipRole,
    MembershipStatus,
    NeedType,
    NotificationType,
    OfferStage,
    ProjectStatus,
    UserRole,
)
from app.services import loaders
from app.services.notifications import notify
from app.services.views import holding_offer, qty_text


def local_today():
    return datetime.now(ZoneInfo("Asia/Dhaka")).date()


def public_project(db, project_id):
    p = db.get(Project, project_id)
    if p is None or p.status == ProjectStatus.draft:
        raise not_found("Program")
    return p


def membership(db, project_id, user):
    m = loaders.my_memberships(db, [project_id], user).get(project_id)
    return m["membership"] if m else None


def comment_query(p, user):
    q = select(Comment).where(Comment.project_id == p.id)
    if user and (user.id == p.organizer_id or user.role == UserRole.admin):
        return q
    visible = Comment.status == CommentStatus.visible
    return q.where(or_(visible, Comment.user_id == user.id) if user else visible)


def comment_out(db, c):
    """One comment (after posting). Lists use comments_out, which loads authors together."""
    p = db.get(Project, c.project_id)  # already in the session: no query
    return loaders.comment_dict(c, loaders.names(db, [c.user_id]), p.organizer_id)


def comments_out(db, p, rows):
    nm = loaders.names(db, (c.user_id for c in rows))
    return [loaders.comment_dict(c, nm, p.organizer_id) for c in rows]


def community_fields(db, p, user):
    """Single-program version, kept for callers that show one program."""
    facts = loaders.event_facts_many(db, [p])
    return loaders.community_fields_many(db, [p], user, facts)[p.id]


def feed_items(db, projects, user, stats=None):
    """The feed page in 3 or 4 queries, whatever the number of programs.

    Pass `stats` when the programs were loaded with loaders.stat_columns() (the feed
    router does): their numbers then come with them, at no extra cost.
    """
    if not projects:
        return []
    pids = [p.id for p in projects]
    stats = stats if stats is not None else loaders.project_stats(db, projects)
    needs, holds = loaders.needs_and_holds(db, pids)  # 1 query
    roots, replies, nm = loaders.comment_previews(db, pids)  # 1 query, names included
    facts = loaders.event_facts_many(db, projects, stats=stats)  # no query
    community = loaders.community_fields_many(db, projects, user, facts, stats)  # 1 query if signed in

    previews_by_project = {pid: [] for pid in pids}
    organizer_of = {p.id: p.organizer_id for p in projects}
    for c in roots:
        org = organizer_of[c.project_id]
        reply = replies.get(c.id)
        previews_by_project[c.project_id].append(
            {**loaders.comment_dict(c, nm, org), "reply": loaders.comment_dict(reply, nm, org) if reply else None}
        )

    items = []
    for p in projects:
        opened = [n for n in needs.get(p.id, []) if n.id not in holds]
        items.append(
            {
                **facts[p.id].model_dump(),
                **community[p.id],
                "description": p.description,
                "posted_at": p.created_at,
                "still_needed": [f"{qty_text(n)} for {n.title.lower()}" for n in opened],
                "help_needed": [
                    {"need_id": n.id, "title": n.title, "text": qty_text(n)}
                    for n in opened
                    if n.type in (NeedType.skill, NeedType.time, NeedType.equipment, NeedType.space)
                ],
                "comments_preview": previews_by_project[p.id],
            }
        )
    return items


def feed_item(db, p, user):
    """Single-program version of feed_items."""
    return feed_items(db, [p], user)[0]


def join(db, user, project_id, body):
    # Serialize capacity allocation and repeated joins for this project.
    p = db.scalar(select(Project).where(Project.id == project_id).with_for_update())
    if p is None or p.status != ProjectStatus.live or p.event_date < local_today():
        raise ApiError(409, "This program is not accepting applications.", "closed")
    existing = db.scalar(
        select(EventMembership).where(
            EventMembership.user_id == user.id,
            EventMembership.project_id == p.id,
        )
    )
    if existing:
        old = db.get(Offer, existing.offer_id) if existing.offer_id else None
        if not old or old.stage not in (OfferStage.withdrawn, OfferStage.declined, OfferStage.expired):
            raise ApiError(409, "You already joined this program.", "already_joined")
        db.delete(existing)
        db.flush()
    offer = None
    if body.role == "participant":
        if loaders.member_counts(db, [p.id]).get(p.id, {}).get(MembershipRole.participant, 0) >= p.audience:
            raise ApiError(409, "This program is full.", "full")
    else:
        n = db.scalar(select(Need).where(Need.id == body.need_id, Need.project_id == p.id).with_for_update())
        if not n or n.type not in (NeedType.skill, NeedType.time, NeedType.equipment, NeedType.space):
            raise ApiError(422, "Choose an eligible contribution need.", "invalid_need")
        if holding_offer(db, n.id) or (n.deadline and n.deadline < local_today()):
            raise ApiError(409, "This need is no longer open.", "need_covered")
        if body.contribution_role == "trainer" and n.type != NeedType.skill:
            raise ApiError(422, "Trainer applications require a skill need.", "invalid_role")
        start, end = body.slot_start or n.slot_start, body.slot_end or n.slot_end
        if not start or not end or end <= start:
            raise ApiError(422, "A valid contribution time slot is required.", "invalid_slot")
        if (n.slot_start and start < n.slot_start) or (n.slot_end and end > n.slot_end):
            raise ApiError(422, "Availability must fit the requested slot.", "invalid_slot")
        if end <= datetime.now(ZoneInfo("UTC")):
            raise ApiError(422, "Availability must be in the future.", "invalid_slot")
        offer = Offer(
            need_id=n.id,
            from_user_id=user.id,
            stage=OfferStage.offered,
            contribution_role=body.contribution_role,
            slot_start=start,
            slot_end=end,
            resource=n.title.strip().lower() if n.type in (NeedType.equipment, NeedType.space) else None,
        )
        db.add(offer)
        db.flush()
    m = EventMembership(
        user_id=user.id,
        project_id=p.id,
        role=body.role,
        status=MembershipStatus.pending if offer else MembershipStatus.approved,
        offer_id=offer.id if offer else None,
    )
    db.add(m)
    db.flush()
    if offer:
        notify(
            db, p.organizer_id, NotificationType.membership_pending, m.id, f"{user.name} offered to help at {p.name}."
        )
    db.commit()


def memberships(db, user):
    """My contributions: one query for any number of memberships."""
    organizer = aliased(AppUser)
    rows = db.execute(
        select(EventMembership, Project, Offer, Need, organizer.name)
        .join(Project, Project.id == EventMembership.project_id)
        .outerjoin(Offer, Offer.id == EventMembership.offer_id)
        .outerjoin(Need, Need.id == Offer.need_id)
        .outerjoin(organizer, organizer.id == Project.organizer_id)
        .where(EventMembership.user_id == user.id)
        .order_by(EventMembership.created_at.desc(), EventMembership.id)
    ).all()
    result = []
    for m, p, o, n, organizer_name in rows:
        result.append(
            {
                "membership_id": m.id,
                "role": m.role,
                "status": m.status,
                "project": {
                    "id": p.id,
                    "name": p.name,
                    "event_date": p.event_date,
                    "venue": p.venue,
                    "organizer_name": organizer_name or "Someone",
                    "status": p.status,
                },
                "offer": {
                    "id": o.id,
                    "stage": o.stage,
                    "need_title": n.title,
                    "need_type": n.type,
                    "contribution_role": o.contribution_role,
                    "slot_start": o.slot_start,
                    "slot_end": o.slot_end,
                }
                if o
                else None,
            }
        )
    return result
