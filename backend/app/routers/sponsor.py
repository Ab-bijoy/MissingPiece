"""Sponsor endpoints (build prompt 7.4). Every route needs an active sponsor."""

import uuid

from fastapi import APIRouter, Query, Request, status

from app.auth import DB, ActiveUser, Sponsor
from app.schemas.common import OfferOut
from app.schemas.sponsor import (
    OfferIn,
    PaymentIn,
    PaymentQuote,
    PaymentStart,
    SponsorOfferRow,
    SponsorProfileIn,
    SponsorProfileOut,
    SponsorReport,
    SponsorRequestDetail,
    SponsorRequestSummary,
)
from app.services import offers, payments
from app.services import sponsor as svc

router = APIRouter(prefix="/api", tags=["sponsor"])

Limit = Query(50, ge=1, le=200)
Offset = Query(0, ge=0)


@router.get("/sponsor/requests", response_model=list[SponsorRequestSummary])
def inbox(user: Sponsor, db: DB, limit: int = Limit, offset: int = Offset):
    """Inbox: requests organizers sent to this sponsor, newest first."""
    return svc.inbox(db, user, limit, offset)


@router.get("/requests/{request_id}", response_model=SponsorRequestDetail)
def request_detail(request_id: uuid.UUID, user: Sponsor, db: DB):
    return svc.request_detail(db, user, request_id)


@router.post("/requests/{request_id}/offers", response_model=OfferOut, status_code=status.HTTP_201_CREATED)
def make_offer(request_id: uuid.UUID, body: OfferIn, user: Sponsor, db: DB):
    """One offer covers the whole need; it starts at stage `offered`."""
    return svc.make_offer(db, user, request_id, body)


@router.get("/sponsor/offers", response_model=list[SponsorOfferRow])
def my_offers(user: Sponsor, db: DB, limit: int = Limit, offset: int = Offset):
    """My offers with stage, benefits given and what to do next."""
    return svc.my_offers(db, user, limit, offset)


@router.post("/offers/{offer_id}/withdraw", status_code=status.HTTP_204_NO_CONTENT)
def withdraw(offer_id: uuid.UUID, user: ActiveUser, db: DB) -> None:
    """Rule 7. Sponsors and contributors can withdraw their own offers."""
    offers.withdraw(db, user, offer_id)


@router.get("/offers/{offer_id}/payment-quote", response_model=PaymentQuote)
def payment_quote(offer_id: uuid.UUID, user: Sponsor, db: DB):
    """Amount, 5% commission and total."""
    return payments.quote(db, user, offer_id)


@router.post("/offers/{offer_id}/payments", response_model=PaymentStart, status_code=status.HTTP_201_CREATED)
def start_payment(offer_id: uuid.UUID, body: PaymentIn, request: Request, user: Sponsor, db: DB):
    """Creates a pending payment and returns the gateway's checkout URL."""
    return payments.start(db, user, offer_id, str(request.base_url))


@router.get("/sponsor/reports/{project_id}", response_model=SponsorReport)
def report(project_id: uuid.UUID, user: Sponsor, db: DB):
    """Only if the sponsor had a received offer in that project."""
    return svc.report(db, user, project_id)


@router.get("/sponsor/profile", response_model=SponsorProfileOut)
def get_profile(user: Sponsor, db: DB):
    return svc.get_profile(db, user)


@router.patch("/sponsor/profile", response_model=SponsorProfileOut)
def update_profile(body: SponsorProfileIn, user: Sponsor, db: DB):
    """Used by matching."""
    return svc.update_profile(db, user, body)
