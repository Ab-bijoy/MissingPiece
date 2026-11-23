"""Community queries and transactional participation changes."""

from datetime import datetime
from zoneinfo import ZoneInfo

from sqlalchemy import or_, select

from app.errors import ApiError, must, not_found
from app.models import Comment, EventMembership, Need, Offer, Project
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


def feed_items(db, projects, user):
    """The feed page: about 10 queries in total, whatever the number of programs."""
    if not projects:
        return []
    pids = [p.id for p in projects]
    needs = loaders.needs_by_project(db, pids)
    holds = loaders.holding_offers(db, (n.id for ns in needs.values() for n in ns))
    roots, replies = loaders.comment_previews(db, pids)
    # One name lookup for organizers and comment authors together
    nm = loaders.names(
        db, [p.organizer_id for p in projects] + [c.user_id for c in roots] + [r.user_id for r in replies.values()]
    )
    facts = loaders.event_facts_many(db, projects, known_names=nm)
    community = loaders.community_fields_many(db, projects, user, facts)

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


def joinable_project(db, project_id):
    # Serialize capacity allocation and repeated joins for this project.
    p = db.scalar(select(Project).where(Project.id == project_id).with_for_update())
    if p is None or p.status != ProjectStatus.live or p.event_date < local_today():
        raise ApiError(409, "This program is not accepting applications.", "closed")
    return p


def leave(db, user, project_id):
    """Cancel only the caller's attendance; share the join lock to serialize seat changes."""
    p = joinable_project(db, project_id)
    m = db.scalar(select(EventMembership).where(EventMembership.user_id == user.id, EventMembership.project_id == p.id))
    if m is None:
        return  # Idempotent retry: their seat is already free.
    if m.role != MembershipRole.participant:
        raise ApiError(409, "Withdraw your helper offer instead.", "not_participant")
    db.delete(m)
    db.commit()


def join(db, user, project_id, body):
    p = joinable_project(db, project_id)
    existing = db.scalar(
        select(EventMembership).where(
            EventMembership.user_id == user.id,
            EventMembership.project_id == p.id,
        )
    )
    switching = body.switch_from_participant
    if switching:
        if not existing or existing.role != MembershipRole.participant:
            raise ApiError(
                409, "You are no longer attending as a participant. Refresh this program.", "not_participant"
            )
    elif existing:
        old = db.get(Offer, existing.offer_id) if existing.offer_id else None
        if not old or old.stage not in (OfferStage.withdrawn, OfferStage.declined, OfferStage.expired):
            raise ApiError(409, "You already joined this program.", "already_joined")
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
    # Change the membership only after every validation succeeds. One transaction
    # releases the participant seat and creates the pending helper application.
    m = existing or EventMembership(user_id=user.id, project_id=p.id)
    m.role = body.role
    m.status = MembershipStatus.pending if offer else MembershipStatus.approved
    m.offer_id = offer.id if offer else None
    db.add(m)
    db.flush()
    if offer:
        notify(
            db, p.organizer_id, NotificationType.membership_pending, m.id, f"{user.name} offered to help at {p.name}."
        )
    db.commit()


def memberships(db, user):
    """My contributions: 5 queries for any number of memberships."""
    rows = db.scalars(
        select(EventMembership)
        .where(EventMembership.user_id == user.id)
        .order_by(EventMembership.created_at.desc(), EventMembership.id)
    ).all()
    if not rows:
        return []
    projects = {p.id: p for p in db.scalars(select(Project).where(Project.id.in_({m.project_id for m in rows})))}
    offer_ids = {m.offer_id for m in rows if m.offer_id}
    offers = {o.id: o for o in db.scalars(select(Offer).where(Offer.id.in_(offer_ids)))} if offer_ids else {}
    need_ids = {o.need_id for o in offers.values()}
    needs = {n.id: n for n in db.scalars(select(Need).where(Need.id.in_(need_ids)))} if need_ids else {}
    nm = loaders.names(db, (p.organizer_id for p in projects.values()))
    result = []
    for m in rows:
        p = must(projects.get(m.project_id))
        o = offers.get(m.offer_id) if m.offer_id else None
        n = needs.get(o.need_id) if o else None
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
                    "organizer_name": nm.get(p.organizer_id, "Someone"),
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
