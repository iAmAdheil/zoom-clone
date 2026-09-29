# Backend

FastAPI, SQLAlchemy 2.0, Alembic, SQLite. The API contract is in `docs/api.md`.

## Setup

You need [uv](https://docs.astral.sh/uv/). Run all commands in `backend/`.

1. Install the packages: `uv sync`
2. Create the env file: `cp .env.example .env`
3. Create the tables: `uv run alembic upgrade head`
4. Add demo data (optional): `uv run python -m app.seed`
5. Start the server: `uv run fastapi dev`

The API runs on http://localhost:8000. The interactive docs are at `/docs`.

## Environment variables

| Name | Purpose |
|---|---|
| `DATABASE_URL` | SQLAlchemy URL. Default is a local SQLite file. |
| `JWT_SECRET` | Signs the session cookie and the WebSocket tickets. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google OAuth. If empty, the Google routes return 503 `google_not_configured`. |
| `FRONTEND_ORIGIN` | CORS origin, invite link base, and Google callback base. |
| `ENABLE_DEMO_LOGIN` | `true` enables `POST /api/auth/demo`. |

## Google sign-in

1. Create an OAuth client (type "Web application") in Google Cloud Console.
2. Add this redirect URI: `<FRONTEND_ORIGIN>/api/auth/google/callback`.
3. Put the client ID and secret in `.env`.

## Demo data

`app.seed` creates the demo user `demo@zoomclone.test`, 3 other users, 4 upcoming meetings
hosted by the demo user, and 8 ended meetings with participants.
Run it again with `--reset` to delete all rows and seed again.

## Tests and lint

```
uv run pytest
uv run ruff check .
uv run ruff format --check .
```

The tests use an in-memory SQLite database. They do not need a `.env` file.

## Layout

- `app/routers/`: thin HTTP handlers.
- `app/services/`: business rules (join rules, meeting rules, participant controls).
- `app/services/room_manager.py`: hook for the WebSocket task. Services call `room_manager.broadcast`. It does nothing yet.
- `app/models/`, `app/schemas/`: database tables and API shapes.
- `alembic/`: migrations. Create a new one with `uv run alembic revision --autogenerate -m "message"`.

## Rules worth knowing

- Join checks run in this order: meeting ended (410), access (403 `guests_not_allowed`), removed user (403), passcode (403 `bad_passcode`).
- The host does not need the passcode. The host joining starts the meeting.
- Mute-all mutes attendees only. Host and co-hosts stay unmuted.
- `GET /participants` accepts the session cookie or a `?ticket=` query parameter.
