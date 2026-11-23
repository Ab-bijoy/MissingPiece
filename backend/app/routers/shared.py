"""Shared endpoints (build prompt 7.6): message threads and notifications."""

import uuid
from datetime import datetime
from typing import Literal

from fastapi import APIRouter, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import func, select, update

from app.auth import DB, ActiveUser
from app.errors import ApiError, forbidden, not_found
from app.models import Message, MessageThread, Need, Notification, Offer, Project, SponsorRequest
from app.models.enums import CommentStatus, NotificationType, OfferStage
from app.schemas.common import Schema
from app.services import moderation
from app.services.notifications import notify
from app.services.views import name_of, qty_text

router = APIRouter(prefix="/api", tags=["shared"])


class ThreadOut(Schema):
    id: uuid.UUID
    request_id: uuid.UUID
    project_id: uuid.UUID
    project_name: str
    need_title: str
    request_summary: str
    organizer_name: str
    sponsor_name: str
    last_message: str | None
    last_at: datetime | None
    unread: int


class MessageOut(Schema):
    id: uuid.UUID
    thread_id: uuid.UUID
    sender_id: uuid.UUID
    sender_name: str
    body: str
    read: bool
    created_at: datetime
    status: str = "visible"


class HiddenMessageReceipt(BaseModel):
    id: uuid.UUID
    status: Literal["hidden"] = "hidden"


class MessageIn(BaseModel):
    body: str = Field(min_length=1, max_length=4000)


class NotificationOut(Schema):
    id: uuid.UUID
    type: str
    ref_id: uuid.UUID | None
    read: bool
    created_at: datetime
    text: str


# ---- Threads (rule 6: organizer and sponsor of that thread only; text only) ---------------


def _my_thread(db, user, thread_id: uuid.UUID) -> MessageThread:
    th = db.get(MessageThread, thread_id)
    if th is None:
        raise not_found("Conversation")
    if user.id not in (th.organizer_id, th.sponsor_id):
        raise forbidden("You can only use conversations opened for you.")
    return th


@router.get("/threads", response_model=list[ThreadOut])
def threads(user: ActiveUser, db: DB, limit: int = Query(50, ge=1, le=200), offset: int = Query(0, ge=0)):
    rows = db.execute(
        select(MessageThread, SponsorRequest, Need, Project)
        .join(SponsorRequest, SponsorRequest.id == MessageThread.request_id)
        .join(Need, Need.id == SponsorRequest.need_id)
        .join(Project, Project.id == SponsorRequest.project_id)
        .where((MessageThread.organizer_id == user.id) | (MessageThread.sponsor_id == user.id))
    ).all()
    out = []
    for th, r, n, p in rows:
        last = db.scalar(
            select(Message)
            .where(Message.thread_id == th.id, Message.status == CommentStatus.visible)
            .order_by(Message.created_at.desc())
            .limit(1)
        )
        unread = db.scalar(
            select(func.count()).where(
                Message.thread_id == th.id,
                Message.status == CommentStatus.visible,
                Message.read.is_(False),
                Message.sender_id != user.id,
            )
        )
        offer = db.scalar(
            select(Offer)
            .where(
                Offer.request_id == r.id,
                Offer.stage.not_in([OfferStage.withdrawn, OfferStage.declined, OfferStage.expired]),
            )
            .order_by(Offer.created_at.desc())
            .limit(1)
        )
        stage_text = f"offer {offer.stage.value}" if offer else "no offer yet"
        out.append(
            ThreadOut(
                id=th.id,
                request_id=r.id,
                project_id=p.id,
                project_name=p.name,
                need_title=n.title,
                request_summary=f"{n.title}, {qty_text(n)} · {stage_text}",
                organizer_name=name_of(db, th.organizer_id),
                sponsor_name=name_of(db, th.sponsor_id),
                last_message=last.body if last else None,
                last_at=last.created_at if last else r.created_at,
                unread=unread or 0,
            )
        )
    out.sort(key=lambda t: t.last_at or datetime.min, reverse=True)
    return out[offset : offset + limit]


@router.get("/threads/{thread_id}/messages", response_model=list[MessageOut])
def messages(thread_id: uuid.UUID, user: ActiveUser, db: DB):
    th = _my_thread(db, user, thread_id)
    msgs = db.scalars(
        select(Message)
        .where(Message.thread_id == th.id, Message.status == CommentStatus.visible)
        .order_by(Message.created_at)
    ).all()
    # Opening the conversation marks the other person's messages as read.
    db.execute(
        update(Message)
        .where(
            Message.thread_id == th.id,
            Message.status == CommentStatus.visible,
            Message.sender_id != user.id,
            Message.read.is_(False),
        )
        .values(read=True)
    )
    db.commit()
    names = {th.organizer_id: name_of(db, th.organizer_id), th.sponsor_id: name_of(db, th.sponsor_id)}
    return [
        MessageOut(
            id=m.id,
            thread_id=m.thread_id,
            sender_id=m.sender_id,
            sender_name=names.get(m.sender_id, "Someone"),
            body=m.body,
            read=m.read,
            created_at=m.created_at,
        )
        for m in msgs
    ]


@router.post(
    "/threads/{thread_id}/messages",
    response_model=MessageOut | HiddenMessageReceipt,
    status_code=status.HTTP_201_CREATED,
)
def send_message(thread_id: uuid.UUID, body: MessageIn, user: ActiveUser, db: DB):
    th = _my_thread(db, user, thread_id)
    text = body.body.strip()
    if not text:
        raise ApiError(422, "Please write a message first.", "validation")
    verdict = moderation.status_for_comment(text)
    m = Message(thread_id=th.id, sender_id=user.id, body=text, status=verdict)
    db.add(m)
    other = th.sponsor_id if user.id == th.organizer_id else th.organizer_id
    if verdict == CommentStatus.visible:
        notify(db, other, NotificationType.message_received, th.id, f"{user.name} sent you a message.")
    db.commit()
    if verdict == CommentStatus.hidden:
        return HiddenMessageReceipt(id=m.id)
    return MessageOut(
        id=m.id,
        thread_id=m.thread_id,
        sender_id=m.sender_id,
        sender_name=user.name,
        body=m.body,
        read=m.read,
        created_at=m.created_at,
    )


# ---- Notifications (the bell polls every 30 seconds) -------------------------------------


@router.get("/notifications", response_model=list[NotificationOut])
def notifications(user: ActiveUser, db: DB, limit: int = Query(30, ge=1, le=100), offset: int = Query(0, ge=0)):
    return db.scalars(
        select(Notification)
        .where(Notification.user_id == user.id)
        .order_by(Notification.created_at.desc())
        .limit(limit)
        .offset(offset)
    ).all()


@router.post("/notifications/{notification_id}/read", status_code=status.HTTP_204_NO_CONTENT)
def read_one(notification_id: uuid.UUID, user: ActiveUser, db: DB) -> None:
    db.execute(
        update(Notification)
        .where(Notification.id == notification_id, Notification.user_id == user.id)
        .values(read=True)
    )
    db.commit()


@router.post("/notifications/read-all", status_code=status.HTTP_204_NO_CONTENT)
def read_all(user: ActiveUser, db: DB) -> None:
    db.execute(
        update(Notification).where(Notification.user_id == user.id, Notification.read.is_(False)).values(read=True)
    )
    db.commit()
