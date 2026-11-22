"""Demo data (build prompt section 12).

    poetry run python -m app.seed                  # demo data; log in with dev tokens (python -m app.dev_token)
    poetry run python -m app.seed --supabase       # also creates each account in Supabase Auth
    poetry run python -m app.seed --reset          # DELETES EVERY ROW first, then loads the demo again

With --supabase (needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY), every demo
account is created in Supabase with its email already confirmed and the
password DEMO_PASSWORD, so you can log in from the real log-in screens.
"""

import sys
import uuid
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal

import httpx
from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db import Base, SessionLocal
from app.models import (
    AppUser,
    Benefit,
    Comment,
    EventMembership,
    Message,
    MessageThread,
    Need,
    Notification,
    Offer,
    OrganizerProfile,
    Payment,
    Project,
    Receipt,
    RegistrationDocument,
    SponsorProfile,
    SponsorRequest,
    Template,
)
from app.models.enums import (
    AccountStatus,
    CommentKind,
    ContributionRole,
    DocumentKind,
    MembershipRole,
    MembershipStatus,
    NeedStatus,
    NeedType,
    NotificationType,
    OfferStage,
    OrgType,
    PaymentStatus,
    ProjectStatus,
    TemplateStatus,
    UserRole,
)

DEMO_PASSWORD = "password123"  # nosec B105: public demo password, documented in the README
BD = timedelta(hours=6)  # Bangladesh time, for event time slots


def slot(day: date, start_h: int, end_h: int) -> tuple[datetime, datetime]:
    base = datetime(day.year, day.month, day.day, tzinfo=UTC) - BD
    return base + timedelta(hours=start_h), base + timedelta(hours=end_h)


# ---- Supabase users -------------------------------------------------------------------


USE_SUPABASE = "--supabase" in sys.argv


def supabase_user_id(email: str) -> uuid.UUID:
    """With --supabase: create (or find) a confirmed Supabase user. Otherwise a random id for dev tokens."""
    s = get_settings()
    if not USE_SUPABASE:
        return uuid.uuid4()
    if not (s.supabase_url and s.supabase_service_role_key):
        raise SystemExit("--supabase needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in backend/.env")
    base = s.supabase_url.rstrip("/") + "/auth/v1/admin/users"
    headers = {"apikey": s.supabase_service_role_key, "Authorization": f"Bearer {s.supabase_service_role_key}"}
    r = httpx.post(
        base, headers=headers, json={"email": email, "password": DEMO_PASSWORD, "email_confirm": True}, timeout=20
    )
    if r.status_code in (200, 201):
        return uuid.UUID(r.json()["id"])
    # Already registered: look it up.
    page = 1
    while True:
        lst = httpx.get(base, headers=headers, params={"page": page, "per_page": 200}, timeout=20)
        lst.raise_for_status()
        users = lst.json().get("users", [])
        for u in users:
            if (u.get("email") or "").lower() == email.lower():
                return uuid.UUID(u["id"])
        if len(users) < 200:
            raise RuntimeError(f"Supabase refused {email}: {r.status_code} {r.text[:200]}")
        page += 1


# ---- Builders -----------------------------------------------------------------------------


class Seeder:
    def __init__(self, db: Session):
        self.db = db
        self.users: dict[str, AppUser] = {}

    def user(self, key: str, email: str, role: UserRole, name: str, status=AccountStatus.active, **kw) -> AppUser:
        u = AppUser(supabase_user_id=supabase_user_id(email), email=email, role=role, status=status, name=name, **kw)
        if role in (UserRole.organizer, UserRole.sponsor) and status == AccountStatus.active:
            u.verified = True
        self.db.add(u)
        self.db.flush()
        self.users[key] = u
        return u

    def organizer(self, key, email, name, org_type, reg, contact, status=AccountStatus.active) -> AppUser:
        u = self.user(key, email, UserRole.organizer, name, status)
        self.db.add(
            OrganizerProfile(
                user_id=u.id,
                org_name=name,
                org_type=org_type,
                registration_number=reg,
                contact_person=contact,
                phone="+880 1700 000001",
            )
        )
        if status != AccountStatus.active:
            self.db.add(
                RegistrationDocument(
                    user_id=u.id,
                    storage_key=f"demo/{u.id}/proof.pdf",
                    file_name="registration-certificate.pdf",
                    content_type="application/pdf",
                    size_bytes=412_000,
                    kind=DocumentKind.registration_proof,
                )
            )
        return u

    def sponsor(
        self, key, email, company, industry, interests, types, status=AccountStatus.active, desc=None, **kw
    ) -> AppUser:
        u = self.user(key, email, UserRole.sponsor, company, status, **kw)
        self.db.add(
            SponsorProfile(
                user_id=u.id,
                company=company,
                industry=industry,
                trade_license_number=f"TL-{key.upper()}",
                contact_person="Demo contact",
                phone="+880 1700 000010",
                interests=interests,
                preferred_types=types,
                location="Dhaka",
                description=desc,
            )
        )
        if status != AccountStatus.active:
            self.db.add(
                RegistrationDocument(
                    user_id=u.id,
                    storage_key=f"demo/{u.id}/license.jpg",
                    file_name="trade-license.jpg",
                    content_type="image/jpeg",
                    size_bytes=380_000,
                    kind=DocumentKind.trade_license,
                )
            )
        return u

    def need(
        self, project: Project, type_: NeedType, title, qty, unit, budget=None, when=None, status=NeedStatus.open
    ) -> Need:
        n = Need(
            project_id=project.id,
            type=type_,
            title=title,
            quantity=Decimal(qty),
            unit=unit,
            budget_item=budget,
            slot_start=when[0] if when else None,
            slot_end=when[1] if when else None,
            status=status,
        )
        self.db.add(n)
        self.db.flush()
        return n

    def request(self, project, need, sponsor, benefits, exclusive=None, decide_by=None) -> SponsorRequest:
        r = SponsorRequest(
            project_id=project.id,
            need_id=need.id,
            sponsor_id=sponsor.id,
            benefits=benefits,
            exclusive_category=exclusive,
            decide_by=decide_by,
        )
        self.db.add(r)
        self.db.flush()
        self.db.add(MessageThread(request_id=r.id, organizer_id=project.organizer_id, sponsor_id=sponsor.id))
        self.db.flush()
        return r

    def offer(
        self, need, user, stage, request=None, amount=None, exclusive=None, conditions=None, benefits=(), role=None
    ) -> Offer:
        o = Offer(
            need_id=need.id,
            from_user_id=user.id,
            request_id=request.id if request else None,
            stage=stage,
            amount=Decimal(amount) if amount else None,
            exclusive_category=exclusive,
            conditions=conditions,
            contribution_role=role,
            slot_start=need.slot_start,
            slot_end=need.slot_end,
            resource=need.title.lower() if need.type in (NeedType.equipment, NeedType.space) else None,
        )
        self.db.add(o)
        self.db.flush()
        for label, given in benefits:
            self.db.add(Benefit(offer_id=o.id, label=label, given=given, given_at=datetime.now(UTC) if given else None))
        if stage in (OfferStage.accepted, OfferStage.received):
            need.status = NeedStatus.covered
        if stage == OfferStage.received:
            project = self.db.get(Project, need.project_id)
            self.db.add(Receipt(offer_id=o.id, confirmed_by=project.organizer_id))
        return o

    def thread_for(self, r: SponsorRequest) -> MessageThread:
        return self.db.scalar(select(MessageThread).where(MessageThread.request_id == r.id))


def seed(db: Session) -> None:
    s = Seeder(db)
    # Accounts
    s.user("admin", "admin@missingpiece.example", UserRole.admin, "Platform admin")
    cse = s.organizer("cse", "csesociety@example.org", "CSE Society", OrgType.university, "DU-CSE-0420", "Nusrat Jahan")
    s.organizer(
        "greenhands",
        "contact@greenhands.example",
        "Green Hands NGO",
        OrgType.ngo,
        "NGO-2231",
        "Nadia Islam",
        status=AccountStatus.pending_approval,
    )
    bright = s.organizer(
        "bright", "team@brightfuture.example", "Bright Future NGO", OrgType.ngo, "NGO-1187", "Farzana Haque"
    )
    science = s.organizer(
        "science", "scienceclub@example.org", "Science Club", OrgType.university, "DU-SC-0311", "Imran Kabir"
    )
    es = s.sponsor(
        "examplesoft",
        "csr@examplesoftware.example",
        "Example Software Co.",
        "Software",
        ["education", "technology", "youth"],
        ["money", "equipment"],
        desc="We support student tech events and digital learning.",
    )
    s.sponsor(
        "freshfoods",
        "hello@freshfoods.example",
        "Fresh Foods Ltd.",
        "Food",
        ["community"],
        ["product"],
        status=AccountStatus.pending_approval,
    )
    foods = s.sponsor(
        "samplefoods", "orders@samplefoods.example", "Sample Foods Ltd.", "Food", ["community", "youth"], ["product"]
    )
    bakery = s.sponsor("bakery", "hello@examplebakery.example", "Example Bakery", "Food", ["community"], ["product"])
    campus = s.sponsor(
        "campus",
        "events@campusoffice.example",
        "Campus Events Office",
        "Education",
        ["education"],
        ["space", "equipment"],
    )
    aisha = s.user(
        "aisha", "aisha@example.com", UserRole.general, "Aisha Rahman", age=34, skills=["Teaching", "Smartphone help"]
    )
    rahima = s.user(
        "rahima",
        "rahima@example.com",
        UserRole.general,
        "Rahima Begum",
        age=67,
        skills=["Tailoring"],
        items=["Sewing machine"],
    )
    demo = s.user("demo", "demo.user@example.com", UserRole.general, "Demo User", is_demo=True)

    # Templates
    uni = Template(
        name="University event",
        blurb="Fills in snack packs, prize money, projector, volunteers",
        project_type="university_event",
        status=TemplateStatus.live,
        default_needs=[
            {"type": "product", "title": "Snack packs", "quantity": 200, "unit": "packs"},
            {"type": "money", "title": "Prize fund", "quantity": 20000, "unit": "BDT", "budget_item": "prizes"},
            {"type": "equipment", "title": "Projector", "quantity": 1, "unit": "projector"},
            {"type": "time", "title": "Volunteers", "quantity": 10, "unit": "people"},
        ],
    )
    ngo = Template(
        name="NGO project",
        blurb="Fills in trainers, printed guides, venue, transport money",
        project_type="ngo_project",
        status=TemplateStatus.live,
        default_needs=[
            {"type": "skill", "title": "Trainers", "quantity": 3, "unit": "trainers"},
            {"type": "product", "title": "Printed guides", "quantity": 50, "unit": "copies"},
            {"type": "space", "title": "Venue", "quantity": 1, "unit": "room for 50"},
            {"type": "money", "title": "Transport money", "quantity": 5000, "unit": "BDT", "budget_item": "transport"},
        ],
    )
    elder = Template(
        name="Elders and youth activity",
        blurb="Fills in a sewing machine and a student helper",
        project_type="elders_youth",
        status=TemplateStatus.live,
        default_needs=[
            {"type": "equipment", "title": "Sewing machine", "quantity": 1, "unit": "machine"},
            {"type": "time", "title": "Student helper", "quantity": 1, "unit": "person"},
        ],
    )
    db.add_all([uni, ngo, elder])
    db.flush()

    today = datetime.now(UTC).date()
    fest_day, dig_day, tailor_day = today + timedelta(days=25), today + timedelta(days=54), today + timedelta(days=47)

    def project(org, tpl, name, desc, day, venue, audience, status=ProjectStatus.live, inst=None) -> Project:
        p = Project(
            organizer_id=org.id,
            template_id=tpl.id,
            name=name,
            purpose=desc,
            description=desc,
            event_date=day,
            venue=venue,
            audience=audience,
            institution=inst,
            status=status,
        )
        db.add(p)
        db.flush()
        return p

    # CSE Fest 2026: snack packs, prize fund BDT 20,000, projector, volunteers, hall (build prompt 12)
    fest = project(
        cse,
        uni,
        "CSE Fest 2026",
        "A one-day fest for 200 computer science students, with a programming contest and project showcase.",
        fest_day,
        "University hall",
        200,
        inst="University of Dhaka",
    )
    snacks = s.need(fest, NeedType.product, "Snack packs", 200, "packs")
    drinks = s.need(fest, NeedType.product, "Drinks", 200, "bottles")
    prize = s.need(fest, NeedType.money, "Prize fund", 20000, "BDT", budget="prizes")
    projector = s.need(fest, NeedType.equipment, "Projector", 1, "projector", when=slot(fest_day, 10, 17))
    volunteers = s.need(fest, NeedType.time, "Volunteers", 10, "people", when=slot(fest_day, 9, 18))
    hall = s.need(fest, NeedType.space, "Hall", 200, "seats", when=slot(fest_day, 8, 20))

    r_snacks = s.request(fest, snacks, foods, ["Logo on banner"], exclusive="food")
    s.offer(
        snacks,
        foods,
        OfferStage.accepted,
        r_snacks,
        exclusive="food",
        conditions="Delivered to the hall by 9 am.",
        benefits=[("Logo on banner", True)],
    )
    # Two clashing exclusive food offers (rule 3)
    r_d1 = s.request(fest, drinks, foods, ["Logo on banner"], exclusive="food")
    r_d2 = s.request(fest, drinks, bakery, ["Stall at the fest"], exclusive="food")
    s.offer(
        drinks,
        foods,
        OfferStage.offered,
        r_d1,
        exclusive="food",
        conditions="Drinks for 200",
        benefits=[("Logo on banner", False)],
    )
    s.offer(
        drinks,
        bakery,
        OfferStage.offered,
        r_d2,
        exclusive="food",
        conditions="Drinks for 200",
        benefits=[("Stall at the fest", False)],
    )
    r_prize = s.request(
        fest,
        prize,
        es,
        ["Logo on the main banner", "Thank-you on stage", "Impact report after the event"],
        decide_by=today + timedelta(days=12),
    )
    r_proj = s.request(fest, projector, es, ["Logo on the main banner", "Thank-you on stage"])
    s.offer(
        projector,
        es,
        OfferStage.received,
        r_proj,
        benefits=[("Logo on the main banner", True), ("Thank-you on stage", True)],
    )
    r_hall = s.request(fest, hall, campus, ["Thank-you on stage"])
    s.offer(hall, campus, OfferStage.accepted, r_hall, benefits=[("Thank-you on stage", False)])
    o_rahim = s.offer(volunteers, rahima, OfferStage.offered, role=ContributionRole.contributor)
    db.add(
        EventMembership(
            user_id=rahima.id,
            project_id=fest.id,
            role=MembershipRole.contributor,
            status=MembershipStatus.pending,
            offer_id=o_rahim.id,
        )
    )
    db.add(
        EventMembership(
            user_id=aisha.id, project_id=fest.id, role=MembershipRole.participant, status=MembershipStatus.approved
        )
    )
    th = s.thread_for(r_prize)
    db.add_all(
        [
            Message(
                thread_id=th.id, sender_id=cse.id, body="Happy to answer any questions before you offer.", read=True
            ),
            Message(thread_id=th.id, sender_id=es.id, body="Can we present the prizes on stage?"),
            Message(thread_id=th.id, sender_id=cse.id, body="Yes, we can add that to the benefits."),
        ]
    )
    q = Comment(
        project_id=fest.id, user_id=aisha.id, kind=CommentKind.question, body="Can parents come to watch the contest?"
    )
    db.add(q)
    db.flush()
    db.add(
        Comment(
            project_id=fest.id,
            user_id=cse.id,
            parent_id=q.id,
            kind=CommentKind.reply,
            body="Yes! The showcase is open to everyone from 3 pm.",
        )
    )

    # Digital Learning Session (Bright Future NGO)
    dig = project(
        bright,
        ngo,
        "Digital Learning Session",
        "A hands-on session to help 50 community members learn basic smartphone, email and online service skills.",
        dig_day,
        "Mirpur community hall",
        50,
        inst="Bright Future NGO (NGO-1187)",
    )
    s.need(dig, NeedType.skill, "Trainers", 3, "trainers", when=slot(dig_day, 14, 16))
    guides = s.need(dig, NeedType.product, "Printed guides", 50, "copies")
    transport = s.need(dig, NeedType.money, "Transport money", 5000, "BDT", budget="transport")
    r_g = s.request(dig, guides, es, ["Logo on printed guides"], decide_by=today + timedelta(days=20))
    s.offer(
        guides,
        es,
        OfferStage.offered,
        r_g,
        conditions="Printed in Bangla and English.",
        benefits=[("Logo on printed guides", False)],
    )
    r_t = s.request(dig, transport, es, ["Thank-you on stage", "Impact report after the event"])
    s.offer(
        transport,
        es,
        OfferStage.accepted,
        r_t,
        amount=5000,
        benefits=[("Thank-you on stage", False), ("Impact report after the event", False)],
    )
    db.add(
        Message(
            thread_id=s.thread_for(r_t).id,
            sender_id=bright.id,
            body="Thank you! We accepted your offer. Please pay when you can.",
        )
    )
    db.add(
        EventMembership(
            user_id=rahima.id, project_id=dig.id, role=MembershipRole.participant, status=MembershipStatus.approved
        )
    )

    # Tailoring Repair Workshop: sewing machine already covered by another sponsor; a failed payment
    tailor = project(
        cse,
        elder,
        "Tailoring Repair Workshop",
        "A retired tailor teaches young people how to repair clothes. Older people share a skill; students help and learn.",
        tailor_day,
        "Community centre",
        25,
        inst="Dhanmondi youth group",
    )
    machine = s.need(tailor, NeedType.equipment, "Sewing machine", 1, "machine", when=slot(tailor_day, 15, 17))
    s.need(tailor, NeedType.time, "Student helper", 1, "person", when=slot(tailor_day, 15, 17))
    materials = s.need(tailor, NeedType.money, "Materials", 3000, "BDT", budget="materials")
    r_m1 = s.request(tailor, machine, es, ["Thank-you at the workshop"])
    r_m2 = s.request(tailor, machine, campus, ["Thank-you at the workshop"])
    s.offer(machine, es, OfferStage.declined, r_m1)
    s.offer(machine, campus, OfferStage.accepted, r_m2)
    r_mat = s.request(tailor, materials, bakery, [])
    o_mat = s.offer(materials, bakery, OfferStage.accepted, r_mat, amount=3000)
    db.add(
        Payment(
            offer_id=o_mat.id,
            gross_amount=Decimal("3150.00"),
            commission_amount=Decimal("150.00"),
            net_amount=Decimal("3000.00"),
            status=PaymentStatus.failed,
        )
    )

    # Spring Science Fair: finished; a succeeded payment and a received product (sponsor report)
    sci = project(
        science,
        uni,
        "Spring Science Fair",
        "A one-day fair where 120 students show science projects to families.",
        today - timedelta(days=44),
        "Science faculty lawn",
        300,
        status=ProjectStatus.complete,
        inst="University of Dhaka",
    )
    ssn = s.need(sci, NeedType.product, "Snack packs", 150, "packs")
    spz = s.need(sci, NeedType.money, "Prize money", 10000, "BDT", budget="prizes")
    r_s = s.request(sci, ssn, es, ["Logo on the main banner", "Thank-you on stage"])
    s.offer(
        ssn, es, OfferStage.received, r_s, benefits=[("Logo on the main banner", True), ("Thank-you on stage", True)]
    )
    r_sp = s.request(sci, spz, foods, [])
    o_sp = s.offer(spz, foods, OfferStage.received, r_sp, amount=10000)
    db.add(
        Payment(
            offer_id=o_sp.id,
            gross_amount=Decimal("10500.00"),
            commission_amount=Decimal("500.00"),
            net_amount=Decimal("10000.00"),
            status=PaymentStatus.succeeded,
        )
    )
    for u in (aisha, rahima, demo):
        db.add(
            EventMembership(
                user_id=u.id, project_id=sci.id, role=MembershipRole.participant, status=MembershipStatus.approved
            )
        )

    # Robotics Club Demo Day: the event date passed while Example Software's offer waited
    rob_day = today - timedelta(days=8)
    rob = project(
        science,
        uni,
        "Robotics Club Demo Day",
        "Robotics club members demo their robots to 80 school students.",
        rob_day,
        "Engineering building",
        80,
        inst="University of Dhaka",
    )
    rhall = s.need(rob, NeedType.space, "Venue", 1, "hall", when=slot(rob_day, 10, 15))
    s.offer(rhall, es, OfferStage.expired, s.request(rob, rhall, es, ["Logo on the main banner"]))

    db.add_all(
        [
            Notification(
                user_id=es.id,
                type=NotificationType.request_received,
                ref_id=r_prize.id,
                text="CSE Society sent you a request for the prize fund (CSE Fest 2026).",
            ),
            Notification(
                user_id=es.id,
                type=NotificationType.offer_accepted,
                ref_id=r_t.id,
                text="Bright Future NGO accepted your BDT 5,000 offer. You can pay now.",
            ),
        ]
    )
    db.commit()


def main() -> None:
    reset = "--reset" in sys.argv
    with SessionLocal() as db:
        if db.scalar(select(func.count()).select_from(AppUser)):
            if not reset:
                print("The database already has data. Run with --reset to DELETE EVERYTHING and load the demo again.")
                return
            tables = ", ".join(f'"{t.name}"' for t in Base.metadata.sorted_tables)
            # Table names come from the models, never from user input.
            db.execute(text(f"TRUNCATE {tables} CASCADE"))
            db.commit()
            print("Deleted all rows.")
        seed(db)
        n = db.scalar(select(func.count()).select_from(AppUser))
        mode = "Supabase users" if USE_SUPABASE else "random ids (log in with dev tokens)"
        print(f"Seeded {n} accounts with {mode}. Demo password: {DEMO_PASSWORD}")


if __name__ == "__main__":
    main()
