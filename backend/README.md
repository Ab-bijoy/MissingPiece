# MissingPiece API (backend)

## Community API

The community routes use the existing `app_user`, `project`, `need`, `offer`,
`event_membership`, `comment`, `booking`, and `notification` tables. Migration
`c031_community` adds query indexes; it does not reset or replace existing data.

- `GET /api/feed` and `GET /api/events/{id}/comments` allow anonymous reads.
  A bearer token adds personal membership or authorized hidden-comment visibility.
  Both support bounded `limit` and `offset` parameters.
- General accounts use `POST /api/events/{id}/join`, `GET /api/me/memberships`,
  and `GET/PATCH /api/me/profile`. Participants join immediately, subject to capacity;
  contributors create a pending membership and offer. A contribution includes
  `need_id`, `contribution_role`, and optionally timezone-aware `slot_start`/`slot_end`.
  Omitted slots inherit the selected need's slot. Trainers require a skill need.
- `POST /api/events/{id}/leave` cancels the caller's participant attendance and frees
  their seat. It is idempotent when they have no membership; contributors must withdraw
  their offer instead. Cancellation removes the attendance row from My contributions.
- A contributor join request with `switch_from_participant: true` explicitly switches
  an existing participant to a pending helper. All validation happens first; a failed
  application keeps their seat. Success releases the seat and creates the offer in one
  transaction. Approval remains the organizer module's responsibility. No schema change
  is needed: the existing membership row changes role and status.
- Joining, switching and cancellation require a live program dated today or later in
  `Asia/Dhaka`. The public feed excludes earlier dates. Ended details and contribution
  history remain available; elapsed dates do not automatically mark projects complete.
- Event details include `my_membership`, `my_offer_id`, `seats_left`, and `comment_count`.
- Authenticated active accounts can post comments, questions, and replies. Replies
  must reference an accessible comment on the same event. Hidden comments are visible
  only to their author, the event organizer, and admins.
- Withdrawal and expiry remove bookings and deactivate linked contributor memberships.
  Withdrawn, rejected, or expired contributor offers may be replaced by a new application.
  The existing one-accepted-offer-per-need database rule remains in force.
- `POST /api/internal/jobs/expire-offers` requires the literal `JOBS_SECRET` HTTP
  header matching the backend environment value. Empty/example secrets are refused.
  Offered/accepted offers expire after the event date or need deadline; request
  decision deadlines apply to offered offers and delivery deadlines to accepted offers.
  Dates use Asia/Dhaka; the deadline date itself remains valid. Received offers are
  preserved. Repeated calls do not duplicate expiry notifications.
- `GET /api/health` is the existing lightweight liveness check.

For real frontend requests, set `VITE_API_URL`, `VITE_SUPABASE_URL`, and
`VITE_SUPABASE_ANON_KEY` in `frontend/.env`, with `VITE_USE_MOCKS=false` and
`VITE_SKIP_AUTH=false`. Use a publishable/anon key, never the backend service-role key.
Restart Vite after changing these values. Supabase Auth and the backend must use
the same Supabase project.

FastAPI + PostgreSQL + SQLAlchemy 2 + Alembic, managed with Poetry. Run every command from this `backend/` folder.

## Set up

1. Copy `.env.example` to `.env` and fill in `DATABASE_URL` (and the Supabase values when ready).
2. Install and build the database:

```
poetry install
poetry run alembic upgrade head
poetry run python -m app.seed
```

## Everyday commands

| Task | Command |
|---|---|
| Run the server (http://localhost:8000/docs) | `poetry run uvicorn app.main:app --reload` |
| Run the tests | `poetry run pytest` |
| Check code style | `poetry run ruff check .` |
| New migration after changing models | `poetry run alembic revision --autogenerate -m "what changed"` (read it, then `upgrade head`) |
| Reload demo data (deletes every row first) | `poetry run python -m app.seed --reset` |
| Demo data with Supabase log-ins | `poetry run python -m app.seed --reset --supabase` |
| A test token for an account | `poetry run python -m app.dev_token csr@examplesoftware.example` |
| Make an existing account an admin | `poetry run python -m app.make_admin you@example.com` |

**Tests run on the real database** inside a transaction that is rolled back, so they leave no data behind.
There is no separate test database.

**Dev tokens** work only with `DEV_AUTH=true`. Paste one into the **Authorize** button on `/docs`
to try endpoints as that account. Turn `DEV_AUTH` off in production.

**Payments** use the mock gateway (`PAYMENT_PROVIDER=mock`): paying opens
`/api/payments/mock-checkout/{id}`, where you choose success or failure, then return to the app.

## Built so far

- Base: settings, database connection, `{ detail, code }` errors, the Supabase token check, all 19 tables.
- Auth (7.1): `/auth/me` and the three register endpoints (proof documents go to Supabase Storage, bucket
  `registration-documents`, private).
- Sponsor (7.4): inbox, request detail, make offer, my offers, withdraw, payment quote and checkout,
  impact report, company profile; events (view only); payment webhook.
- Admin (7.2): registration approvals, accounts, templates, payments and payouts, hidden comments, file links.
- Shared (7.6): message threads, notifications.

## Security notes

- Every query uses bound parameters (SQLAlchemy), so user input never becomes SQL.
- Example secrets from `.env.example` are refused: dev tokens and webhooks signed with them are rejected.
  Use long random values (`python -c "import secrets; print(secrets.token_urlsafe(48))"`).
- Token checks allow 60 seconds of clock difference with Supabase and log why a token was refused.
- Turn `DEV_AUTH` off anywhere real people use the app.

## Not in the build prompt yet

- `notification.text`: the short line the bell shows.
- `template.blurb`: one line for the template card.
- `GET /api/payments/mock-checkout/{id}`: the mock gateway page (only when `PAYMENT_PROVIDER=mock`).
