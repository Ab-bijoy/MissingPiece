"""Events, view only (build prompt 7.4: GET /events, GET /events/{id})."""

import uuid

from fastapi import APIRouter, Query
from sqlalchemy import select

from app.auth import DB, ActiveUser
from app.errors import not_found
from app.models import Need, Project
from app.models.enums import NeedType, ProjectStatus
from app.schemas.common import NeedOut
from app.schemas.sponsor import EventDetail, EventNeed, EventSummary
from app.services.views import event_facts, holding_offer, qty_text

router = APIRouter(prefix="/api", tags=["events"])


@router.get("/events", response_model=list[EventSummary])
def list_events(user: ActiveUser, db: DB, limit: int = Query(50, ge=1, le=200), offset: int = Query(0, ge=0)):
    """Live events, newest first, with what they still need."""
    projects = db.scalars(
        select(Project)
        .where(Project.status == ProjectStatus.live)
        .order_by(Project.created_at.desc())
        .limit(limit)
        .offset(offset)
    ).all()
    out = []
    for p in projects:
        needs = db.scalars(select(Need).where(Need.project_id == p.id).order_by(Need.created_at)).all()
        still_open = [n for n in needs if holding_offer(db, n.id) is None]
        out.append(
            EventSummary(
                **event_facts(db, p).model_dump(),
                still_needed=[f"{qty_text(n)} for {n.title.lower()}" for n in still_open],
                open_needs=len(still_open),
                needs_money=any(n.type == NeedType.money for n in still_open),
            )
        )
    return out


@router.get("/events/{project_id}", response_model=EventDetail)
def event(project_id: uuid.UUID, user: ActiveUser, db: DB):
    p = db.get(Project, project_id)
    if p is None or p.status == ProjectStatus.draft:
        raise not_found("Event")
    needs = db.scalars(select(Need).where(Need.project_id == p.id).order_by(Need.created_at)).all()
    detail_needs = []
    for n in needs:
        hold = holding_offer(db, n.id)
        state = "open" if hold is None else ("received" if hold.stage.value == "received" else "covered")
        detail_needs.append(EventNeed(**NeedOut.model_validate(n).model_dump(), state=state))
    return EventDetail(**event_facts(db, p).model_dump(), description=p.description, needs=detail_needs)
