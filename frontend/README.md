# Frontend

Next.js 16 (App Router), React 19, Tailwind 4, SWR. The API contract is in `docs/api.md`.
The look comes from Design A (`docs/design-notes-a.md`).

## Run it

You need Node 20 or later, and the backend on port 8000.

1. Start the backend (in `backend/`, see `backend/README.md`):
   ```bash
   uv sync
   cp .env.example .env          # keep ENABLE_DEMO_LOGIN=true
   uv run alembic upgrade head
   uv run python -m app.seed
   uv run uvicorn app.main:app --port 8000
   ```
2. Start the frontend (in `frontend/`):
   ```bash
   npm install
   cp .env.example .env.local
   npm run dev                   # http://localhost:3000
   ```
3. Open http://localhost:3000 and click "Continue as demo user".

Other commands:

```bash
npm run lint
npm run build
npm run start                   # serves the build on port 3000
```

## Environment variables

| Name | Purpose |
|---|---|
| `BACKEND_URL` | The FastAPI URL. Next.js forwards `/api/*` to it. Default `http://localhost:8000`. Next.js reads it at build and start time. |
| `NEXT_PUBLIC_WS_URL` | The WebSocket base URL for the meeting room. The browser connects to it directly. It goes into the bundle at build time. |

## How it talks to the backend

- The browser only calls `/api/*` on its own origin. `next.config.ts` forwards these calls to `BACKEND_URL`. So the `session` cookie is first-party.
- `src/lib/api.ts` is the only place that calls `fetch`. It sends `credentials: "include"` and turns an error body `{detail, code}` into an `ApiError`.
- `src/lib/types.ts` copies the shapes in `docs/api.md`.
- `src/lib/queries.ts` has the SWR hooks (`useMe`, `useUpcomingMeetings`, `useRecentMeetings`, `useMeetingLookup`).

## Auth

- `/signin` has "Continue with Google" and "Continue as demo user". Both return to `?next=`.
- `src/proxy.ts` sends a visitor with no `session` cookie from `/` and `/schedule` to `/signin?next=...`.
- `PortalShell` also calls `/api/me`, because only the backend can tell if the cookie is valid.

## Meetings

- Join: `/join` and `/j/{code}` look up the meeting (`GET /api/meetings/{code}`), then call `POST /api/meetings/{code}/join`.
- The join result (participant, `ws_ticket`, meeting) goes to a small store (`src/lib/meetingStore.ts`). The rejoin token goes to sessionStorage, one per meeting code.
- `/meeting/{code}` shows the camera preview, joins, then shows the room.
- `src/lib/useRoom.ts` is the seam for the realtime room. It returns `{participants, me, actions}`. In stage 1 the list is the real participant plus sample people. Stage 2 connects the WebSocket inside this hook.

## Layout

```
src/app/          routes
src/components/   ui/, layout/, auth/, dashboard/, schedule/, join/, meeting/
src/lib/          api client, types, SWR hooks, store, hooks
src/styles/       design tokens (tokens.css)
```
