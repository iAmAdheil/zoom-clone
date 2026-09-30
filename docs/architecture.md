# Architecture (decided by the lead)

## Stack
- Frontend: Next.js (App Router, TypeScript, Tailwind). Deployed on Vercel.
- Backend: FastAPI, SQLAlchemy 2.0, Alembic, Pydantic v2, SQLite. Deployed on Render or Railway.
- Monorepo: `frontend/`, `backend/`, `docs/`.

## Same-origin proxy
The browser only calls `/api/*` on the frontend origin. Next.js `rewrites` forward `/api/*` to `BACKEND_URL`.
- The session cookie is first-party. No third-party cookie problem.
- WebSockets: the browser connects directly to `NEXT_PUBLIC_WS_URL` (Vercel cannot proxy WebSockets). The WebSocket takes a short-lived `ticket` query parameter (see `api.md`), not a cookie.

## Auth
- Google OAuth 2.0 (authorization code flow), run by FastAPI with `authlib`. Scopes: `openid email profile`.
- Callback URL: `<frontend origin>/api/auth/google/callback` (proxied to FastAPI).
- FastAPI issues its own JWT in an httpOnly, SameSite=Lax cookie named `session`.
- A seeded demo user and a `POST /api/auth/demo` endpoint let evaluators use the app without Google. The demo endpoint is enabled by env var `ENABLE_DEMO_LOGIN=true`.
- Guests have no account. A guest joins with a display name only (if the meeting allows guests).

## Meeting access setting
`meetings.access` is one of:
- `verified_only`: only signed-in users can join.
- `allow_guests`: signed-in users and guests can join.
Default: `allow_guests`.

## Schema
All times are UTC ISO-8601 in the API. The UI shows the user's local time.

`users`
- id (int PK), google_sub (unique, nullable), email (unique), name, avatar_url (nullable), is_demo (bool), created_at

`meetings`
- id (int PK), meeting_code (10 digits, unique, indexed), host_id (FK users.id), title, description (nullable)
- type (`instant` | `scheduled`), status (`scheduled` | `live` | `ended`, indexed)
- access (`verified_only` | `allow_guests`), passcode (nullable)
- scheduled_start (nullable, UTC), duration_min (nullable), timezone (IANA string, for display)
- started_at (nullable), ended_at (nullable), created_at
- Index: (host_id, scheduled_start)

`participants`
- id (int PK), meeting_id (FK meetings.id, indexed), user_id (nullable FK users.id, indexed), display_name
- role (`host` | `co_host` | `attendee`), joined_at, left_at (nullable)
- is_muted (bool), is_video_off (bool), removed (bool)

Rules:
- Recent meetings for a user = meetings where the user is host or has a participant row, ordered by `started_at` or `scheduled_start` descending, limited by a query parameter.
- Upcoming meetings = the user hosts them, `status = scheduled`, and `scheduled_start + duration_min` (15 minutes if null) has not passed, ordered ascending. A scheduled meeting that nobody started and whose end passed shows in Recent, with `status` unchanged.
- Meeting codes are random 10-digit numbers. The service retries on a collision.

## Realtime room (FastAPI WebSocket)
- One channel per meeting. It carries participant state only: join, leave, mute, video toggle, remove, end.
- No media goes through it. Media is local camera and microphone preview (`getUserMedia`).
- The channel relays WebRTC signaling messages (`signal`) between two participants. The server never reads their `data` (see `api.md`).
- Presence: a participant is in the room only while a socket is open. A REST join alone does not count. The room gets `participant_joined` when the first socket opens.
- A background reaper (an asyncio task started in the app lifespan, every 15 s) closes participant rows that never opened a socket (after 60 s), and ends live meetings that are idle for 10 minutes or live for 24 hours.
- The room manager, the ticket registry, the pending joins and the rate-limit counters are in memory. This works for one server process only.

## Load and SQLite
- SQLite runs without a connection pool (`NullPool`), in WAL mode, with `busy_timeout`. Each session opens its own connection. A pool smaller than the thread pool froze the server under a burst (BUG-02).
- WebSocket database work uses its own thread limit, so a REST burst does not stop the rooms.
- A lock or connection timeout gives 503 `server_busy` with `Retry-After`, not 500.
- `/api/health` is async and does not touch the database.

## Backend layout
```
backend/app/
  main.py            app factory, routers, CORS
  core/              config, security (JWT), db session
  models/            SQLAlchemy models
  schemas/           Pydantic schemas
  routers/           auth.py, meetings.py, participants.py, ws.py
  services/          meeting_service.py, participant_service.py, room_manager.py,
                     room_service.py, presence.py, reaper.py, rate_limit.py
  seed.py            seed script
backend/tests/
```
Routers stay thin. Business rules live in `services/`.

## Frontend layout
```
frontend/src/
  app/               routes (see api.md pages list)
  components/        ui/ (primitives), dashboard/, meeting/, layout/
  lib/               api client, hooks, types
  styles/            design tokens
```

## Environment variables
Backend: `ENVIRONMENT` (`development` by default. The server does not start in `production` with the default `JWT_SECRET`.), `DATABASE_URL`, `JWT_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `FRONTEND_ORIGIN`, `ENABLE_DEMO_LOGIN`. Optional tuning (rate limits, body size, socket cap, reaper times): see `backend/README.md`.
Frontend: `BACKEND_URL`, `NEXT_PUBLIC_WS_URL`.
Never commit real values. Commit `.env.example` files.
