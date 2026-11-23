"""Events, view only (build prompt 7.4: GET /events, GET /events/{id})."""

import uuid

from fastapi import APIRouter, Query
from sqlalchemy import select

from app.auth import DB, ActiveUser
from app.errors import not_found
from app.models import Project
from app.models.enums import NeedType, ProjectStatus
from app.schemas.common import NeedOut
from app.schemas.sponsor import EventDetail, EventNeed, EventSummary
from app.services import loaders
from app.services.views import qty_text

router = APIRouter(prefix="/api", tags=["events"])


@router.get("/events", response_model=list[EventSummary])
def list_events(user: ActiveUser, db: DB, limit: int = Query(50, ge=1, le=200), offset: int = Query(0, ge=0)):
    """Live events, newest first, with what they still need."""
    # 2 queries for the whole page: the programs with their numbers, then their needs
    rows = db.execute(
        select(Project, *loaders.stat_columns())
        .where(Project.status == ProjectStatus.live)
        .order_by(Project.created_at.desc())
        .limit(limit)
        .offset(offset)
    ).all()
    projects = [row[0] for row in rows]
    pids = [p.id for p in projects]
    needs, holds = loaders.needs_and_holds(db, pids)
    facts = loaders.event_facts_many(db, projects, stats={row[0].id: loaders.stats_of(row) for row in rows})
    out = []
    for p in projects:
        still_open = [n for n in needs.get(p.id, []) if n.id not in holds]
        out.append(
            EventSummary(
                **facts[p.id].model_dump(),
                still_needed=[f"{qty_text(n)} for {n.title.lower()}" for n in still_open],
                open_needs=len(still_open),
                needs_money=any(n.type == NeedType.money for n in still_open),
            )
        )
    return out


@router.get("/events/{project_id}", response_model=EventDetail)
def event(project_id: uuid.UUID, user: ActiveUser, db: DB):
    # The program and its numbers in one query, its needs in another
    row = db.execute(select(Project, *loaders.stat_columns()).where(Project.id == project_id)).first()
    if row is None or row[0].status == ProjectStatus.draft:
        raise not_found("Event")
    p, stats = row[0], {row[0].id: loaders.stats_of(row)}
    needs_by, holds = loaders.needs_and_holds(db, [p.id])
    detail_needs = []
    for n in needs_by.get(p.id, []):
        hold = holds.get(n.id)
        state = "open" if hold is None else ("received" if hold.value == "received" else "covered")
        detail_needs.append(EventNeed(**NeedOut.model_validate(n).model_dump(), state=state))
    facts = loaders.event_facts_many(db, [p], stats=stats)
    community = loaders.community_fields_many(db, [p], user, facts, stats)[p.id]
    return EventDetail(**facts[p.id].model_dump(), description=p.description, needs=detail_needs, **community)
