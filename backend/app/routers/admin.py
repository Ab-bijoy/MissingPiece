"""Admin endpoints (build prompt 7.2). Every route needs an active admin, except /files (admin or owner)."""

import uuid
from datetime import UTC, datetime
from decimal import Decimal
from typing import Literal

from fastapi import APIRouter, BackgroundTasks, Query, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import delete, func, select

from app.auth import DB, ActiveUser, Admin
from app.errors import ApiError, forbidden, not_found
from app.models import (
    AppUser,
    Comment,
    Message,
    MessageThread,
    Need,
    Offer,
    OrganizerProfile,
    Payment,
    Project,
    RegistrationDocument,
    SponsorProfile,
    SponsorRequest,
    Template,
)
from app.models.enums import (
    AccountStatus,
    CommentStatus,
    NeedType,
    NotificationType,
    PaymentStatus,
    TemplateStatus,
    UserRole,
)
from app.schemas.auth import OrganizerProfileOut, SponsorProfileShort
from app.schemas.common import Num, Schema
from app.services import email
from app.services.notifications import notify
from app.services.storage import storage
from app.services.views import name_of

router = APIRouter(prefix="/api", tags=["admin"])

ORG_TYPE = {"ngo": "NGO", "university": "University club or office", "community_group": "Community group"}
REG_ROLES = (UserRole.organizer, UserRole.sponsor)


# ---- Schemas ---------------------------------------------------------------------------------


class RegistrationSummary(Schema):
    user_id: uuid.UUID
    name: str
    role: str
    kind: str
    sent_at: datetime
    status: str
    reviewed_by_name: str | None
    reviewed_at: datetime | None


class DocumentOut(Schema):
    id: uuid.UUID
    file_name: str
    content_type: str
    size_bytes: int
    kind: str


class RegistrationDetail(Schema):
    user_id: uuid.UUID
    role: str
    status: str
    email: str
    name: str
    sent_at: datetime
    rejection_note: str | None
    # Audit trail: which admin decided, and when (null while pending)
    reviewed_by_name: str | None
    reviewed_at: datetime | None
    profile: OrganizerProfileOut | SponsorProfileShort | None
    documents: list[DocumentOut]


class RejectIn(BaseModel):
    note: str = Field(min_length=1, max_length=1000)


class AdminUserOut(Schema):
    id: uuid.UUID
    name: str
    email: str
    role: str
    status: str
    verified: bool
    is_demo: bool
    created_at: datetime


class UserPatch(BaseModel):
    status: Literal["active", "suspended"] | None = None
    verified: bool | None = None


class TemplateNeed(BaseModel):
    type: NeedType
    title: str = Field(min_length=1, max_length=200)
    quantity: Decimal = Field(gt=0)
    unit: str = Field(min_length=1, max_length=60)
    budget_item: str | None = Field(default=None, max_length=120)

    @field_validator("budget_item")
    @classmethod
    def blank_to_none(cls, v: str | None) -> str | None:
        return (v or "").strip() or None


class TemplateIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    project_type: str = Field(min_length=1, max_length=60)
    blurb: str = Field(default="", max_length=300)
    status: TemplateStatus = TemplateStatus.draft
    default_needs: list[TemplateNeed] = Field(default_factory=list, max_length=30)


class TemplatePatch(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    project_type: str | None = Field(default=None, min_length=1, max_length=60)
    blurb: str | None = Field(default=None, max_length=300)
    status: TemplateStatus | None = None
    default_needs: list[TemplateNeed] | None = Field(default=None, max_length=30)


class TemplateOut(Schema):
    id: uuid.UUID
    name: str
    project_type: str
    blurb: str
    default_needs: list[dict]
    status: str


class AdminPaymentOut(Schema):
    id: uuid.UUID
    offer_id: uuid.UUID
    project_name: str
    sponsor_name: str
    gross_amount: Num
    commission_amount: Num
    net_amount: Num
    status: str
    paid_out_at: datetime | None
    created_at: datetime


class AdminCommentOut(Schema):
    id: uuid.UUID
    project_id: uuid.UUID
    project_name: str
    user_id: uuid.UUID
    author_name: str
    parent_id: uuid.UUID | None
    kind: str
    body: str
    status: str
    created_at: datetime


# ---- Registration approvals ---------------------------------------------------------------


def _kind(db, u: AppUser) -> str:
    if u.role == UserRole.organizer:
        t = db.scalar(select(OrganizerProfile.org_type).where(OrganizerProfile.user_id == u.id))
        return ORG_TYPE.get(t.value, "") if t else ""
    return db.scalar(select(SponsorProfile.industry).where(SponsorProfile.user_id == u.id)) or ""


@router.get("/admin/registrations", response_model=list[RegistrationSummary])
def registrations(
    _: Admin,
    db: DB,
    status_: Literal["pending", "approved", "rejected"] = Query("pending", alias="status"),
    limit: int = Query(100, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    """Organizer and sponsor requests. "approved" includes suspended accounts that were once approved."""
    wanted = {
        "pending": [AccountStatus.pending_approval],
        "approved": [AccountStatus.active, AccountStatus.suspended],
        "rejected": [AccountStatus.rejected],
    }[status_]
    users = db.scalars(
        select(AppUser)
        .where(AppUser.role.in_(REG_ROLES), AppUser.status.in_(wanted))
        .order_by(AppUser.created_at.desc())
        .limit(limit)
        .offset(offset)
    ).all()
    return [
        RegistrationSummary(
            user_id=u.id,
            name=u.name,
            role=u.role.value,
            kind=_kind(db, u),
            sent_at=u.created_at,
            status=u.status.value,
            reviewed_by_name=_reviewer(db, u),
            reviewed_at=u.reviewed_at,
        )
        for u in users
    ]


def _reviewer(db, u: AppUser) -> str | None:
    """Name of the admin who decided, or None (pending, or that admin account was deleted)."""
    return name_of(db, u.reviewed_by) if u.reviewed_by else None


def _applicant(db, user_id: uuid.UUID) -> AppUser:
    u = db.get(AppUser, user_id)
    if u is None or u.role not in REG_ROLES:
        raise not_found("Registration request")
    return u


@router.get("/admin/registrations/{user_id}", response_model=RegistrationDetail)
def registration(user_id: uuid.UUID, _: Admin, db: DB):
    """Details and document list."""
    u = _applicant(db, user_id)
    if u.role == UserRole.organizer:
        p = db.scalar(select(OrganizerProfile).where(OrganizerProfile.user_id == u.id))
        profile = OrganizerProfileOut.model_validate(p) if p else None
    else:
        p = db.scalar(select(SponsorProfile).where(SponsorProfile.user_id == u.id))
        profile = SponsorProfileShort.model_validate(p) if p else None
    docs = db.scalars(
        select(RegistrationDocument)
        .where(RegistrationDocument.user_id == u.id)
        .order_by(RegistrationDocument.created_at)
    ).all()
    return RegistrationDetail(
        user_id=u.id,
        role=u.role.value,
        status=u.status.value,
        email=u.email,
        name=u.name,
        sent_at=u.created_at,
        rejection_note=u.rejection_note,
        reviewed_by_name=_reviewer(db, u),
        reviewed_at=u.reviewed_at,
        profile=profile,
        documents=[DocumentOut.model_validate(d) for d in docs],
    )


def _waiting(db, user_id: uuid.UUID) -> AppUser:
    u = db.scalar(select(AppUser).where(AppUser.id == user_id).with_for_update())
    if u is None or u.role not in REG_ROLES:
        raise not_found("Registration request")
    if u.status != AccountStatus.pending_approval:
        raise ApiError(409, "Only a waiting request can be decided.", "bad_status")
    return u


@router.post("/admin/registrations/{user_id}/approve", status_code=status.HTTP_204_NO_CONTENT)
def approve(user_id: uuid.UUID, admin: Admin, db: DB, background: BackgroundTasks) -> None:
    """Status active; notify. Records which admin approved, and when."""
    u = _waiting(db, user_id)
    u.status = AccountStatus.active
    u.verified = True
    u.rejection_note = None
    u.reviewed_by = admin.id
    u.reviewed_at = datetime.now(UTC)
    notify(
        db,
        u.id,
        NotificationType.registration_approved,
        u.id,
        "Your registration was approved. Welcome to MissingPiece!",
    )
    db.commit()
    # Sent after the response, so a mail problem never undoes the approval.
    background.add_task(email.registration_approved, u.email, u.name, u.role.value)


@router.post("/admin/registrations/{user_id}/reject", status_code=status.HTTP_204_NO_CONTENT)
def reject(user_id: uuid.UUID, body: RejectIn, admin: Admin, db: DB, background: BackgroundTasks) -> None:
    """Note required; status rejected; notify. The note is shown when they try to log in."""
    note = body.note.strip()
    if not note:
        raise ApiError(422, "Please write a note saying why. The applicant will see it.", "note_required")
    u = _waiting(db, user_id)
    u.status = AccountStatus.rejected
    u.rejection_note = note
    u.reviewed_by = admin.id
    u.reviewed_at = datetime.now(UTC)
    notify(db, u.id, NotificationType.registration_rejected, u.id, f"Your registration was not approved: {note}")
    db.commit()
    background.add_task(email.registration_rejected, u.email, u.name, u.role.value, note)


# ---- Accounts ---------------------------------------------------------------------------------


@router.get("/admin/users", response_model=list[AdminUserOut])
def users(
    _: Admin,
    db: DB,
    role: UserRole | None = None,
    q: str | None = Query(None, max_length=100),
    limit: int = Query(200, ge=1, le=500),
    offset: int = Query(0, ge=0),
):
    stmt = select(AppUser)
    if role:
        stmt = stmt.where(AppUser.role == role)
    if q and q.strip():
        # Bound as a parameter (no injection). Escape % and _ so they are searched for literally.
        term = q.strip().lower().replace("\\", "\\\\").replace("%", r"\%").replace("_", r"\_")
        like = f"%{term}%"
        stmt = stmt.where(AppUser.name.ilike(like, escape="\\") | AppUser.email.ilike(like, escape="\\"))
    return db.scalars(stmt.order_by(AppUser.role, AppUser.name).limit(limit).offset(offset)).all()


@router.patch("/admin/users/{user_id}", response_model=AdminUserOut)
def update_user(user_id: uuid.UUID, body: UserPatch, admin: Admin, db: DB):
    """Sets status (active or suspended) or verified."""
    u = db.get(AppUser, user_id)
    if u is None:
        raise not_found("Account")
    if body.status is not None:
        if u.id == admin.id:
            raise ApiError(409, "You cannot change your own account status.", "self")
        if u.status in (AccountStatus.pending_approval, AccountStatus.rejected):
            raise ApiError(409, "Decide the registration request first.", "use_approvals")
        u.status = AccountStatus(body.status)
    if body.verified is not None:
        u.verified = body.verified
    db.commit()
    return u


@router.delete("/admin/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(user_id: uuid.UUID, _: Admin, db: DB) -> None:
    """Only demo accounts can be deleted; suspend real ones instead."""
    u = db.get(AppUser, user_id)
    if u is None:
        raise not_found("Account")
    if not u.is_demo:
        raise ApiError(409, "Only demo accounts can be deleted. Suspend real accounts instead.", "not_demo")
    db.delete(u)
    db.commit()


# ---- Templates ---------------------------------------------------------------------------------


def _needs_json(needs: list[TemplateNeed]) -> list[dict]:
    out = []
    for n in needs:
        if n.type == NeedType.money and not n.budget_item:
            raise ApiError(422, f'"{n.title}" is money, so it needs a budget item.', "validation")
        q = n.quantity
        out.append(
            {
                "type": n.type.value,
                "title": n.title.strip(),
                "unit": n.unit.strip(),
                "budget_item": n.budget_item,
                "quantity": int(q) if q == q.to_integral_value() else float(q),
            }
        )
    return out


@router.get("/admin/templates", response_model=list[TemplateOut])
def templates(_: Admin, db: DB):
    return db.scalars(select(Template).order_by(Template.name)).all()


@router.post("/admin/templates", response_model=TemplateOut, status_code=status.HTTP_201_CREATED)
def create_template(body: TemplateIn, _: Admin, db: DB):
    if db.scalar(select(Template.id).where(func.lower(Template.name) == body.name.strip().lower())):
        raise ApiError(409, "A template with this name already exists.", "duplicate")
    t = Template(
        name=body.name.strip(),
        project_type=body.project_type.strip(),
        blurb=body.blurb.strip(),
        status=body.status,
        default_needs=_needs_json(body.default_needs),
    )
    db.add(t)
    db.commit()
    return t


@router.patch("/admin/templates/{template_id}", response_model=TemplateOut)
def update_template(template_id: uuid.UUID, body: TemplatePatch, _: Admin, db: DB):
    t = db.get(Template, template_id)
    if t is None:
        raise not_found("Template")
    data = body.model_dump(exclude_unset=True)
    if "default_needs" in data and body.default_needs is not None:
        t.default_needs = _needs_json(body.default_needs)
    for key in ("name", "project_type", "blurb"):
        if data.get(key) is not None:
            setattr(t, key, data[key].strip())
    if body.status is not None:
        t.status = body.status
    db.commit()
    return t


# ---- Payments (payouts are sent by hand in v1) ---------------------------------------------


def _payment_out(db, pay: Payment) -> AdminPaymentOut:
    o = db.get(Offer, pay.offer_id)
    n = db.get(Need, o.need_id)
    p = db.get(Project, n.project_id)
    return AdminPaymentOut(
        id=pay.id,
        offer_id=o.id,
        project_name=p.name,
        sponsor_name=name_of(db, o.from_user_id),
        gross_amount=pay.gross_amount,
        commission_amount=pay.commission_amount,
        net_amount=pay.net_amount,
        status=pay.status.value,
        paid_out_at=pay.paid_out_at,
        created_at=pay.created_at,
    )


@router.get("/admin/payments", response_model=list[AdminPaymentOut])
def admin_payments(_: Admin, db: DB, limit: int = Query(200, ge=1, le=500), offset: int = Query(0, ge=0)):
    pays = db.scalars(select(Payment).order_by(Payment.created_at.desc()).limit(limit).offset(offset)).all()
    return [_payment_out(db, pay) for pay in pays]


@router.post("/admin/payments/{payment_id}/payout", response_model=AdminPaymentOut)
def payout(payment_id: uuid.UUID, _: Admin, db: DB):
    """Only from succeeded; sets paid_out. The money itself is sent by hand in v1."""
    pay = db.scalar(select(Payment).where(Payment.id == payment_id).with_for_update())
    if pay is None:
        raise not_found("Payment")
    if pay.status != PaymentStatus.succeeded:
        raise ApiError(409, "Only a succeeded payment can be paid out.", "bad_status")
    pay.status = PaymentStatus.paid_out
    pay.paid_out_at = datetime.now(UTC)
    db.commit()
    return _payment_out(db, pay)


@router.post("/admin/payments/{payment_id}/refunded", response_model=AdminPaymentOut)
def refunded(payment_id: uuid.UUID, _: Admin, db: DB):
    """Only from refund_due; the money itself is sent back by hand (like payouts)."""
    pay = db.scalar(select(Payment).where(Payment.id == payment_id).with_for_update())
    if pay is None:
        raise not_found("Payment")
    if pay.status != PaymentStatus.refund_due:
        raise ApiError(409, "Only a payment waiting for a refund can be marked refunded.", "bad_status")
    pay.status = PaymentStatus.refunded
    db.commit()
    return _payment_out(db, pay)


# ---- Hidden comments ---------------------------------------------------------------------------


class AdminMessageOut(Schema):
    id: uuid.UUID
    thread_id: uuid.UUID
    project_name: str
    sender_name: str
    body: str
    created_at: datetime


@router.get("/admin/messages", response_model=list[AdminMessageOut])
def hidden_messages(_: Admin, db: DB):
    rows = db.execute(
        select(Message, AppUser.name, Project.name)
        .join(AppUser, AppUser.id == Message.sender_id)
        .join(MessageThread, MessageThread.id == Message.thread_id)
        .join(SponsorRequest, SponsorRequest.id == MessageThread.request_id)
        .join(Project, Project.id == SponsorRequest.project_id)
        .where(Message.status == CommentStatus.hidden)
        .order_by(Message.created_at.desc(), Message.id)
        .limit(200)
    ).all()
    return [
        AdminMessageOut(
            id=m.id, thread_id=m.thread_id, project_name=project, sender_name=name, body=m.body, created_at=m.created_at
        )
        for m, name, project in rows
    ]


@router.post("/admin/messages/{message_id}/restore", status_code=204)
def restore_message(message_id: uuid.UUID, _: Admin, db: DB) -> None:
    m = db.get(Message, message_id)
    if m is None:
        raise not_found("Message")
    m.status = CommentStatus.visible
    db.commit()


@router.delete("/admin/messages/{message_id}", status_code=204)
def delete_message(message_id: uuid.UUID, _: Admin, db: DB) -> None:
    m = db.get(Message, message_id)
    if m is None:
        raise not_found("Message")
    db.delete(m)
    db.commit()


@router.get("/admin/comments", response_model=list[AdminCommentOut])
def admin_comments(_: Admin, db: DB, status_: Literal["hidden", "visible"] = Query("hidden", alias="status")):
    rows = db.execute(
        select(Comment, Project)
        .join(Project, Project.id == Comment.project_id)
        .where(Comment.status == CommentStatus(status_))
        .order_by(Comment.created_at.desc())
        .limit(200)
    ).all()
    return [
        AdminCommentOut(
            id=c.id,
            project_id=p.id,
            project_name=p.name,
            user_id=c.user_id,
            author_name=name_of(db, c.user_id),
            parent_id=c.parent_id,
            kind=c.kind.value,
            body=c.body,
            status=c.status.value,
            created_at=c.created_at,
        )
        for c, p in rows
    ]


@router.post("/admin/comments/{comment_id}/restore", status_code=status.HTTP_204_NO_CONTENT)
def restore_comment(comment_id: uuid.UUID, _: Admin, db: DB) -> None:
    """Human review may restore an AI false positive or a comment held during an outage."""
    c = db.get(Comment, comment_id)
    if c is None:
        raise not_found("Comment")
    c.status = CommentStatus.visible
    db.commit()


@router.delete("/admin/comments/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_comment(comment_id: uuid.UUID, _: Admin, db: DB) -> None:
    """Deletes the comment and its replies (replies cascade)."""
    if db.get(Comment, comment_id) is None:
        raise not_found("Comment")
    db.execute(delete(Comment).where(Comment.id == comment_id))
    db.commit()


# ---- Files ---------------------------------------------------------------------------------------


class FileLink(BaseModel):
    url: str | None


@router.get("/files/{document_id}", response_model=FileLink)
def file_link(document_id: uuid.UUID, user: ActiveUser, db: DB):
    """Admin or owner; returns a short-lived download link (5 minutes)."""
    d = db.get(RegistrationDocument, document_id)
    if d is None:
        raise not_found("File")
    if user.role != UserRole.admin and d.user_id != user.id:
        raise forbidden()
    return FileLink(url=storage().signed_url(d.storage_key, 300))
