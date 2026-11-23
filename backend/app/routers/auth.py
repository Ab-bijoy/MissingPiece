"""Auth and registration (build prompt 7.1).

Log-in, log-out, the email code, resend and password reset happen in Supabase
on the front end. These endpoints create our own profile once the email is
verified, and tell the front end who is logged in.
"""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import DB, Claims, CurrentUser, current_user_optional, token_claims
from app.errors import ApiError
from app.models import AppUser, OrganizerProfile, RegistrationDocument, SponsorProfile
from app.models.enums import AccountStatus, DocumentKind, OrgType, UserRole
from app.schemas.auth import MeOut, OrganizerProfileOut, RegisterUserIn, SponsorProfileShort
from app.services.storage import storage

router = APIRouter(prefix="/api/auth", tags=["auth"])

MAX_FILE = 5 * 1024 * 1024
# What the file must start with, per allowed type (so a renamed .exe is refused).
MAGIC = {"application/pdf": (b"%PDF",), "image/jpeg": (b"\xff\xd8\xff",), "image/png": (b"\x89PNG\r\n\x1a\n",)}
EXT = {"application/pdf": ".pdf", "image/jpeg": ".jpg", "image/png": ".png"}


def me_out(db: Session, u: AppUser) -> MeOut:
    profile = None
    if u.role == UserRole.organizer:
        p = db.scalar(select(OrganizerProfile).where(OrganizerProfile.user_id == u.id))
        profile = OrganizerProfileOut.model_validate(p) if p else None
    elif u.role == UserRole.sponsor:
        p = db.scalar(select(SponsorProfile).where(SponsorProfile.user_id == u.id))
        profile = SponsorProfileShort.model_validate(p) if p else None
    return MeOut(
        id=u.id,
        email=u.email,
        role=u.role.value,
        status=u.status.value,
        name=u.name,
        age=u.age,
        rejection_note=u.rejection_note,
        profile=profile,
    )


@router.get("/me", response_model=MeOut)
def me(user: CurrentUser, db: DB):
    """Any token. 404 `no_profile` means: email verified, but no profile yet (finish signing up)."""
    return me_out(db, user)


# ---- Registration -----------------------------------------------------------------------

Claimed = Annotated[Claims, Depends(token_claims)]
Existing = Annotated[AppUser | None, Depends(current_user_optional)]


def _check_new(db: Session, claims: Claims, existing: AppUser | None) -> str:
    if existing is not None:
        raise ApiError(409, "This account already has a profile.", "already_registered")
    email = claims.email.strip().lower()
    if not email:
        raise ApiError(422, "Your log-in has no email address.", "validation")
    if db.scalar(select(AppUser.id).where(AppUser.email == email)):
        raise ApiError(409, "Another account already uses this email.", "email_taken")
    return email


async def _read_document(file: UploadFile) -> tuple[bytes, str]:
    ctype = (file.content_type or "").lower()
    if ctype == "image/jpg":
        ctype = "image/jpeg"
    if ctype not in MAGIC:
        raise ApiError(422, "The document must be a PDF, JPG or PNG.", "file_type")
    data = await file.read(MAX_FILE + 1)
    if not data:
        raise ApiError(422, "Please attach the document.", "file_missing")
    if len(data) > MAX_FILE:
        raise ApiError(422, "The document must be 5 MB or smaller.", "file_too_large")
    if not data.startswith(MAGIC[ctype]):
        raise ApiError(422, "The file does not look like a real PDF, JPG or PNG.", "file_type")
    return data, ctype


def _store(db: Session, user: AppUser, file: UploadFile, data: bytes, ctype: str, kind: DocumentKind) -> None:
    key = f"registration/{user.id}/{uuid.uuid4().hex}{EXT[ctype]}"
    storage().upload(key, data, ctype)
    name = (file.filename or f"document{EXT[ctype]}").replace("/", "_").replace("\\", "_")[:255]
    db.add(
        RegistrationDocument(
            user_id=user.id, storage_key=key, file_name=name, content_type=ctype, size_bytes=len(data), kind=kind
        )
    )


@router.post("/register/user", response_model=MeOut, status_code=status.HTTP_201_CREATED)
def register_user(body: RegisterUserIn, claims: Claimed, existing: Existing, db: DB):
    """General users are active as soon as their profile exists."""
    email = _check_new(db, claims, existing)
    u = AppUser(
        supabase_user_id=claims.supabase_user_id,
        email=email,
        role=UserRole.general,
        status=AccountStatus.active,
        name=body.name.strip(),
        age=body.age,
    )
    db.add(u)
    db.commit()
    return me_out(db, u)


def _clean(value: str, field: str, max_len: int) -> str:
    v = value.strip()
    if not v:
        raise ApiError(422, f"Please fill in {field}.", "validation")
    return v[:max_len]


@router.post("/register/organizer", response_model=MeOut, status_code=status.HTTP_201_CREATED)
async def register_organizer(
    claims: Claimed,
    existing: Existing,
    db: DB,
    org_name: Annotated[str, Form()],
    org_type: Annotated[OrgType, Form()],
    registration_number: Annotated[str, Form()],
    contact_person: Annotated[str, Form()],
    phone: Annotated[str, Form()],
    proof: Annotated[UploadFile, File()],
):
    """Multipart: organization fields + proof file (PDF, JPG or PNG, up to 5 MB). Waits for an admin."""
    email = _check_new(db, claims, existing)
    data, ctype = await _read_document(proof)
    u = AppUser(
        supabase_user_id=claims.supabase_user_id,
        email=email,
        role=UserRole.organizer,
        status=AccountStatus.pending_approval,
        name=_clean(org_name, "the organization name", 200),
    )
    db.add(u)
    db.flush()
    db.add(
        OrganizerProfile(
            user_id=u.id,
            org_name=u.name,
            org_type=org_type,
            registration_number=_clean(registration_number, "the registration number", 100),
            contact_person=_clean(contact_person, "the contact person", 200),
            phone=_clean(phone, "the phone number", 40),
        )
    )
    _store(db, u, proof, data, ctype, DocumentKind.registration_proof)
    db.commit()
    return me_out(db, u)


@router.post("/register/sponsor", response_model=MeOut, status_code=status.HTTP_201_CREATED)
async def register_sponsor(
    claims: Claimed,
    existing: Existing,
    db: DB,
    company: Annotated[str, Form()],
    industry: Annotated[str, Form()],
    trade_license_number: Annotated[str, Form()],
    contact_person: Annotated[str, Form()],
    phone: Annotated[str, Form()],
    trade_license: Annotated[UploadFile, File()],
):
    """Multipart: company fields + trade licence file. Waits for an admin."""
    email = _check_new(db, claims, existing)
    data, ctype = await _read_document(trade_license)
    u = AppUser(
        supabase_user_id=claims.supabase_user_id,
        email=email,
        role=UserRole.sponsor,
        status=AccountStatus.pending_approval,
        name=_clean(company, "the company name", 200),
    )
    db.add(u)
    db.flush()
    db.add(
        SponsorProfile(
            user_id=u.id,
            company=u.name,
            industry=_clean(industry, "the industry", 120),
            trade_license_number=_clean(trade_license_number, "the trade licence number", 100),
            contact_person=_clean(contact_person, "the contact person", 200),
            phone=_clean(phone, "the phone number", 40),
        )
    )
    _store(db, u, trade_license, data, ctype, DocumentKind.trade_license)
    db.commit()
    return me_out(db, u)
