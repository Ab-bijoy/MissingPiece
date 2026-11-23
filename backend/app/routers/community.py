"""Public discovery and comments; authenticated participation and profiles."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Header, Query
from sqlalchemy import select

from app.auth import DB, ActiveUser, decode_token, require_active, require_role
from app.errors import ApiError, not_found
from app.models import AppUser, Comment, Project
from app.models.enums import NotificationType, ProjectStatus, UserRole
from app.schemas.community import CommentIn, JoinIn, ProfileOut, ProfilePatch
from app.services import community as svc
from app.services.notifications import notify

router = APIRouter(prefix="/api", tags=["community"])
General = Annotated[AppUser, Depends(require_role(UserRole.general))]


def optional_viewer(db: DB, authorization: Annotated[str | None, Header()] = None):
    if authorization is None:
        return None
    if not authorization.lower().startswith("bearer "):
        raise ApiError(401, "Please log in again.", "unauthenticated")
    claims = decode_token(authorization.split(" ", 1)[1])
    user = db.scalar(select(AppUser).where(AppUser.supabase_user_id == claims.supabase_user_id))
    if user is None:
        raise ApiError(403, "Finish registration first.", "no_profile")
    return require_active(user)


Viewer = Annotated[AppUser | None, Depends(optional_viewer)]


@router.get("/feed")
def feed(db: DB, user: Viewer, limit: int = Query(50, ge=1, le=200), offset: int = Query(0, ge=0)):
    projects = db.scalars(
        select(Project)
        .where(Project.status == ProjectStatus.live)
        .order_by(Project.created_at.desc(), Project.id)
        .limit(limit)
        .offset(offset)
    ).all()
    return [svc.feed_item(db, p, user) for p in projects]


@router.post("/events/{project_id}/join", status_code=204)
def join(project_id: uuid.UUID, body: JoinIn, user: General, db: DB) -> None:
    svc.join(db, user, project_id, body)


@router.get("/me/memberships")
def memberships(user: General, db: DB):
    return svc.memberships(db, user)


@router.get("/me/profile", response_model=ProfileOut)
def profile(user: General):
    return user


@router.patch("/me/profile", response_model=ProfileOut)
def update_profile(body: ProfilePatch, user: General, db: DB):
    for key, value in body.model_dump(exclude_unset=True).items():
        setattr(user, key, list(dict.fromkeys(value)) if isinstance(value, list) else value)
    db.commit()
    return user


@router.get("/events/{project_id}/comments")
def comments(
    project_id: uuid.UUID, user: Viewer, db: DB, limit: int = Query(100, ge=1, le=200), offset: int = Query(0, ge=0)
):
    p = svc.public_project(db, project_id)
    rows = db.scalars(
        svc.comment_query(p, user).order_by(Comment.created_at, Comment.id).limit(limit).offset(offset)
    ).all()
    return [svc.comment_out(db, c) for c in rows]


@router.post("/events/{project_id}/comments", status_code=201)
def post_comment(project_id: uuid.UUID, body: CommentIn, user: ActiveUser, db: DB):
    p = svc.public_project(db, project_id)
    parent = None
    if body.parent_id:
        parent = db.scalar(svc.comment_query(p, user).where(Comment.id == body.parent_id))
        if parent is None:
            raise not_found("Parent comment")
    c = Comment(project_id=p.id, user_id=user.id, **body.model_dump())
    db.add(c)
    db.flush()
    recipients = {p.organizer_id}
    if parent:
        recipients.add(parent.user_id)
    for recipient in recipients - {user.id}:
        notify(
            db,
            recipient,
            NotificationType.comment_replied if parent else NotificationType.comment_posted,
            c.id,
            f"{user.name} {'replied' if parent else 'posted a comment'} on {p.name}.",
        )
    db.commit()
    return svc.comment_out(db, c)
