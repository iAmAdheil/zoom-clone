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
- type (`instant` | `scheduled`), status (`scheduled` | `live` | `ended`)
- access (`verified_only` | `allow_guests`), passcode (nullable)
- scheduled_start (nullable, UTC), duration_min (nullable), timezone (IANA string, for display)
- started_at (nullable), ended_at (nullable), created_at
- Index: (host_id, scheduled_start)

`participants`
- id (int PK), meeting_id (FK meetings.id, indexed), user_id (nullable FK users.id), display_name
- role (`host` | `co_host` | `attendee`), joined_at, left_at (nullable)
- is_muted (bool), is_video_off (bool), removed (bool)

Rules:
- Recent meetings for a user = meetings where the user is host or has a participant row, ordered by `started_at` or `scheduled_start` descending, limited by a query parameter.
- Upcoming meetings = `status = scheduled` and `scheduled_start >= now`, ordered ascending.
- Meeting codes are random 10-digit numbers. The service retries on a collision.

## Realtime room (FastAPI WebSocket)
- One channel per meeting. It carries participant state only: join, leave, mute, video toggle, remove, end.
- No media goes through it. Media is local camera and microphone preview (`getUserMedia`).
- The channel design allows WebRTC signaling messages later (`offer`, `answer`, `ice`). This is a stretch task.

## Backend layout
```
backend/app/
  main.py            app factory, routers, CORS
  core/              config, security (JWT), db session
  models/            SQLAlchemy models
  schemas/           Pydantic schemas
  routers/           auth.py, meetings.py, participants.py, ws.py
  services/          meeting_service.py, participant_service.py, room_manager.py
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
Backend: `DATABASE_URL`, `JWT_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `FRONTEND_ORIGIN`, `ENABLE_DEMO_LOGIN`.
Frontend: `BACKEND_URL`, `NEXT_PUBLIC_WS_URL`.
Never commit real values. Commit `.env.example` files.
