# MissingPiece

**A community program and sponsorship platform that connects organizers, participants, contributors, and sponsors.**

MissingPiece helps an organization turn a program idea into a supported event. Organizers publish programs and explain what they need; community members join or offer practical help; sponsors provide funding or resources; administrators verify organizations and review moderated content.

The project combines a React frontend, a FastAPI backend, PostgreSQL application data, Supabase authentication, and AI services for content moderation and sponsor recommendations. It includes separate experiences for general users, organizers, sponsors, and administrators.

## Contents

- [What the application does](#what-the-application-does)
- [How the main workflows work](#how-the-main-workflows-work)
- [Architecture and technology](#architecture-and-technology)
- [Database design](#database-design)
- [AI moderation and sponsor matching](#ai-moderation-and-sponsor-matching)
- [Project structure](#project-structure)
- [Local installation](#local-installation)
- [Configuration reference](#configuration-reference)
- [API overview](#api-overview)
- [Testing and verification](#testing-and-verification)
- [Deployment and maintenance](#deployment-and-maintenance)
- [Troubleshooting](#troubleshooting)
- [Current design boundaries](#current-design-boundaries)
- [License](#license)

## What the application does

| Role | Main capabilities |
| --- | --- |
| General user | Browse programs, join as a participant, cancel participation, apply as a contributor, withdraw an offer, track applications, update a profile, and take part in discussions. |
| Organizer | Create and publish programs, define resource needs and schedules, review contributor applications, find sponsors, send sponsorship requests, manage offers and bookings, confirm received resources, and view program reports. |
| Sponsor | Maintain a sponsor profile, browse opportunities, respond to requests, make offers, communicate with organizers, pay for accepted monetary offers, and view sponsorship reports. |
| Administrator | Review organization registrations and proof documents, manage account status and templates, review hidden comments and messages, and manage payment, payout, and refund records. |

Programs can request **money, products, skills, time, equipment, or space**. The application tracks which needs are open or covered and shows participation and contribution progress.

The interface includes responsive pages, loading and error feedback, notifications, and role-specific navigation. Browser demo mode is available separately from the real backend integration.

## How the main workflows work

### 1. Registration, authentication, and access

1. Supabase Auth establishes a user's identity and issues an access token.
2. The frontend sends that token to FastAPI as a Bearer token.
3. The backend verifies the token and loads the corresponding application account from PostgreSQL.
4. Backend authorization checks the account's role, status, and ownership of the requested resource.

Organizer and sponsor registration includes profile information and supporting documents for administrator review. Pending, rejected, and suspended accounts are restricted according to their status. Administrators are assigned through the backend administration helper rather than public administrator registration.

Supabase handles identity; PostgreSQL stores the application's programs, memberships, offers, comments, and other business records. Registration proof files use Supabase Storage.

### 2. Creating and publishing a program

An organizer creates a draft manually or from a template, enters the program details, and adds resource needs. Before publication, scheduled needs must have valid availability.

For **skill, time, equipment, and space** needs:

- Both a start time and an end time are required.
- The end must be later than the start and must not already have passed.
- API timestamps must include timezone information.
- Organizer inputs and program date comparisons use **Asia/Dhaka** conventions.

The organizer's needs view provides **Set schedule** or **Edit schedule** actions. Existing needs without a valid schedule remain visible with an explanation, but contributors cannot apply until the organizer corrects them. The application does not invent dates for old records.

Publishing makes a valid program available for participation and sponsorship. Past programs are excluded from the public feed, and the backend rejects new applications after the program has ended. Passing the event date does not automatically change the stored project status to `complete`; completion remains a separate organizer action.

### 3. Joining, cancelling, and switching to a helper

**Participant:** A general user joins a live, eligible program. The backend checks capacity and creates an approved participant membership. Leaving the program releases the participant seat.

**Contributor:** A general user selects an available contribution need and applies as a trainer or contributor. The backend validates the need and its schedule, then creates a pending membership linked to an offered contribution.

A participant can **switch to a contributor application**. The backend validates the proposed contribution before completing the switch, so a failed application does not discard the existing participation. A successful switch releases the participant seat and creates the pending helper application.

There is one membership per person per program. The implemented behavior is switching roles, rather than simultaneously holding participant and contributor memberships.

### 4. Organizer approval and synchronized records

The organizer dashboard exposes a contributor approval list with application status, contribution details, loading feedback, error handling, and refresh controls.

| Organizer action | Membership result | Linked offer and resource result |
| --- | --- | --- |
| Approve | `approved` | Offer becomes `accepted`; the need is covered and an applicable booking is created. |
| Reject | `rejected` | Offer becomes `declined`; related booking and need state are updated where applicable. |

These changes happen together in a database transaction. A booking conflict or invalid schedule prevents a partial approval. Repeated decisions are handled without duplicating bookings or notifications.

Only the owning organizer can decide an application. Withdrawn or expired offers and ended programs cannot be newly approved. Acceptance also resolves competing offers for the same need and updates their linked contributor memberships.

Changing a need's schedule does not silently rewrite an applicant's submitted availability. Approval checks that the contribution still fits the current schedule.

### 5. Sponsorship and resource delivery

1. An organizer searches sponsor profiles or requests AI recommendations.
2. The organizer chooses a sponsor and sends a request for a program need.
3. The sponsor reviews the request and submits an offer, including applicable conditions or benefits.
4. The organizer accepts or declines the offer.
5. Accepted time or resource contributions create applicable bookings; delivery can be recorded through the receipt workflow.
6. Monetary offers use the payment flow, and reports summarize program support.

An organizer can request up to five distinct sponsors per project. Duplicate requests to the same sponsor for the same need are blocked. AI recommendations do not send requests automatically.

### 6. Payments

The backend supports a development mock provider and SSLCommerz integration. A payment quote separates the contribution amount, platform commission, and total payable amount.

With the default 5% commission, a contribution of BDT 1,000 produces a BDT 50 commission and a BDT 1,050 total payment. The contribution's net amount remains BDT 1,000.

Gateway confirmation is validated by the backend before money is treated as received. Duplicate or no-longer-applicable successful payments can be recorded for refund handling. Administrator payout and refund records should not be confused with an automatic bank transfer service.

## Architecture and technology

```mermaid
flowchart TD
    Browser[React frontend] -->|Sign in and access token| Auth[Supabase Auth]
    Browser -->|HTTPS API requests with Bearer token| API[FastAPI backend]
    API -->|Verify identity| Auth
    API -->|SQLAlchemy transactions| DB[(PostgreSQL)]
    API -->|Registration documents| Storage[Supabase Storage]
    API -->|Moderation and sponsor ranking| AI[Groq]
    API -->|Checkout and payment verification| Gateway[SSLCommerz or mock provider]
    API -->|Account review notices| Email[SMTP]
    Scheduler[External scheduler] -->|Authenticated expiry job| API
```

| Layer | Technologies and purpose |
| --- | --- |
| Frontend | React 19, TypeScript, Vite, React Router, Tailwind CSS, and Lucide icons. |
| Frontend data | TanStack Query for fetching, caching, invalidation, and background refresh; Supabase Auth client for sessions. |
| Backend | Python, FastAPI, Pydantic settings and validation, and Uvicorn. |
| Persistence | PostgreSQL, SQLAlchemy 2, psycopg 3, and Alembic migrations. |
| Identity and files | Supabase Auth and Supabase Storage. |
| AI | Groq API with structured responses; default model `openai/gpt-oss-20b`. |
| Payments and email | Mock/SSLCommerz payment services and SMTP notifications. |
| Quality checks | pytest, Ruff, frontend Node tests, Oxlint, TypeScript builds, and an optional Locust load test. |

The frontend uses lazy page loading and query caching to avoid unnecessary work. Relevant mutations invalidate cached data so lists and detail screens refresh after changes. Some features, including notifications and messages, use polling rather than WebSockets.

The backend uses batched loading, database indexes, connection pooling, and transaction management to reduce repeated queries and unnecessary database round trips. Network distance to PostgreSQL, authentication services, AI, and payment providers can still affect response time.

## Database design

The schema contains **19 application tables**, plus Alembic's migration-version table. Create and update the schema through migrations rather than manually creating tables.

| Area | Tables | Responsibility |
| --- | --- | --- |
| Accounts | `app_user`, `organizer_profile`, `sponsor_profile`, `registration_document` | Identity mapping, roles, account review, profiles, and document metadata. |
| Programs | `template`, `project`, `need` | Reusable program definitions, organizer programs, and requested resources. |
| Sponsorship | `sponsor_match`, `request`, `offer` | Sponsor recommendations, outreach, and proposed contributions. |
| Delivery and money | `booking`, `receipt`, `payment`, `benefit` | Resource availability, delivery confirmation, payment accounting, and promised benefits. |
| Participation | `event_membership` | Participant or contributor membership and approval status. |
| Communication | `comment`, `message_thread`, `message`, `notification` | Program discussions, private conversations, and account notifications. |

Projects belong to organizers and contain needs. Offers belong to needs and contributors or sponsors. A contributor membership links to its offer so organizer decisions can update both records together. Comments belong to projects and may reference a parent comment for replies. Messages belong to conversation threads.

Important database constraints include:

- One membership per user and project.
- One accepted or received offer per need.
- Unique sponsor requests for a need and sponsor.
- Booking constraints that prevent overlapping reservations for the same applicable user/resource.

The booking exclusion constraint requires PostgreSQL's `btree_gist` extension. The initial migration creates it; the migration account must have the necessary permission or the database administrator must provision it.

The principal status values are:

| Record | Status values |
| --- | --- |
| Project | `draft`, `live`, `complete` |
| Need | `open`, `covered` |
| Membership | `pending`, `approved`, `rejected` |
| Offer | `offered`, `accepted`, `received`, `declined`, `withdrawn`, `expired` |
| Comment/message moderation | `visible`, `hidden` |
| Payment | `pending`, `succeeded`, `failed`, `paid_out`, `refund_due`, `refunded` |

See [database models](backend/app/models) and [migration history](backend/alembic/versions) for the authoritative schema.

## AI moderation and sponsor matching

### Moderating comments and messages

New program comments, questions, replies, and organizer–sponsor messages are checked before appearing in normal conversation views.

The moderation service combines local detection rules with AI classification:

1. Normalize text and detect recognizable prohibited contact details and selected explicit abusive patterns.
2. Use AI to assess additional harmful content and private details, including home addresses and disguised contact information.
3. Save the content with a `visible` or `hidden` status.
4. Return a moderation receipt and show appropriate feedback in the interface.

The policy covers harmful content and sharing phone numbers, email addresses, and home addresses. The service is designed to handle English, Bengali, and Banglish input, including some obfuscated forms.

**Hidden content is visible only to administrators.** Its author, organizer, sponsor, and other general users cannot read it through normal comment or message lists. Hidden content is also excluded from ordinary previews and related visible-content counts. The author receives a notice that the submission was saved for review rather than receiving its hidden body back.

If AI is unavailable, times out, or returns an invalid response, the submission is held hidden for administrator review. This prevents unchecked text from briefly appearing publicly. Administrators can restore or delete hidden content; restoration is a deliberate human override.

Moderation hides content rather than automatically deleting its database record. Existing records are not automatically rescanned when rules change. AI classification is probabilistic and cannot guarantee detection of every harmful or private detail.

### Matching organizers with sponsors

The organizer explicitly selects **Find sponsors with AI** to generate recommendations for a project.

- The backend first builds an eligible shortlist of up to 20 active sponsor candidates.
- AI evaluates program relevance, resource fit, location, and relevant experience.
- Validated results contain a score from 0–100 and an explanation; up to 10 suggestions are selected.
- Results are stored so the organizer can review them without repeating the AI call.
- Existing rule-based suggestions and AI suggestions are identified by their source.

Matching uses selected public program/profile fields and opaque candidate identifiers. Structured account identifiers, contact-person fields, phone numbers, email addresses, and licence details are not part of the intended matching payload. Moderation text that is not handled locally is sent to the configured external AI service for classification.

An AI failure returns an error and preserves previously saved matches. It does not fabricate replacement AI scores. Recommendations help an organizer decide whom to approach; they do not guarantee sponsorship, availability, or funding.

Implementation: [moderation service](backend/app/services/moderation.py) and [matching service](backend/app/services/matching.py).

## Project structure

```text
MissingPiece/
├── backend/
│   ├── app/
│   │   ├── main.py             # FastAPI application and router setup
│   │   ├── config.py           # Environment-based settings
│   │   ├── auth.py             # Token verification and authorization
│   │   ├── db.py               # Database engine and session handling
│   │   ├── models/             # SQLAlchemy tables and enums
│   │   ├── schemas/            # Request and response contracts
│   │   ├── routers/            # HTTP endpoints by feature/role
│   │   ├── services/           # Business rules and integrations
│   │   ├── seed.py             # Optional development data
│   │   └── make_admin.py       # Assign an existing account as admin
│   ├── alembic/versions/       # Database migrations
│   ├── tests/                 # Backend tests
│   ├── .env.example
│   └── pyproject.toml
├── frontend/
│   ├── src/
│   │   ├── api/               # API clients, types, and demo adapters
│   │   ├── auth/              # Session and route access handling
│   │   ├── components/        # Reusable interface components
│   │   ├── pages/             # Public, user, organizer, sponsor, admin
│   │   ├── lib/               # Dates, schedules, cache, formatting
│   │   └── theme/             # Shared visual settings
│   ├── tests/                 # Date and scheduling tests
│   ├── public/
│   └── package.json
├── loadtest/locustfile.py      # Optional read-oriented API load test
├── .github/workflows/         # Automated checks and fork synchronization
├── LICENSE
└── README.md
```

## Local installation

### Prerequisites

- Python **3.12–3.14** and Poetry.
- Node.js **22.12 or newer** and npm; CI currently uses Node 24.
- PostgreSQL with permission to create the `btree_gist` extension.
- A Supabase project for real authentication and document storage.
- A Groq API key for live AI moderation and matching.
- Optional SMTP and SSLCommerz credentials for those integrations.

The commands below use PowerShell and start from the repository root. Keep an existing configuration file rather than overwriting it.

### 1. Configure the backend

```powershell
cd backend
poetry install
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
```

Edit `backend/.env` with your own values. A representative local configuration is:

```dotenv
DATABASE_URL=postgresql://YOUR_USER:YOUR_PASSWORD@localhost:5432/missingpiece
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_JWT_SECRET=
SUPABASE_JWKS_URL=
SUPABASE_SERVICE_ROLE_KEY=YOUR_BACKEND_ONLY_SERVICE_KEY
STORAGE_BUCKET=registration-documents

DEV_AUTH=false
GROQ_API_KEY=YOUR_GROQ_KEY
GROQ_MODEL=openai/gpt-oss-20b
GROQ_MODERATION_TIMEOUT_SECONDS=6

CORS_ORIGINS=http://localhost:5173
FRONTEND_URL=http://localhost:5173
API_PUBLIC_URL=http://localhost:8000
JOBS_SECRET=REPLACE_WITH_A_RANDOM_SECRET_AT_LEAST_32_CHARACTERS
PAYMENT_PROVIDER=mock
PAYMENT_WEBHOOK_SECRET=REPLACE_WITH_ANOTHER_RANDOM_SECRET_AT_LEAST_32_CHARACTERS
SHOW_API_DOCS=true
```

Use independent random secrets, for example by running `poetry run python -c "import secrets; print(secrets.token_urlsafe(48))"` from `backend/`. URL-encode special characters in database credentials when constructing a connection URL.

For modern Supabase signing keys, `SUPABASE_URL` enables JWKS discovery; `SUPABASE_JWKS_URL` is an optional override. For a legacy HS256 project, configure its JWT secret instead. Create the configured private storage bucket for registration documents and use the same Supabase project in both applications.

Configure Supabase email confirmation and password-reset redirect URLs to match the frontend, including its `/reset-password` route. Backend SMTP settings control application emails separately from Supabase authentication emails.

### 2. Apply migrations and start the API

Run from `backend/` so the application reads the intended `.env` file:

```powershell
poetry run alembic upgrade head
poetry run uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

- Health: `http://localhost:8000/api/health`
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`
- OpenAPI schema: `http://localhost:8000/openapi.json`

The documentation endpoints are available when `SHOW_API_DOCS=true`. The health endpoint is a liveness check, not a complete database or external-service diagnostic.

### 3. Configure and start the frontend

In a second terminal, from the repository root:

```powershell
cd frontend
npm ci
```

Create `frontend/.env.local`:

```dotenv
VITE_API_URL=http://localhost:8000/api
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY
VITE_USE_MOCKS=false
VITE_SKIP_AUTH=false
```

```powershell
npm run dev
```

Open the URL printed by Vite, normally `http://localhost:5173`. If it selects another port, update the backend's allowed origin. Restart the relevant development server after changing environment variables.

Only a Supabase **publishable/anon** key belongs in frontend configuration. A service-role/secret key, database password, Groq key, or payment credential must never be placed in a `VITE_` variable: frontend values are included in browser assets.

### 4. Create accounts and optional development data

Register accounts through the application. To assign administrator access to an existing general-user account dedicated to administration, run from `backend/`:

```powershell
poetry run python -m app.make_admin you@example.com
```

For an empty development database, the optional seed command is:

```powershell
poetry run python -m app.seed
```

The seed helper refuses to populate an already populated database by default. Its `--supabase` option also provisions demo authentication accounts and requires the backend service key. Its `--reset` option deletes existing application data; it is not part of normal installation. Review [the seed helper](backend/app/seed.py) before using these options.

Development token generation is available through `poetry run python -m app.dev_token EMAIL` when development authentication is deliberately configured. Normal real-user operation should use Supabase login with `DEV_AUTH=false`.

### Browser demo mode

Set `VITE_USE_MOCKS=true` to use browser demo data. Setting `VITE_SKIP_AUTH=true` also enables demo mode and exposes the demo role-switching experience.

**Missing Supabase frontend configuration automatically enables mocks**, even if `VITE_USE_MOCKS=false`. For real database testing, supply both Supabase values and set both flags to `false`.

Demo records are browser data. They do not prove that PostgreSQL persistence, AI calls, real authentication, or payment integration is working.

## Configuration reference

See [backend settings](backend/app/config.py) and [frontend environment handling](frontend/src/lib/env.ts) for the full behavior.

| Variable/group | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL application database connection. Plain `postgresql://` URLs are accepted. |
| `SUPABASE_URL`, `SUPABASE_JWT_SECRET`, `SUPABASE_JWKS_URL` | Backend identity verification settings. |
| `SUPABASE_JWT_AUDIENCE` | Expected token audience; defaults to `authenticated`. |
| `SUPABASE_SERVICE_ROLE_KEY`, `STORAGE_BUCKET` | Backend-only document storage and provisioning access. |
| `DEV_AUTH`, `DEV_JWT_SECRET` | Local development-token support; disable development authentication in production. |
| `GROQ_API_KEY`, `GROQ_MODEL` | AI credentials and model selection. |
| `GROQ_MODERATION_TIMEOUT_SECONDS` | Moderation request time limit; defaults to 6 seconds. |
| `CORS_ORIGINS` | Comma-separated allowed frontend origins. |
| `FRONTEND_URL`, `API_PUBLIC_URL` | Frontend redirects and externally reachable API/payment callback origin. |
| `JOBS_SECRET` | Shared secret protecting the offer-expiry job. |
| `SHOW_API_DOCS` | Enables/disables Swagger, ReDoc, and OpenAPI endpoints. |
| `PAYMENT_PROVIDER`, `PAYMENT_WEBHOOK_SECRET` | Payment provider selection and mock webhook protection. |
| `PLATFORM_COMMISSION_RATE` | Commission fraction; defaults to `0.05`. |
| `SSLCOMMERZ_STORE_ID`, `SSLCOMMERZ_STORE_PASSWORD`, `SSLCOMMERZ_SANDBOX` | Gateway settings; sandbox defaults to enabled. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` | Application email transport; disabled until host/user/password are provided. |
| `SMTP_FROM`, `SMTP_FROM_NAME` | Application email sender identity. |
| `VITE_API_URL` | Browser API base URL, including `/api`. |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | Browser authentication project and public key. |
| `VITE_USE_MOCKS`, `VITE_SKIP_AUTH` | Browser demo and authentication-bypass modes. |

`TEST_DATABASE_URL` exists in settings, but the current test fixture connects through `DATABASE_URL`. Setting `TEST_DATABASE_URL` alone does **not** redirect the test suite; see the testing instructions below.

## API overview

All paths below are relative to `/api`. This is a guide to the main workflows; generated OpenAPI documentation contains the complete request and response contracts.

| Area | Representative endpoints |
| --- | --- |
| Identity | `GET /auth/me`, `POST /auth/register/user`, `POST /auth/register/organizer`, `POST /auth/register/sponsor` |
| Discovery | `GET /feed`, `GET /events`, `GET /events/{project_id}` |
| Participation | `POST /events/{project_id}/join`, `POST /events/{project_id}/leave`, `GET /me/memberships` |
| General profile | `GET /me/profile`, `PATCH /me/profile` |
| Discussions | `GET /events/{project_id}/comments`, `POST /events/{project_id}/comments` |
| Programs | `GET /templates`, `POST /projects`, `GET /projects/mine`, `GET /projects/{id}`, `PATCH /projects/{id}` |
| Program lifecycle | `POST /projects/{id}/publish`, `POST /projects/{id}/complete` |
| Needs | `POST /projects/{id}/needs`, `PATCH /needs/{id}`, `DELETE /needs/{id}` |
| Contributor review | `GET /projects/{id}/memberships`, `POST /memberships/{id}/approve`, `POST /memberships/{id}/reject` |
| Organizer overview | `GET /projects/{id}/gaps`, `GET /projects/{id}/readiness`, `GET /projects/{id}/report` |
| Sponsor matching | `GET /projects/{id}/sponsor-matches`, `POST /projects/{id}/sponsor-matches` |
| Sponsorship requests | `GET /sponsor/requests`, `POST /projects/{id}/requests`, `POST /requests/{id}/offers` |
| Offers | `GET /sponsor/offers`, `POST /offers/{id}/accept`, `POST /offers/{id}/decline`, `POST /offers/{id}/withdraw`, `POST /offers/{id}/receive` |
| Payments | `GET /offers/{id}/payment-quote`, `POST /offers/{id}/payments` |
| Messaging | `GET /threads`, `GET /threads/{id}/messages`, `POST /threads/{id}/messages` |
| Notifications | `GET /notifications`, `POST /notifications/{id}/read`, `POST /notifications/read-all` |
| Moderation | `GET /admin/comments`, `GET /admin/messages`, and administrator restore/delete actions |
| Operations | `POST /internal/jobs/expire-offers`, `GET /health` |

Most account-specific endpoints require `Authorization: Bearer <access-token>`. The feed is public; event-detail access requires an active authenticated account. Additional role and ownership rules are enforced on the server. The expiry job uses its own `JOBS_SECRET` header.

## Testing and verification

### Backend checks with PostgreSQL

Backend integration tests use PostgreSQL rather than an in-memory replacement. The test fixture wraps changes in an outer transaction with savepoints and rolls back after each test. It also disables application SMTP, uses development test tokens, and substitutes deterministic moderation responses for the standard API client fixture.

Use a dedicated test database. In a separate PowerShell terminal, from `backend/`:

```powershell
$env:DATABASE_URL = "postgresql://YOUR_USER:YOUR_PASSWORD@localhost:5432/missingpiece_test"
$env:PAYMENT_PROVIDER = "mock"
poetry run alembic upgrade head
poetry run pytest -q
poetry run ruff check .
```

The shell override selects the database used by the current tests; `TEST_DATABASE_URL` alone does not. Close that terminal after testing or remove its overrides before starting your normal application.

Coverage includes authorization and ownership, participation and capacity, contributor approval synchronization, scheduling and booking conflicts, comment/message visibility, AI response validation, payment behavior, and query-related regression checks. These automated tests do not by themselves validate live Supabase login, Groq service availability, or a real gateway transaction.

### Frontend checks

From `frontend/`:

```powershell
npm test
npm run lint
npm run build
```

Frontend tests cover program-date and need-schedule utilities. The production build also performs TypeScript checks. `npm run preview` serves the built frontend locally for inspection; it is not the production hosting setup.

### Real-service acceptance checklist

Use designated test accounts and a test program when verifying the integrated application:

1. Confirm browser mocks and authentication bypass are disabled; log in through Supabase.
2. Create a future program with capacity and a valid scheduled contributor need, then publish it.
3. Join as a participant and verify the membership and count persist after refresh. Leave and verify the seat is released.
4. Join again and switch to a helper application. Verify the participant seat is released and both pending membership and offered contribution are stored.
5. Approve the application as the owning organizer. Verify membership, offer, need, and booking state agree. Use another application to verify rejection and withdrawal paths.
6. Check that a missing/invalid need schedule prevents applying and clearly directs the organizer to set it.
7. Post an ordinary comment, then test prohibited content with synthetic details. Verify hidden content is absent for the author, organizer, sponsor, and other users but present for an admin.
8. Update profile fields and verify persistence after reload and a new login.
9. Run sponsor matching with live AI enabled, inspect saved explanations, and confirm requests are sent only by an explicit organizer action.
10. Check past-program behavior and, if payments are enabled, complete a sandbox checkout and verify the recorded result.

This checklist describes how to verify a deployment; it is not a claim that every external service has been tested in every environment.

### Optional load testing

[The Locust scenario](loadtest/locustfile.py) performs read-oriented API traffic for visitors and configured test accounts. Install Locust in a separate test environment and run from the repository root:

```powershell
locust -f loadtest/locustfile.py --host http://localhost:8000
```

Open `http://localhost:8089`. The script documents `LOCUST_SUPABASE_URL`, `LOCUST_SUPABASE_ANON_KEY`, and the role-specific test-account environment variables. Without authentication configuration, it runs visitor traffic only. Measure against a controlled environment using an intentional load level; there is no universal latency or throughput guarantee.

## Deployment and maintenance

### Build and runtime configuration

- Build the frontend with the deployment's `VITE_` values. Serve `frontend/dist` through static hosting with SPA fallback to `index.html`.
- Run FastAPI under a managed ASGI process behind HTTPS. Do not use the development `--reload` flag in production.
- Set real backend environment values, exact frontend CORS origins, and public payment callback/redirect addresses.
- Set `DEV_AUTH=false`, `VITE_USE_MOCKS=false`, and `VITE_SKIP_AUTH=false`; provide complete Supabase configuration.
- Apply `alembic upgrade head` as part of a controlled release, with appropriate database backups.
- Configure SMTP, storage access, AI credentials, and the selected payment provider for the target environment.
- Set `SHOW_API_DOCS=false` if public API documentation should be disabled.

### Offer expiry

Configure an external scheduler to call `POST /api/internal/jobs/expire-offers` with the configured secret in the **`JOBS_SECRET` header**. Merely starting FastAPI does not schedule the job.

The job expires overdue offers and updates associated availability and contributor state. It does not automatically mark old programs complete. Program date checks independently prevent joining an ended event.

### Continuous integration

[The GitHub Actions workflow](.github/workflows/sync-to-fork.yml) runs backend linting, migrations, and tests against a PostgreSQL service, plus frontend linting, tests, and a production build.

For eligible runs on `main`, a dependent synchronization job pushes the tested revision to a configured fork. It requires the `FORK_REPO` repository variable and `FORK_DEPLOY_KEY` secret. This is a normal, non-forced push. Hosting and deployment behavior downstream of that fork must be configured separately.

## Troubleshooting

| Symptom | What to check |
| --- | --- |
| Changes do not appear in PostgreSQL | Check the frontend Supabase values and both demo flags. Missing auth configuration automatically enables mocks. |
| Backend cannot find its settings | Start it from `backend/`, where its `.env` is read, or supply environment variables through the host. |
| `WinError 10013` when starting Uvicorn | The selected port may be restricted or reserved by Windows. Try an available port such as 8001 and update `VITE_API_URL` to match. |
| Browser reports CORS/network errors | Confirm backend reachability, the `/api` suffix, frontend origin/port, and backend `CORS_ORIGINS`. |
| Login works but an area is inaccessible | Check the application's account role, verification state, and suspension status, not only the Supabase identity. |
| Contributor cannot apply | Check that the need is open, the program is eligible, and its start/end schedule is valid. Existing unscheduled needs need organizer attention. |
| Application remains pending | Open the owning organizer's contributor approval list and inspect its loading/error state and decision controls. |
| A comment disappears after posting | It may be held for moderation. Only admins can read hidden text; missing or failing AI configuration also holds new content for review. |
| AI matching returns an error | Check Groq credentials, model access, and service availability. Existing saved matches remain available after a failed generation. |
| Database tables or columns are missing | Confirm the intended database and run Alembic migrations. Check extension permissions if the initial migration fails. |
| Old programs still have `live` status | The event date blocks new applications, but stored completion is a separate organizer action. |
| Syntax error at `<<<<<<<` | Unresolved Git conflict markers are in source code. Resolve the conflict before restarting the application. |

## Current design boundaries

- A user has one membership per program; switching to helper replaces participant participation.
- Participant capacity and contributor resource needs are separate controls. A full participant audience does not automatically mean helper needs are filled.
- A need accepts one winning offer. A quantity field does not create multiple independently approvable helper slots; model separately assignable work as separate needs.
- Existing unscheduled needs require organizer correction, and previously saved comments/messages are not automatically rescanned by new moderation rules.
- Notifications and conversations refresh through polling rather than a real-time socket connection.
- AI provides recommendations and moderation decisions with administrator oversight; it is not a guarantee of funding or perfect content detection.
- Demo mode, mock payments, and development authentication are development features and must be distinguished from real-service verification.

## License

This project is licensed under the [Apache License 2.0](LICENSE).
