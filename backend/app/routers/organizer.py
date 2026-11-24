import uuid
from datetime import UTC, datetime
from decimal import Decimal

from fastapi import APIRouter, status
from sqlalchemy import delete, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.auth import DB, Organizer
from app.errors import ApiError
from app.models.accounts import AppUser, SponsorProfile
from app.models.community import (
    Comment,
    CommentStatus,
    EventMembership,
    MembershipStatus,
    MessageThread,
    Notification,
)
from app.models.enums import (
    AccountStatus,
    MatchStatus,
    NeedStatus,
    NeedType,
    NotificationType,
    OfferStage,
    ProjectStatus,
    TemplateStatus,
    UserRole,
)
from app.models.projects import Need, Project, Template
from app.models.sponsorship import (
    Benefit,
    Booking,
    Offer,
    Receipt,
    SponsorMatch,
    SponsorRequest,
)
from app.routers.organizer_requests import check_not_duplicate
from app.schemas.common import NeedOut
from app.schemas.organizer import (
    BenefitGivenIn,
    BookingOut,
    CommentModerationOut,
    GapsOut,
    NeedCreateIn,
    NeedUpdateIn,
    OfferBenefitOut,
    OfferListOut,
    OrganizerOfferOut,
    ProjectCreateIn,
    ProjectDetailOut,
    ProjectMemberOut,
    ProjectReportOut,
    ProjectSummaryOut,
    ProjectUpdateIn,
    ReadinessOut,
    SponsorMatchListOut,
    SponsorMatchOut,
    SponsorRequestCreateIn,
    SponsorRequestOut,
    TemplateOut,
)
from app.services import contributors, loaders, matching
from app.services import organizer_views as views
from app.services.schedules import schedule_error

# All paths start with /api, like every other router (the frontend calls /api/...)
router = APIRouter(prefix="/api", tags=["organizer"])


def _require_organizer(user: AppUser) -> None:
    if user.role != UserRole.organizer:
        raise ApiError(403, "Only organizers can perform this action.", "forbidden_role")
    if user.status != AccountStatus.active:
        raise ApiError(403, "Organizer account is not active.", "account_inactive")


def _get_owned_project(db: Session, project_id: uuid.UUID, organizer_id: uuid.UUID) -> Project:
    project = db.get(Project, project_id)
    if not project:
        raise ApiError(404, "Project not found.", "not_found")
    if project.organizer_id != organizer_id:
        raise ApiError(403, "You do not own this project.", "forbidden")
    return project


def _get_owned_need(db: Session, need_id: uuid.UUID, organizer_id: uuid.UUID) -> Need:
    need = db.get(Need, need_id)
    if not need:
        raise ApiError(404, "Need not found.", "not_found")
    _get_owned_project(db, need.project_id, organizer_id)
    return need


def _get_owned_offer(db: Session, offer_id: uuid.UUID, organizer_id: uuid.UUID) -> tuple[Offer, Need, Project]:
    offer = db.get(Offer, offer_id)
    if not offer:
        raise ApiError(404, "Offer not found.", "not_found")
    need = db.get(Need, offer.need_id)
    if not need:
        raise ApiError(404, "Need not found for this offer.", "not_found")
    project = _get_owned_project(db, need.project_id, organizer_id)
    return offer, need, project


def _notify(
    db: Session,
    user_id: uuid.UUID,
    notif_type: NotificationType,
    ref_id: uuid.UUID | None,
    text: str,
) -> None:
    db.add(
        Notification(
            user_id=user_id,
            type=notif_type,
            ref_id=ref_id,
            read=False,
            text=text,
        )
    )


def _to_project_detail(db: Session, project: Project) -> ProjectDetailOut:
    organizer = db.get(AppUser, project.organizer_id)
    organizer_name = organizer.name if organizer else "Organizer"
    project_type = project.template.project_type if project.template else None

    memberships = list(
        db.scalars(
            select(EventMembership).where(
                EventMembership.project_id == project.id,
                EventMembership.status == MembershipStatus.approved,
            )
        ).all()
    )
    participants_count = sum(1 for m in memberships if m.role.value == "participant")
    contributors_count = sum(1 for m in memberships if m.role.value == "contributor")

    return ProjectDetailOut(
        id=project.id,
        organizer_id=project.organizer_id,
        template_id=project.template_id,
        name=project.name,
        project_type=project_type,
        organizer_name=organizer_name,
        institution=project.institution,
        event_date=project.event_date,
        venue=project.venue,
        audience=project.audience,
        status=project.status.value,
        participants=participants_count,
        contributors=contributors_count,
        purpose=project.purpose,
        description=project.description,
        needs=[NeedOut.model_validate(n) for n in project.needs],
    )


@router.get("/templates", response_model=list[TemplateOut])
def list_live_templates(db: DB):
    return db.scalars(select(Template).where(Template.status == TemplateStatus.live).order_by(Template.name)).all()


@router.post("/projects", response_model=ProjectDetailOut, status_code=status.HTTP_201_CREATED)
def create_project(payload: ProjectCreateIn, user: Organizer, db: DB):
    _require_organizer(user)
    template: Template | None = None
    if payload.template_id is not None:
        template = db.get(Template, payload.template_id)
        if not template:
            raise ApiError(404, "Template not found.", "not_found")

    project = Project(
        organizer_id=user.id,
        template_id=payload.template_id,
        name=payload.name,
        purpose=payload.purpose,
        description=payload.description,
        event_date=payload.event_date,
        venue=payload.venue,
        audience=payload.audience,
        institution=payload.institution,
        status=ProjectStatus.draft,
    )
    db.add(project)
    db.flush()

    if not payload.needs and template and template.default_needs:
        for item in template.default_needs:
            need_type = NeedType(item["type"])
            qty = Decimal(str(item.get("quantity", 1)))
            budget_item = item.get("budget_item")
            if need_type == NeedType.money and not budget_item:
                budget_item = item.get("title", "General budget")
            db.add(
                Need(
                    project_id=project.id,
                    type=need_type,
                    title=item["title"],
                    quantity=qty,
                    unit=item.get("unit", "unit"),
                    budget_item=budget_item,
                    status=NeedStatus.open,
                )
            )
    else:
        for n in payload.needs:
            if n.type == NeedType.money and not n.budget_item:
                raise ApiError(422, "budget_item is required for money needs.", "validation_error")
            db.add(
                Need(
                    project_id=project.id,
                    type=n.type,
                    title=n.title,
                    quantity=n.quantity,
                    unit=n.unit,
                    budget_item=n.budget_item,
                    slot_start=n.slot_start,
                    slot_end=n.slot_end,
                    deadline=n.deadline,
                    status=NeedStatus.open,
                )
            )

    db.commit()
    project = _get_owned_project(db, project.id, user.id)
    return _to_project_detail(db, project)


@router.get("/projects/mine", response_model=list[ProjectSummaryOut])
def list_my_projects(user: Organizer, db: DB):
    _require_organizer(user)
    projects = db.scalars(
        select(Project).where(Project.organizer_id == user.id).order_by(Project.created_at.desc())
    ).all()
    counts = views.open_and_total(db, [p.id for p in projects])  # one query for all projects
    return [
        ProjectSummaryOut(
            open_needs=counts.get(p.id, (0, 0))[0],
            total_needs=counts.get(p.id, (0, 0))[1],
            id=p.id,
            organizer_id=p.organizer_id,
            template_id=p.template_id,
            name=p.name,
            purpose=p.purpose,
            event_date=p.event_date,
            venue=p.venue,
            audience=p.audience,
            institution=p.institution,
            status=p.status.value,
            created_at=p.created_at,
        )
        for p in projects
    ]


@router.get("/projects/{project_id}", response_model=ProjectDetailOut)
def get_project_detail(project_id: uuid.UUID, user: Organizer, db: DB):
    _require_organizer(user)
    project = _get_owned_project(db, project_id, user.id)
    return _to_project_detail(db, project)


@router.patch("/projects/{project_id}", response_model=ProjectDetailOut)
def update_project(project_id: uuid.UUID, payload: ProjectUpdateIn, user: Organizer, db: DB):
    _require_organizer(user)
    project = _get_owned_project(db, project_id, user.id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(project, field, value)
    db.commit()
    project = _get_owned_project(db, project.id, user.id)
    return _to_project_detail(db, project)


@router.post("/projects/{project_id}/publish", response_model=ProjectDetailOut)
def publish_project(project_id: uuid.UUID, user: Organizer, db: DB):
    _require_organizer(user)
    project = _get_owned_project(db, project_id, user.id)
    if project.status != ProjectStatus.draft:
        raise ApiError(400, "Only draft projects can be published.", "invalid_state")
    for need in project.needs:
        if error := schedule_error(need.type, need.slot_start, need.slot_end):
            raise ApiError(422, f"{need.title}: {error}", "invalid_need_schedule")
    project.status = ProjectStatus.live
    # AI generation is explicit: publishing must not depend on provider uptime.
    db.commit()
    project = _get_owned_project(db, project.id, user.id)
    return _to_project_detail(db, project)


@router.post("/projects/{project_id}/complete", response_model=ProjectDetailOut)
def complete_project(project_id: uuid.UUID, user: Organizer, db: DB):
    _require_organizer(user)
    project = _get_owned_project(db, project_id, user.id)
    if not views.readiness(db, project).can_complete:
        raise ApiError(
            409,
            "This project can be completed once it is live and everything accepted has been received.",
            "not_ready",
        )
    need_ids = [n.id for n in project.needs]
    if need_ids:
        unreceived = db.scalars(
            select(Offer).where(
                Offer.need_id.in_(need_ids),
                Offer.stage == OfferStage.accepted,
            )
        ).all()
        if unreceived:
            raise ApiError(
                400,
                "Cannot complete project until all accepted offers are marked as received.",
                "offers_not_received",
            )
    project.status = ProjectStatus.complete
    db.commit()
    project = _get_owned_project(db, project.id, user.id)
    return _to_project_detail(db, project)


@router.post("/projects/{project_id}/needs", response_model=NeedOut, status_code=status.HTTP_201_CREATED)
def add_project_need(project_id: uuid.UUID, payload: NeedCreateIn, user: Organizer, db: DB):
    _require_organizer(user)
    project = _get_owned_project(db, project_id, user.id)
    if payload.type == NeedType.money and not payload.budget_item:
        raise ApiError(422, "budget_item is required for money needs.", "validation_error")

    need = Need(
        project_id=project.id,
        type=payload.type,
        title=payload.title,
        quantity=payload.quantity,
        unit=payload.unit,
        budget_item=payload.budget_item,
        slot_start=payload.slot_start,
        slot_end=payload.slot_end,
        deadline=payload.deadline,
        status=NeedStatus.open,
    )
    db.add(need)
    db.commit()
    db.refresh(need)
    return NeedOut.model_validate(need)


@router.patch("/needs/{need_id}", response_model=NeedOut)
def update_need(need_id: uuid.UUID, payload: NeedUpdateIn, user: Organizer, db: DB):
    _require_organizer(user)
    need = _get_owned_need(db, need_id, user.id)
    # Do not change the schedule concurrently with accepting a contributor.
    need = db.scalar(select(Need).where(Need.id == need.id).with_for_update().execution_options(populate_existing=True))
    if need.status != NeedStatus.open:
        raise ApiError(400, "Only open needs can be edited.", "need_not_open")

    changes = payload.model_dump(exclude_unset=True)
    if error := schedule_error(
        changes.get("type", need.type),
        changes.get("slot_start", need.slot_start),
        changes.get("slot_end", need.slot_end),
    ):
        raise ApiError(422, error, "invalid_need_schedule")
    for field, value in changes.items():
        setattr(need, field, value)
    if need.type == NeedType.money:
        need.unit = "BDT"  # the amount is in BDT; no separate unit for money

    if need.type == NeedType.money and not need.budget_item:
        raise ApiError(422, "budget_item is required for money needs.", "validation_error")

    db.commit()
    db.refresh(need)
    return NeedOut.model_validate(need)


@router.delete("/needs/{need_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_need(need_id: uuid.UUID, user: Organizer, db: DB) -> None:
    _require_organizer(user)
    need = _get_owned_need(db, need_id, user.id)
    if need.status != NeedStatus.open:
        raise ApiError(400, "Only open needs can be deleted.", "need_not_open")

    db.delete(need)
    db.commit()


@router.get("/projects/{project_id}/gaps", response_model=GapsOut)
def get_project_gaps(project_id: uuid.UUID, user: Organizer, db: DB):
    _require_organizer(user)
    return views.gaps(db, _get_owned_project(db, project_id, user.id))


@router.get("/projects/{project_id}/readiness", response_model=ReadinessOut)
def get_project_readiness(project_id: uuid.UUID, user: Organizer, db: DB):
    _require_organizer(user)
    return views.readiness(db, _get_owned_project(db, project_id, user.id))


@router.get("/projects/{project_id}/report", response_model=ProjectReportOut)
def get_project_report(project_id: uuid.UUID, user: Organizer, db: DB):
    _require_organizer(user)
    return views.report(db, _get_owned_project(db, project_id, user.id))


def _rule_based_score(project: Project, sponsor_user: AppUser) -> tuple[int, str]:
    profile = sponsor_user.sponsor_profile
    open_need_types = {n.type.value for n in project.needs if n.status == NeedStatus.open}
    preferred_types = set((profile.preferred_types if profile else None) or [])

    score = 0
    reasons: list[str] = []

    if open_need_types.intersection(preferred_types):
        score += 40
        reasons.append("matches preferred need type")

    project_words = {
        w.lower().strip(".,!?()[]{}:;\"'")
        for w in f"{project.name} {project.purpose} {project.description} {project.venue}".split()
        if len(w.strip(".,!?()[]{}:;\"'")) > 2
    }
    interests = (profile.interests if profile else None) or []
    interest_words = {
        w.lower().strip(".,!?()[]{}:;\"'")
        for item in interests
        for w in str(item).split()
        if len(w.strip(".,!?()[]{}:;\"'")) > 2
    }
    overlap = sorted(project_words.intersection(interest_words))
    if overlap:
        score += 30
        reasons.append(f"interest match ({', '.join(overlap[:3])})")

    loc = (profile.location if profile else None) or ""
    if loc and loc.lower() in f"{project.venue} {project.institution or ''}".lower():
        score += 20
        reasons.append(f"location match ({loc})")

    if sponsor_user.verified:
        score += 10
        reasons.append("verified sponsor")

    score = max(0, min(100, score))
    reason = "; ".join(reasons) if reasons else "Baseline sponsor match for active event."
    return score, reason


def _compute_and_store_matches(db: Session, project: Project) -> list[SponsorMatch]:
    # Profiles are loaded with the sponsors (one extra query in all), not one by one while scoring
    sponsors = list(
        db.scalars(
            select(AppUser)
            .options(selectinload(AppUser.sponsor_profile))
            .where(
                AppUser.role == UserRole.sponsor,
                AppUser.status == AccountStatus.active,
            )
        ).all()
    )
    existing_map = {
        m.sponsor_id: m for m in db.scalars(select(SponsorMatch).where(SponsorMatch.project_id == project.id)).all()
    }

    requested = set(db.scalars(select(SponsorRequest.sponsor_id).where(SponsorRequest.project_id == project.id)))
    eligible = [
        s
        for s in sponsors
        if s.id not in requested and (s.id not in existing_map or existing_map[s.id].status == MatchStatus.suggested)
    ]
    # Bound model latency/cost with a deterministic shortlist, then AI ranks it.
    eligible.sort(key=lambda s: (-_rule_based_score(project, s)[0], str(s.id)))
    scored_items = (
        matching.rank_sponsors(project, eligible[:20])
        if any(n.status == NeedStatus.open for n in project.needs)
        else []
    )
    top_items = sorted(scored_items, key=lambda x: (-x[0], str(x[2].id)))[:10]
    keep = [sp.id for _, _, sp in top_items]
    db.execute(
        delete(SponsorMatch).where(
            SponsorMatch.project_id == project.id,
            SponsorMatch.status == MatchStatus.suggested,
            SponsorMatch.sponsor_id.not_in(keep),
        )
    )

    rows: list[SponsorMatch] = []
    for sc, rsn, sp in top_items:
        existing = existing_map.get(sp.id)
        if existing:
            existing.score = sc
            existing.reason = rsn
            existing.source = "ai"
            rows.append(existing)
        else:
            m = SponsorMatch(
                project_id=project.id,
                sponsor_id=sp.id,
                score=sc,
                reason=rsn,
                source="ai",
                status=MatchStatus.suggested,
            )
            db.add(m)
            rows.append(m)

    db.flush()
    rows.sort(key=lambda x: x.score, reverse=True)
    return rows


def _sponsor_names(db: Session, sponsor_ids) -> dict[uuid.UUID, str]:
    """Company name (or account name) of each sponsor: one query for all of them."""
    ids = list({i for i in sponsor_ids})
    if not ids:
        return {}
    rows = db.execute(
        select(AppUser.id, AppUser.name, SponsorProfile.company)
        .outerjoin(SponsorProfile, SponsorProfile.user_id == AppUser.id)
        .where(AppUser.id.in_(ids))
    ).all()
    return {uid: company or name or "Sponsor" for uid, name, company in rows}


def _serialize_match(match: SponsorMatch, names: dict[uuid.UUID, str]) -> SponsorMatchOut:
    return SponsorMatchOut(
        id=match.id,
        project_id=match.project_id,
        sponsor_id=match.sponsor_id,
        sponsor_user_id=match.sponsor_id,
        sponsor_name=names.get(match.sponsor_id, "Sponsor"),
        score=match.score,
        reason=match.reason,
        source=match.source,
        status=match.status.value,
    )


@router.post("/projects/{project_id}/sponsor-matches", response_model=SponsorMatchListOut)
def generate_sponsor_matches(project_id: uuid.UUID, user: Organizer, db: DB):
    _require_organizer(user)
    project = _get_owned_project(db, project_id, user.id)
    db.execute(select(Project.id).where(Project.id == project.id).with_for_update())
    _compute_and_store_matches(db, project)
    db.commit()
    return list_sponsor_matches(project_id, user, db)


@router.get("/projects/{project_id}/sponsor-matches", response_model=SponsorMatchListOut)
def list_sponsor_matches(project_id: uuid.UUID, user: Organizer, db: DB):
    _require_organizer(user)
    project = _get_owned_project(db, project_id, user.id)
    rows = list(
        db.scalars(
            select(SponsorMatch)
            .join(AppUser, AppUser.id == SponsorMatch.sponsor_id)
            .where(
                SponsorMatch.project_id == project.id,
                SponsorMatch.status != MatchStatus.dismissed,
                AppUser.status == AccountStatus.active,
                AppUser.role == UserRole.sponsor,
            )
            .order_by(SponsorMatch.score.desc())
        ).all()
    )
    names = _sponsor_names(db, (r.sponsor_id for r in rows))
    return SponsorMatchListOut(
        matches=[_serialize_match(r, names) for r in rows],
        requests_left=views.requests_left(db, project.id),
    )


@router.post("/sponsor-matches/{match_id}/dismiss", response_model=SponsorMatchOut)
def dismiss_sponsor_match(match_id: uuid.UUID, user: Organizer, db: DB):
    _require_organizer(user)
    match = db.get(SponsorMatch, match_id)
    if not match:
        raise ApiError(404, "Sponsor match not found.", "not_found")

    _get_owned_project(db, match.project_id, user.id)
    match.status = MatchStatus.dismissed
    db.commit()
    db.refresh(match)
    return _serialize_match(match, _sponsor_names(db, [match.sponsor_id]))


@router.post("/projects/{project_id}/requests", response_model=SponsorRequestOut, status_code=status.HTTP_201_CREATED)
def send_sponsor_request(project_id: uuid.UUID, payload: SponsorRequestCreateIn, user: Organizer, db: DB):
    _require_organizer(user)
    # Rule 5: Lock the project row while counting unique sponsors
    locked_project = db.scalar(select(Project).where(Project.id == project_id).with_for_update())
    if not locked_project:
        raise ApiError(404, "Project not found.", "not_found")
    if locked_project.organizer_id != user.id:
        raise ApiError(403, "You do not own this project.", "forbidden")

    match: SponsorMatch | None = None
    if payload.match_id is not None:
        match = db.get(SponsorMatch, payload.match_id)
        if not match or match.project_id != locked_project.id:
            raise ApiError(404, "Sponsor match not found for this project.", "not_found")

    target_sponsor_id = payload.sponsor_id or payload.sponsor_user_id or (match.sponsor_id if match else None)
    if not target_sponsor_id:
        raise ApiError(422, "sponsor_id or match_id is required.", "validation_error")

    sponsor_user = db.get(AppUser, target_sponsor_id)
    if not sponsor_user or sponsor_user.role != UserRole.sponsor:
        raise ApiError(404, "Sponsor user not found.", "not_found")

    existing_reqs = list(db.scalars(select(SponsorRequest).where(SponsorRequest.project_id == locked_project.id)).all())
    distinct_sponsors = {r.sponsor_id for r in existing_reqs}
    if sponsor_user.id not in distinct_sponsors and len(distinct_sponsors) >= 5:
        raise ApiError(
            409,
            "Maximum of 5 different sponsors allowed per project.",
            "request_limit",  # the screen shows its own message for this code
        )

    need_id = payload.need_id
    if need_id is None and locked_project.needs:
        need_id = locked_project.needs[0].id
    if need_id is None:
        raise ApiError(422, "Project must have at least one need before sending a request.", "missing_need")

    need = db.get(Need, need_id)
    if not need or need.project_id != locked_project.id:
        raise ApiError(404, "Need not found for this project.", "not_found")

    check_not_duplicate(db, locked_project.id, need.id, sponsor_user.id)
    req_obj = SponsorRequest(
        project_id=locked_project.id,
        need_id=need.id,
        sponsor_id=sponsor_user.id,
        benefits=payload.benefits,
        conditions=payload.conditions,
        exclusive_category=payload.exclusive_category,
        decide_by=payload.decide_by,
        deliver_by=payload.deliver_by,
    )
    db.add(req_obj)
    db.flush()

    thread = db.scalar(select(MessageThread).where(MessageThread.request_id == req_obj.id))
    if not thread:
        thread = MessageThread(
            request_id=req_obj.id,
            organizer_id=user.id,
            sponsor_id=sponsor_user.id,
        )
        db.add(thread)
        db.flush()

    # The screens send the sponsor, not the suggestion: mark this sponsor's suggestion as requested
    for m in db.scalars(
        select(SponsorMatch).where(
            SponsorMatch.project_id == locked_project.id, SponsorMatch.sponsor_id == sponsor_user.id
        )
    ):
        m.status = MatchStatus.requested

    _notify(
        db,
        user_id=sponsor_user.id,
        notif_type=NotificationType.request_received,
        ref_id=req_obj.id,
        text=f"New sponsorship request for '{locked_project.name}' ({need.title}).",
    )

    db.commit()
    db.refresh(req_obj)
    return SponsorRequestOut(
        id=req_obj.id,
        request_id=req_obj.id,
        project_id=locked_project.id,
        need_id=need.id,
        sponsor_id=sponsor_user.id,
        thread_id=thread.id,
        status="requested",
    )


def _serialize_offer(
    db: Session,
    offer: Offer,
    need: Need,
    all_project_offers: list[Offer],
    has_receipt: bool = True,
) -> OrganizerOfferOut:
    receipt = db.scalar(select(Receipt).where(Receipt.offer_id == offer.id)) if has_receipt else None

    same_need_others = [o for o in all_project_offers if o.need_id == offer.need_id and o.id != offer.id]
    same_excl_others = (
        [
            o
            for o in all_project_offers
            if o.exclusive_category
            and offer.exclusive_category
            and o.exclusive_category.strip().lower() == offer.exclusive_category.strip().lower()
            and o.id != offer.id
        ]
        if offer.exclusive_category
        else []
    )
    conflicting = bool(same_need_others or same_excl_others)

    benefits_out = [
        OfferBenefitOut(
            id=b.id,
            offer_id=b.offer_id,
            label=b.label,
            given=b.given,
            given_at=b.given_at,
        )
        for b in (offer.benefits or [])
    ]

    return OrganizerOfferOut(
        id=offer.id,
        need_id=offer.need_id,
        need_title=need.title,
        need_type=need.type.value,
        project_id=need.project_id,
        stage=offer.stage.value,
        amount=offer.amount,
        conditions=offer.conditions,
        exclusive_category=offer.exclusive_category,
        conflicting=conflicting,
        received_at=receipt.received_at if receipt else None,
        benefits=benefits_out,
    )


@router.get("/projects/{project_id}/offers", response_model=OfferListOut)
def list_project_offers(project_id: uuid.UUID, user: Organizer, db: DB):
    _require_organizer(user)
    return views.offer_list(db, _get_owned_project(db, project_id, user.id))


@router.post("/offers/{offer_id}/accept", response_model=OrganizerOfferOut)
def accept_offer(offer_id: uuid.UUID, user: Organizer, db: DB):
    _require_organizer(user)
    offer = db.get(Offer, offer_id)
    if not offer:
        raise ApiError(404, "Offer not found.", "not_found")
    if offer.contribution_role:
        member_id = db.scalar(select(EventMembership.id).where(EventMembership.offer_id == offer.id))
        if member_id is None:
            raise ApiError(409, "This contributor application is no longer active.", "stale_application")
        contributors.decide(db, user, member_id, True)
        offer, need, project = _get_owned_offer(db, offer_id, user.id)
        return _serialize_offer(db, offer, need, [offer], has_receipt=False)

    # Rule 2: Lock the need row first inside the transaction
    need = db.scalar(select(Need).where(Need.id == offer.need_id).with_for_update())
    if not need:
        raise ApiError(404, "Need not found.", "not_found")

    project = _get_owned_project(db, need.project_id, user.id)

    if offer.stage != OfferStage.offered:
        raise ApiError(409, "Only offered proposals can be accepted.", "invalid_stage")
    if need.status != NeedStatus.open:
        raise ApiError(409, "Need is already covered.", "need_not_open")

    existing_accepted = db.scalar(
        select(Offer).where(
            Offer.need_id == need.id,
            Offer.stage.in_((OfferStage.accepted, OfferStage.received)),
        )
    )
    if existing_accepted:
        raise ApiError(409, "Another offer is already accepted for this need.", "duplicate_accepted_offer")

    offer.stage = OfferStage.accepted
    need.status = NeedStatus.covered

    if need.type in (NeedType.skill, NeedType.time, NeedType.equipment, NeedType.space):
        if offer.slot_start and offer.slot_end:
            resource_key = (
                f"item:{offer.from_user_id}:{offer.resource.strip().lower()}"
                if offer.resource
                else f"user:{offer.from_user_id}"
            )
            db.add(
                Booking(
                    offer_id=offer.id,
                    resource_key=resource_key,
                    slot_start=offer.slot_start,
                    slot_end=offer.slot_end,
                )
            )

    competing_offers = list(
        db.scalars(
            select(Offer).where(
                Offer.need_id == need.id,
                Offer.id != offer.id,
                Offer.stage == OfferStage.offered,
            )
        ).all()
    )
    for other in competing_offers:
        other.stage = OfferStage.declined
        db.execute(
            update(EventMembership).where(EventMembership.offer_id == other.id).values(status=MembershipStatus.rejected)
        )
        _notify(
            db,
            user_id=other.from_user_id,
            notif_type=NotificationType.offer_declined,
            ref_id=other.id,
            text=f"Your offer for '{need.title}' in '{project.name}' was not selected.",
        )

    _notify(
        db,
        user_id=offer.from_user_id,
        notif_type=NotificationType.offer_accepted,
        ref_id=offer.id,
        text=f"Your offer for '{need.title}' in '{project.name}' was accepted.",
    )
    _notify(
        db,
        user_id=user.id,
        notif_type=NotificationType.need_covered,
        ref_id=need.id,
        text=f"Need '{need.title}' in '{project.name}' is now covered.",
    )

    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise ApiError(409, "Booking clash or concurrent offer acceptance conflict.", "conflict") from exc

    # Answer from what is already loaded: the offers for this need were just read and
    # changed, and a just-accepted offer has no receipt yet (saves 4 database trips).
    return _serialize_offer(db, offer, need, [offer, *competing_offers], has_receipt=False)


@router.post("/offers/{offer_id}/decline", response_model=OrganizerOfferOut)
def decline_offer(offer_id: uuid.UUID, user: Organizer, db: DB):
    _require_organizer(user)
    offer, need, project = _get_owned_offer(db, offer_id, user.id)
    if offer.contribution_role:
        member_id = db.scalar(select(EventMembership.id).where(EventMembership.offer_id == offer.id))
        if member_id is None:
            raise ApiError(409, "This contributor application is no longer active.", "stale_application")
        contributors.decide(db, user, member_id, False)
        return _serialize_offer(db, offer, need, [offer], has_receipt=False)
    if offer.stage not in (OfferStage.offered, OfferStage.accepted):
        raise ApiError(400, "This offer cannot be declined in its current stage.", "invalid_stage")

    was_accepted = offer.stage == OfferStage.accepted
    offer.stage = OfferStage.declined

    if was_accepted:
        booking = db.scalar(select(Booking).where(Booking.offer_id == offer.id))
        if booking:
            db.delete(booking)
        remaining_active = db.scalar(
            select(Offer).where(
                Offer.need_id == need.id,
                Offer.id != offer.id,
                Offer.stage.in_((OfferStage.accepted, OfferStage.received)),
            )
        )
        if not remaining_active:
            need.status = NeedStatus.open

    _notify(
        db,
        user_id=offer.from_user_id,
        notif_type=NotificationType.offer_declined,
        ref_id=offer.id,
        text=f"Your offer for '{need.title}' in '{project.name}' was declined.",
    )

    db.commit()
    db.refresh(offer)
    all_project_offers = list(db.scalars(select(Offer).where(Offer.need_id.in_([n.id for n in project.needs]))).all())
    return _serialize_offer(db, offer, need, all_project_offers)


@router.post("/offers/{offer_id}/receive", response_model=OrganizerOfferOut)
@router.post("/offers/{offer_id}/received", response_model=OrganizerOfferOut, include_in_schema=False)
def receive_offer(offer_id: uuid.UUID, user: Organizer, db: DB):
    _require_organizer(user)
    offer, need, project = _get_owned_offer(db, offer_id, user.id)
    # Rule 9: Money offers become received only when payment succeeds
    if need.type == NeedType.money:
        raise ApiError(
            400, "Money offers are marked received upon payment confirmation.", "money_offer_requires_payment"
        )
    if offer.stage not in (OfferStage.accepted, OfferStage.received):
        raise ApiError(400, "Only accepted offers can be marked as received.", "invalid_stage")

    now_utc = datetime.now(UTC)
    offer.stage = OfferStage.received

    receipt = db.scalar(select(Receipt).where(Receipt.offer_id == offer.id))
    if not receipt:
        db.add(
            Receipt(
                offer_id=offer.id,
                received_at=now_utc,
                confirmed_by=user.id,
            )
        )

    membership = db.scalar(select(EventMembership).where(EventMembership.offer_id == offer.id))
    if membership:
        membership.status = MembershipStatus.approved

    _notify(
        db,
        user_id=offer.from_user_id,
        notif_type=NotificationType.item_received,
        ref_id=offer.id,
        text=f"Organizer confirmed receipt for '{need.title}' in '{project.name}'.",
    )

    db.commit()
    db.refresh(offer)
    all_project_offers = list(db.scalars(select(Offer).where(Offer.need_id.in_([n.id for n in project.needs]))).all())
    return _serialize_offer(db, offer, need, all_project_offers)


@router.get("/projects/{project_id}/bookings", response_model=list[BookingOut])
def list_project_bookings(project_id: uuid.UUID, user: Organizer, db: DB):
    _require_organizer(user)
    project = _get_owned_project(db, project_id, user.id)
    need_ids = [n.id for n in project.needs]
    if not need_ids:
        return []
    offer_ids = list(db.scalars(select(Offer.id).where(Offer.need_id.in_(need_ids))).all())
    if not offer_ids:
        return []
    bookings = list(db.scalars(select(Booking).where(Booking.offer_id.in_(offer_ids))).all())
    return [
        BookingOut(
            id=b.id,
            offer_id=b.offer_id,
            resource_key=b.resource_key,
            slot_start=b.slot_start,
            slot_end=b.slot_end,
        )
        for b in bookings
    ]


@router.patch("/benefits/{benefit_id}", response_model=OfferBenefitOut)
def update_benefit_given(benefit_id: uuid.UUID, body: BenefitGivenIn, user: Organizer, db: DB):
    _require_organizer(user)
    benefit = db.get(Benefit, benefit_id)
    if not benefit:
        raise ApiError(404, "Benefit not found.", "not_found")
    _get_owned_offer(db, benefit.offer_id, user.id)

    benefit.given = body.given
    benefit.given_at = datetime.now(UTC) if body.given else None
    db.commit()
    db.refresh(benefit)
    return OfferBenefitOut(
        id=benefit.id,
        offer_id=benefit.offer_id,
        label=benefit.label,
        given=benefit.given,
        given_at=benefit.given_at,
    )


@router.get("/projects/{project_id}/memberships", response_model=list[ProjectMemberOut])
def list_project_memberships(project_id: uuid.UUID, user: Organizer, db: DB):
    _require_organizer(user)
    project = _get_owned_project(db, project_id, user.id)
    rows = db.execute(
        select(EventMembership, Offer, Need)
        .outerjoin(Offer, Offer.id == EventMembership.offer_id)
        .outerjoin(Need, Need.id == Offer.need_id)
        .where(EventMembership.project_id == project.id)
        .order_by(EventMembership.created_at, EventMembership.id)
    ).all()
    names = loaders.names(db, (m.user_id for m, _, _ in rows))
    result: list[ProjectMemberOut] = []
    for m, offer, need in rows:
        result.append(
            ProjectMemberOut(
                id=m.id,
                project_id=m.project_id,
                user_id=m.user_id,
                name=names.get(m.user_id, "Member"),
                role=m.role.value,
                status=m.status.value,
                offer_id=m.offer_id,
                offer_stage=offer.stage.value if offer else None,
                contribution_role=offer.contribution_role.value if offer and offer.contribution_role else None,
                need_title=need.title if need else None,
                slot_start=offer.slot_start if offer else None,
                slot_end=offer.slot_end if offer else None,
            )
        )
    return result


@router.post("/memberships/{membership_id}/approve", response_model=ProjectMemberOut)
def approve_membership(membership_id: uuid.UUID, user: Organizer, db: DB):
    _require_organizer(user)
    m = contributors.decide(db, user, membership_id, True)
    member_user = db.get(AppUser, m.user_id)
    return ProjectMemberOut(
        id=m.id,
        project_id=m.project_id,
        user_id=m.user_id,
        name=member_user.name if member_user else "Member",
        role=m.role.value,
        status=m.status.value,
        offer_id=m.offer_id,
    )


@router.post("/memberships/{membership_id}/reject", response_model=ProjectMemberOut)
def reject_membership(membership_id: uuid.UUID, user: Organizer, db: DB):
    _require_organizer(user)
    m = contributors.decide(db, user, membership_id, False)
    member_user = db.get(AppUser, m.user_id)
    return ProjectMemberOut(
        id=m.id,
        project_id=m.project_id,
        user_id=m.user_id,
        name=member_user.name if member_user else "Member",
        role=m.role.value,
        status=m.status.value,
        offer_id=m.offer_id,
    )


@router.post("/comments/{comment_id}/hide", response_model=CommentModerationOut)
def hide_comment(comment_id: uuid.UUID, user: Organizer, db: DB):
    _require_organizer(user)
    comment = db.get(Comment, comment_id)
    if not comment:
        raise ApiError(404, "Comment not found.", "not_found")
    _get_owned_project(db, comment.project_id, user.id)
    comment.status = CommentStatus.hidden
    db.commit()
    db.refresh(comment)
    return CommentModerationOut(
        id=comment.id,
        status=comment.status.value,
    )


# Messages: served by app/routers/shared.py (/api/threads...), for organizers and sponsors alike.
