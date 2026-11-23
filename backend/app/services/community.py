"""Community queries and transactional participation changes."""

from datetime import datetime
from zoneinfo import ZoneInfo

from sqlalchemy import func, or_, select

from app.errors import ApiError, must, not_found
from app.models import Comment, EventMembership, Need, Offer, Project
from app.models.enums import (
    CommentStatus,
    MembershipStatus,
    NeedType,
    NotificationType,
    OfferStage,
    ProjectStatus,
    UserRole,
)
from app.services.notifications import notify
from app.services.views import event_facts, holding_offer, name_of, qty_text


def local_today():
    return datetime.now(ZoneInfo("Asia/Dhaka")).date()


def public_project(db, project_id):
    p = db.get(Project, project_id)
    if p is None or p.status == ProjectStatus.draft:
        raise not_found("Program")
    return p


def membership(db, project_id, user):
    if user is None:
        return None
    m = db.scalar(
        select(EventMembership).where(
            EventMembership.project_id == project_id,
            EventMembership.user_id == user.id,
        )
    )
    if m and m.offer_id:
        offer = db.get(Offer, m.offer_id)
        if offer and offer.stage in (OfferStage.withdrawn, OfferStage.expired, OfferStage.declined):
            return None
    return {"id": m.id, "role": m.role, "status": m.status} if m else None


def comment_query(p, user):
    q = select(Comment).where(Comment.project_id == p.id)
    if user and (user.id == p.organizer_id or user.role == UserRole.admin):
        return q
    visible = Comment.status == CommentStatus.visible
    return q.where(or_(visible, Comment.user_id == user.id) if user else visible)


def comment_out(db, c):
    return {
        "id": c.id,
        "project_id": c.project_id,
        "user_id": c.user_id,
        "author_name": name_of(db, c.user_id),
        "is_organizer": c.user_id == db.get(Project, c.project_id).organizer_id,
        "parent_id": c.parent_id,
        "kind": c.kind,
        "body": c.body,
        "status": c.status,
        "created_at": c.created_at,
    }


def community_fields(db, p, user):
    facts = event_facts(db, p)
    m = membership(db, p.id, user)
    offer_id = db.get(EventMembership, m["id"]).offer_id if m else None
    count = db.scalar(
        select(func.count())
        .select_from(Comment)
        .where(
            Comment.project_id == p.id,
            Comment.status == CommentStatus.visible,
        )
    )
    return {
        "my_membership": m,
        "my_offer_id": offer_id,
        "comment_count": count,
        "seats_left": max(0, p.audience - facts.participants),
    }


def feed_item(db, p, user):
    needs = db.scalars(select(Need).where(Need.project_id == p.id).order_by(Need.created_at, Need.id)).all()
    opened = [n for n in needs if holding_offer(db, n.id) is None]
    comments = db.scalars(
        select(Comment)
        .where(
            Comment.project_id == p.id,
            Comment.status == CommentStatus.visible,
            Comment.parent_id.is_(None),
        )
        .order_by(Comment.created_at.desc(), Comment.id)
        .limit(2)
    ).all()
    previews = []
    for c in comments:
        reply = db.scalar(
            select(Comment)
            .where(
                Comment.parent_id == c.id,
                Comment.status == CommentStatus.visible,
            )
            .order_by(Comment.created_at, Comment.id)
            .limit(1)
        )
        previews.append({**comment_out(db, c), "reply": comment_out(db, reply) if reply else None})
    return {
        **event_facts(db, p).model_dump(),
        **community_fields(db, p, user),
        "description": p.description,
        "posted_at": p.created_at,
        "still_needed": [f"{qty_text(n)} for {n.title.lower()}" for n in opened],
        "help_needed": [
            {"need_id": n.id, "title": n.title, "text": qty_text(n)}
            for n in opened
            if n.type in (NeedType.skill, NeedType.time, NeedType.equipment, NeedType.space)
        ],
        "comments_preview": previews,
    }


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
        if event_facts(db, p).participants >= p.audience:
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
    rows = db.scalars(
        select(EventMembership)
        .where(EventMembership.user_id == user.id)
        .order_by(EventMembership.created_at.desc(), EventMembership.id)
    ).all()
    result = []
    for m in rows:
        p = must(db.get(Project, m.project_id))
        o = db.get(Offer, m.offer_id) if m.offer_id else None
        n = db.get(Need, o.need_id) if o else None
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
                    "organizer_name": name_of(db, p.organizer_id),
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
