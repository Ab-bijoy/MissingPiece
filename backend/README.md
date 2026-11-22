# MissingPiece API (backend)

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
