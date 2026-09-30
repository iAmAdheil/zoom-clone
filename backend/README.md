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
| `JWT_SECRET` | Signs the session cookie, the WebSocket tickets, and the rejoin tokens. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google OAuth. If empty, the Google routes return 503 `google_not_configured`. |
| `FRONTEND_ORIGIN` | CORS origin, invite link base, and Google callback base. |
| `ENABLE_DEMO_LOGIN` | `true` enables `POST /api/auth/demo`. |

Optional tuning. The defaults suit one small server.

| Name | Default | Purpose |
|---|---|---|
| `DB_BUSY_TIMEOUT_MS` | `5000` | How long SQLite waits for a write lock. After that the API gives 503 `server_busy`. |
| `WS_DB_THREADS` | `20` | Worker threads for WebSocket database work. REST requests use a separate pool. |
| `PRESENCE_GRACE_SECONDS` | `60` | Time after a REST join in which the socket must open. After it, the reaper closes the row. |
| `REAPER_INTERVAL_SECONDS` | `15` | How often the reaper runs. `0` turns it off. |
| `IDLE_MEETING_MINUTES` | `10` | The reaper ends a live meeting with nobody connected for this long. |
| `MAX_MEETING_HOURS` | `24` | The reaper ends a live meeting that is older than this. |
| `MAX_SOCKETS_PER_PARTICIPANT` | `3` | A new socket above this closes the oldest one (4403 `too_many_connections`). |
| `MAX_BODY_BYTES` | `65536` | A larger request body gets 413. |
| `RATE_LIMIT_ENABLED` | `true` | Turns the rate limits on or off. |
| `RATE_LIMIT_DEMO_PER_MINUTE` | `30` | Demo logins per minute per IP. |
| `RATE_LIMIT_JOIN_PER_MINUTE` | `60` | Joins per minute per IP. |
| `RATE_LIMIT_PASSCODE_FAILURES` | `10` | Wrong passcodes per IP and meeting in the window below. |
| `RATE_LIMIT_PASSCODE_WINDOW_SECONDS` | `300` | The window for wrong passcodes. |
| `CHAT_RATE_LIMIT_MESSAGES` | `10` | Chat messages per participant in the window below. |
| `CHAT_RATE_LIMIT_WINDOW_SECONDS` | `10` | The window for chat messages. |
| `TRUST_FORWARDED_FOR` | `true` | Take the client IP from the first `X-Forwarded-For` entry (Render sets it). |

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
- `app/routers/ws.py`: the meeting WebSocket, `/ws/meetings/{code}?ticket=...`.
- `app/services/room_manager.py`: open sockets per meeting. Services call `room_manager.broadcast` from sync or async code.
- `app/services/room_service.py`: WebSocket rules (ticket check, snapshot, client events, leave).
- `app/services/ticket_registry.py`: makes each WebSocket ticket single use (in memory).
- `app/services/presence.py`: pending REST joins that have no socket yet (in memory).
- `app/services/reaper.py`: the background task. It closes ghost participants and ends forgotten meetings.
- `app/services/rate_limit.py`: sliding-window rate limits (in memory).
- `app/core/body_limit.py`: refuses a request body above `MAX_BODY_BYTES` with 413.
- `app/models/`, `app/schemas/`: database tables and API shapes.
- `alembic/`: migrations. Create a new one with `uv run alembic revision --autogenerate -m "message"`.

## Rules worth knowing

- Join checks run in this order: meeting ended (410), access (403 `guests_not_allowed`), removed user (403), passcode (403 `bad_passcode`).
- The host does not need the passcode. The host joining starts the meeting.
- Mute-all mutes attendees only. Host and co-hosts stay unmuted.
- `GET /participants` accepts the session cookie or a `?ticket=` query parameter.
- A REST join does not put anyone in the room. The first open socket does (`participant_joined`).
- SQLite runs without a connection pool (`NullPool`), in WAL mode, with `busy_timeout`. A pool
  smaller than the thread pool froze the server under a burst (BUG-02, see `app/core/db.py`).
