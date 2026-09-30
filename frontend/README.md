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
npm test                        # Vitest unit tests (WebRTC rules and signal parsing)
npm run build
npm run start                   # serves the build on port 3000
```

## Environment variables

| Name | Purpose |
|---|---|
| `BACKEND_URL` | The FastAPI URL. Next.js forwards `/api/*` to it. Default `http://localhost:8000`. Next.js reads it at build and start time. |
| `NEXT_PUBLIC_WS_URL` | The WebSocket base URL for the meeting room. The browser connects to it directly. It goes into the bundle at build time. |
| `NEXT_PUBLIC_TURN_URL` | Optional TURN server URL, or several URLs separated by commas. Empty means STUN only. Build time. |
| `NEXT_PUBLIC_TURN_USERNAME` | The TURN user name. Build time. |
| `NEXT_PUBLIC_TURN_CREDENTIAL` | The TURN password. Build time. It is in the browser bundle, so use a TURN account with limits. |

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
- `src/lib/useRoom.ts` is the seam for the realtime room. It returns `{participants, me, status, actions}`, and for WebRTC `{connectedIds, sendSignal, onSignal}`. `src/lib/roomSocket.ts` opens the WebSocket and reconnects.

## WebRTC (audio and video)

The design is in `docs/webrtc-plan.md`. Each participant keeps one `RTCPeerConnection` to each other participant (a mesh). This works well for 2 to 6 people. The media goes directly between the browsers. The meeting WebSocket carries only the signaling messages.

Code in `src/lib/webrtc/`:

| File | Job |
|---|---|
| `useMedia.ts` | One `getUserMedia({audio, video})` call. `MeetingExperience` owns the stream, so the preview and the room share it. The camera opens once. |
| `peerManager.ts` | Creates, replaces and closes the peer connections. No React. It gives a snapshot: the remote streams and the state of each connection. |
| `signaling.ts` | The shape of the `signal` data, and `parseSignal`, which checks each message from another client. |
| `usePeers.ts` | Connects `PeerManager` to `useRoom` and to the components (`useSyncExternalStore`). |

Who calls whom:

1. After each `snapshot`, a client calls nobody. It sends `{kind: "hello"}` to each id in `connected_ids`.
2. A client that gets `hello` sends the offer. So the clients that were in the room call the new client.
3. When two clients send `hello` to each other at the same time, the lower participant id calls. When two offers cross, the offer of the lower id wins.

Why `hello`: the server sends `participant_joined` at the REST join. The socket of the new client is not open yet, so an offer sent at that time gets `bad_target`.

Each signal carries `sid`, a random id of the sender's page. A reload makes a new `sid`. The others then replace the old connection for that participant id. They do not add a second one.

Media rules:

- Mute and video off set `track.enabled` and send `set_muted` and `set_video_off`. They also take the track off each WebRTC sender (`replaceTrack(null)`), so no packets go out. A disabled audio track still sends silence.
- A tile shows the avatar when `is_video_off` is true, or when the stream has no video track.
- The sound of each remote participant plays through a hidden `<audio>` element. It keeps playing when the video is off. The video elements are always muted, so my own voice never plays back.
- If the browser blocks the camera and microphone, the user joins with "no media". The connections then only receive.
- The Join button waits until the browser answers the device request. So each connection starts with the final stream.

Lifecycle:

- Leave, removed, meeting ended, connection lost, page unload: all peer connections close, the remote tracks stop, and the camera and microphone stop.
- `participant_left`: that connection closes and the tile goes away.
- Socket reconnect: the local stream stays. Connections that still work stay. The others are built again.
- ICE `failed`: the lower id tries one ICE restart. If the connection does not come back in 10 seconds, the tile shows "Connection problem".
- The dot in the name tag shows the link quality from `getStats` every 3 seconds: green (good), orange (fair), red (poor), grey (connecting).

### TURN

The app always uses the public STUN server `stun:stun.l.google.com:19302`. STUN is enough when both browsers are on open networks. Strict NATs, many company networks and some mobile networks block direct connections. Then the call needs a TURN server, which relays the media. Set `NEXT_PUBLIC_TURN_URL`, `NEXT_PUBLIC_TURN_USERNAME` and `NEXT_PUBLIC_TURN_CREDENTIAL` (see `.env.example`), then build again. A hosted TURN service or your own `coturn` server both work.

## Layout

```
src/app/          routes
src/components/   ui/, layout/, auth/, dashboard/, schedule/, join/, meeting/
src/lib/          api client, types, SWR hooks, store, hooks
src/styles/       design tokens (tokens.css)
```
