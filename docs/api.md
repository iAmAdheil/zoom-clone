# API contract

Base path: `/api`. JSON bodies. Times are UTC ISO-8601. Auth uses the httpOnly `session` cookie.
Error body: `{"detail": "<message>", "code": "<machine_code>"}`.

### Error codes
| Status | Code | When |
|---|---|---|
| 400 | `google_auth_failed` | Google sign-in failed, or Google gave no email. |
| 401 | `not_authenticated` | The route needs a session and the request has none. |
| 403 | `not_host` | Only the host can do this. |
| 403 | `not_allowed` | Only the host or a co-host can do this. |
| 403 | `not_participant` | The caller is not in the meeting (no session row and no valid ticket). |
| 403 | `guests_not_allowed` | `access=verified_only` and the caller has no session. |
| 403 | `bad_passcode` | The passcode is missing or wrong. |
| 403 | `removed_from_meeting` | The host removed this participant. |
| 403 | `cannot_remove_host` | A remove request names the host. |
| 404 | `not_found` | An unknown route. |
| 404 | `meeting_not_found` | The meeting code or id is unknown. A code with a character that is not a digit, a space or a dash is unknown too (`43984abc18723` is not `4398418723`). |
| 404 | `participant_not_found` | The participant id is not in this meeting. |
| 404 | `demo_disabled` | `ENABLE_DEMO_LOGIN` is not `true`. |
| 409 | `participant_not_in_meeting` | A `mute` or `remove` request names a participant who left or was removed. No event is sent. |
| 409 | `meeting_not_editable` | The meeting ended, or a time field changes on a meeting that is not `scheduled`. |
| 409 | `meeting_not_cancellable` | Only a `scheduled` meeting can be cancelled. |
| 410 | `meeting_ended` | The meeting ended (join, host action, or a second `end`). |
| 413 | `payload_too_large` | The request body is larger than `MAX_BODY_BYTES` (64 KB). The server does not parse it. |
| 422 | `validation_error` | The body or a query parameter is not valid. `detail` lists the fields. |
| 422 | `start_in_past` | `scheduled_start` is in the past. |
| 422 | `invalid_field` | A PATCH sets `title`, `scheduled_start`, `duration_min`, `timezone` or `access` to null. |
| 429 | `rate_limited` | Too many requests (see "Rate limits"). The `Retry-After` header gives the seconds to wait. |
| 500 | `code_generation_failed` | The server could not make a free meeting code. |
| 503 | `google_not_configured` | The Google client id or secret is not set. |
| 503 | `server_busy` | The database is busy (a lock or a connection wait timed out). The response has `Retry-After: 2`. Try again. |

Other HTTP errors use `http_error` as the code. The WebSocket has its own close codes (see below).

## Auth
| Method | Path | Notes |
|---|---|---|
| GET | `/api/auth/google/login` | Redirects to Google. Optional `next` query parameter (relative path). |
| GET | `/api/auth/google/callback` | Sets `session` cookie. Redirects to `next` or `/`. |
| POST | `/api/auth/demo` | Logs in as the seeded demo user. Returns 404 if `ENABLE_DEMO_LOGIN` is not `true`. Rate limited (30 per minute per IP). |
| POST | `/api/auth/logout` | Clears cookie. |
| GET | `/api/me` | Returns `User` or 401. |

`User`: `{id, email, name, avatar_url, is_demo}`. Only the user themself gets this shape.

`PublicUser`: `{id, name, avatar_url}`. Every other caller sees another user in this shape. It has no email.

### `next` after Google sign-in
The server keeps `next` only if it is a plain path on this site. Otherwise it redirects to `/`. A plain path:
- starts with a single `/` (not `//` and not `/\`),
- has only printable ASCII URL characters (no whitespace, no control characters, no backslash, no non-ASCII look-alikes such as `／`),
- does not contain `://`,
- stays like that after all control characters and whitespace are removed, and after percent-decoding (up to 4 rounds). So `/%09/evil.example` and `/%2F/evil.example` go to `/`.

## Meetings
`Meeting`: `{id, meeting_code, title, description, type, status, access, passcode, requires_passcode, scheduled_start, duration_min, timezone, started_at, ended_at, host: User | PublicUser, invite_link}`
- The host of the meeting gets `host` as a full `User`, and gets `passcode`.
- Every other caller (a guest, another signed-in user, a participant who sees the meeting in Recent) gets `host` as a `PublicUser` and `passcode: null`. This includes the `meeting` in the join response.
- `requires_passcode` is `true` if the meeting has a passcode. Every caller gets it.
- Frontend note: the room info of a guest must not read `meeting.passcode` (it is null). Show the passcode that the guest typed, or "Required".

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/api/meetings/instant` | user | Body: `{title?, access?}`. Creates a `live` meeting. Returns `Meeting`. |
| POST | `/api/meetings` | user | Schedule. Body: `{title, description?, scheduled_start, duration_min, timezone, access?, passcode?}`. Returns `Meeting` with `status=scheduled`. A `scheduled_start` without an offset is a wall-clock time in `timezone` (`2031-01-01T10:00:00` with `Asia/Kolkata` is `04:30Z`). A time with an offset or `Z` is used as it is. The server stores UTC. An unknown `timezone` gives 422 `validation_error`. |
| GET | `/api/meetings/upcoming` | user | Meetings the user hosts with `status=scheduled` whose window has not passed (see below). Ascending by `scheduled_start`. |
| GET | `/api/meetings/recent?limit=20` | user | Meetings the user hosted or joined, newest first. Includes lapsed meetings (see below). |
| GET | `/api/meetings/{code}` | none | Public lookup for the join page. Returns `{meeting_code, title, host_name, status, access, requires_passcode}`. 404 if unknown. `code` accepts ASCII digits, with or without spaces or dashes between them. Any other character gives 404 `meeting_not_found`. The same rule applies to every path with `{code}`, and to the WebSocket (4404). |
| PATCH | `/api/meetings/{id}` | host | Edit title, description, time, access. A `scheduled_start` without an offset uses the `timezone` in the body, or else the stored one. |
| DELETE | `/api/meetings/{id}` | host | Cancel a scheduled meeting. |
| POST | `/api/meetings/{code}/join` | user or guest | Body: `{display_name, passcode?, rejoin_token?}`. Returns `{participant, ws_ticket, rejoin_token, meeting}`. A valid `rejoin_token` from an earlier join gives back the same participant row (see WebSocket). 403 `guests_not_allowed` if `access=verified_only` and no session. 403 `bad_passcode`. 410 `meeting_ended`. 429 `rate_limited` (see "Rate limits"). Starts the meeting (`live`) if the host joins. The room gets no event yet (see "Presence"). |
| POST | `/api/meetings/{code}/end` | host | Sets `status=ended`. Broadcasts `meeting_ended`. Returns `Meeting`. |

### Upcoming and Recent window
- The end of a scheduled meeting is `scheduled_start + duration_min`. If `duration_min` is null, the end is `scheduled_start + 15 minutes`.
- A meeting with `status=scheduled` stays in Upcoming until that end has passed. This includes a meeting whose `scheduled_start` is in the past.
- A meeting with `status=scheduled` whose end has passed is never started. It leaves Upcoming and shows in Recent. Its `status` stays `scheduled`. The status enum has no new value.
- A `live` or `ended` meeting is never in Upcoming. It shows in Recent.
- Recent sorts by `started_at`, or by `scheduled_start` when `started_at` is null.

### Invite link
- `invite_link` is `<FRONTEND_ORIGIN>/j/<meeting_code>`.
- If the meeting has a passcode, and the caller is the host, the link ends with `?pwd=<passcode>` (URL-encoded).
- Every other caller gets the link without `pwd`. This includes the public lookup, guests and other users. The public lookup has no `invite_link` field at all.
- The join page reads `pwd` from the link. The client sends it as `passcode` in the join body. The join endpoint has no `pwd` parameter.

### Rate limits
The counters are in memory (one server process) and use a sliding window. The client IP is the first entry of `X-Forwarded-For` (Render and the Vercel proxy set it). If the header is missing, or `TRUST_FORWARDED_FOR=false`, the server uses the socket peer. A limited request gets 429 `rate_limited` with `Retry-After`.

| What | Limit | Env |
|---|---|---|
| `POST /api/auth/demo` | 30 per minute per IP | `RATE_LIMIT_DEMO_PER_MINUTE` |
| `POST /api/meetings/{code}/join` | 60 per minute per IP | `RATE_LIMIT_JOIN_PER_MINUTE` |
| Wrong passcode | 10 per 5 minutes per IP and meeting code | `RATE_LIMIT_PASSCODE_FAILURES`, `RATE_LIMIT_PASSCODE_WINDOW_SECONDS` |

- After 10 wrong passcodes, every join from that IP to that meeting gets 429, also with the right passcode. This stops when the oldest failure is 5 minutes old. Other meetings and other IPs are not affected.
- `RATE_LIMIT_ENABLED=false` turns off all limits.

### Request body size
A body larger than `MAX_BODY_BYTES` (default 65536) gets 413 `payload_too_large`. With `Content-Length`, the server does not read the body. The server reads a chunked body only up to the limit.

## Participants (host controls)
| Method | Path | Auth |
|---|---|---|
| GET | `/api/meetings/{code}/participants` | participant ticket or session |
| POST | `/api/meetings/{code}/participants/{pid}/mute` | host or co_host |
| POST | `/api/meetings/{code}/mute-all` | host or co_host |
| POST | `/api/meetings/{code}/participants/{pid}/remove` | host or co_host |

- `GET /participants` returns the participants who have not left, were not removed, and are connected (an open socket) or joined by REST less than 60 seconds ago (see "Presence"). A guest who joined by REST and never opened a socket is not in the list after that time. The list is ordered by `joined_at`. It accepts the `ticket` query parameter (`?ticket=<ws_ticket>`). A valid, unexpired ticket for this meeting works in place of a session, even if the socket already used it. Without a ticket, the caller needs a session as the host or as a participant. Otherwise the error is 403 `not_participant`.
- `mute` returns the muted `Participant`. It broadcasts `participant_updated`.
- `mute-all` mutes every active attendee. It skips participants who left or were removed. The host and co-hosts stay unmuted. It returns the list of muted `Participant` objects (`Participant[]`), and broadcasts `mute_all`.
- `remove` returns the removed `Participant`. It sets `removed=true`, sends `you_were_removed` to that participant, closes its sockets, and broadcasts `participant_left`. The host cannot be removed (403 `cannot_remove_host`).
- These three actions return 410 `meeting_ended` if the meeting ended, and 404 `participant_not_found` for an unknown `pid`. `mute` and `remove` also return 409 `participant_not_in_meeting` if the participant left or was removed.

`Participant`: `{id, display_name, role, is_muted, is_video_off, joined_at, user_id|null}`

### rejoin_token
- `join` returns a `rejoin_token`. The client keeps it (for example in `sessionStorage`).
- After a dropped connection the client calls `join` again with `rejoin_token` in the body. The server returns the same `participant` row, a new `ws_ticket` and a new `rejoin_token`.
- The token is a signed JWT. It lives 12 hours. It names one participant of one meeting. It is valid only for the same caller: a guest token cannot be used with a session, and one user's token does not work for another user.
- The token does not skip the join checks (ended, access, removed, passcode). A removed participant gets 403 `removed_from_meeting`.
- A bad or expired token is ignored. The join then follows the normal rules and can create a new row.

## Presence
- A participant is in the room ("connected") while at least one of their sockets is open. A REST `join` alone does not put anyone in the room.
- The room gets `participant_joined` when the first socket of a participant opens. It does not get it at REST join time.
- After a REST join, the participant is "pending" for `PRESENCE_GRACE_SECONDS` (60, the ticket lifetime). A pending participant is in `GET /participants`, but not in a `snapshot`.
- A background reaper runs every `REAPER_INTERVAL_SECONDS` (15). It sets `left_at` on each row that has not left, has no open socket and is not pending. So a guest who closes the tab at the pre-join leaves after 60 to 75 seconds. The room gets no event for this, because it never got `participant_joined` for that guest.
- If the reaper closed a row and its ticket is still valid, the socket brings the row back (see "Disconnect and reconnect").
- The reaper also ends forgotten meetings. A `live` meeting ends when nobody was connected and nobody joined or left for `IDLE_MEETING_MINUTES` (10), or when it was live for more than `MAX_MEETING_HOURS` (24). Open sockets get `meeting_ended` and close with 4410, as after an `end` by the host. A `scheduled` meeting does not change, even long after its end.
- The pending list is in memory. After a restart, the first reaper round closes every open row, because no socket is open. Clients reconnect with the rejoin token.

## WebSocket
`GET {NEXT_PUBLIC_WS_URL}/ws/meetings/{code}?ticket=<ws_ticket>`
- The ticket is a signed token that lives 60 seconds and works once. It carries `participant_id` and `meeting_id`.
- The server tracks used tickets in memory. This works for one server process only.
- Host actions use the REST endpoints above. The server then sends the event.

### Server to client events
Each event is a JSON object with a `type` field. `Participant` is the REST shape.

| Event | Payload | Sent to |
|---|---|---|
| `snapshot` | `{participants: Participant[], connected_ids: number[]}` | The new socket. Always the first message. `participants` lists only the connected participants (not left, not removed, with an open socket), ordered by `joined_at`. `connected_ids` lists the same ids, ascending. It includes the new client. A client calls each id except its own (see Signaling). |
| `participant_joined` | `{participant}` | Everyone except the new participant. Sent when the first socket of a participant opens (the row has `left_at` null, or the socket brings it back). Not sent at REST join time. Not sent for a second socket of the same participant. |
| `participant_left` | `{participant_id}` | Everyone. |
| `participant_updated` | `{participant}` | Everyone. After `set_muted`, `set_video_off`, or a host mute. |
| `mute_all` | `{participant_ids}` | Everyone. The ids of the muted attendees. |
| `you_were_removed` | `{participant_id}` | Only the removed participant. The server then closes its sockets. |
| `meeting_ended` | `{}` | Everyone. The server then closes every socket. |
| `signal` | `{from, data}` | Only the target of a client `signal`. See Signaling. |
| `error` | `{code, detail}` | The sender of a bad client event. The socket stays open. `code` is `bad_event`, `bad_target` or `payload_too_large`. |

A client must apply `participant_joined` and `participant_updated` as an upsert by `id`. An event can repeat data that the `snapshot` already has. (The frontend `useRoom` already does this.)

### Client to server events
The types are strict. `value` must be JSON `true` or `false` (not `"yes"`, `1` or `"true"`). `to` must be a JSON integer (not `"2"` or `2.0`). Anything else gets `bad_event`.
- `{"type": "set_muted", "value": bool}`
- `{"type": "set_video_off", "value": bool}`
- `{"type": "leave"}`: the server closes every socket of this participant with code 1000.
- `{"type": "signal", "to": <participant_id>, "data": <JSON object>}`: see Signaling.

### Signaling (WebRTC relay)
The server relays signaling messages (`offer`, `answer`, `ice` and so on) between two participants. It carries no media.
- Client to server: `{"type": "signal", "to": <participant_id>, "data": <any JSON object>}`.
- Server to the target only: `{"type": "signal", "from": <sender participant_id>, "data": <same object>}`. All open sockets of the target get it. Nobody else gets it.
- The server never reads or changes `data`. The client decides the shape of `data`.
- `to` must be an integer id of another participant of the same meeting. That participant must have an open socket, must not have left, and must not be removed. If not, the sender gets `{"type": "error", "code": "bad_target", "detail": "..."}`. A signal to yourself is also `bad_target`. A signal never crosses to another meeting.
- `data` must be a JSON object. Its size as compact JSON is at most 16 KB (16384 bytes). A larger `data` gets `{"type": "error", "code": "payload_too_large", ...}`. A raw message larger than 17 KB gets the same error without parsing.
- A message with a missing or wrong `to` or `data` gets `bad_event`.
- A participant who left or was removed cannot send. The server drops the signal and sends no reply. The socket closes soon after.
- The socket stays open after every error.

Error order for one message. The first rule that fails gives the result:
1. The raw message is larger than 17 KB: `payload_too_large`. The server does not parse it.
2. The message is not JSON, or does not fit an event above: `bad_event`.
3. The sender left or was removed: the server drops a `signal` and sends no reply.
4. `data` is larger than 16 KB: `payload_too_large`.
5. The target is not valid (see above): `bad_target`.

### Close codes
The server accepts the socket first, then closes it with a code and a reason. This way a browser can read them. The reason is a machine code.

| Code | Reason | When |
|---|---|---|
| 1000 | `left` | The participant sent `leave`. |
| 4401 | `invalid_ticket` | The ticket is missing, bad, or expired. |
| 4401 | `ticket_used` | The ticket was used before. Call `join` again. |
| 4403 | `wrong_meeting` | The ticket is for another meeting. |
| 4403 | `not_participant` | The ticket names no participant of this meeting. |
| 4403 | `removed_from_meeting` | The host removed the participant. Also sent after `you_were_removed`. |
| 4403 | `too_many_connections` | The participant has more than `MAX_SOCKETS_PER_PARTICIPANT` (3) open sockets. The oldest socket gets this close. The client must not reconnect it (the frontend treats 4403 as final). |
| 4404 | `meeting_not_found` | The meeting code is unknown. |
| 4410 | `meeting_ended` | The meeting ended. Also sent after `meeting_ended`. |

### Disconnect and reconnect
- One participant can have more than one socket (for example, two tabs of one signed-in user), up to 3. A fourth socket closes the oldest one with 4403 `too_many_connections`.
- When the last socket of a participant closes, the server sets `left_at` and sends `participant_left`.
- To reconnect, call `join` again with the `rejoin_token` from the first join. The server gives back the same participant row, so there is no duplicate. The token lives 12 hours. It does not skip the join checks. A removed participant gets 403 `removed_from_meeting`.
- A signed-in user whose row is still open gets the same row without a token.
- If a ticket's row left after the ticket was made (another tab sent `leave`, or the reaper closed it), the socket brings the row back and the server sends `participant_joined`.

## Frontend pages
| Route | Page |
|---|---|
| `/signin` | Google sign in button, "Continue as demo user" button |
| `/` | Dashboard (auth required): New Meeting, Join, Schedule, Upcoming, Recent |
| `/join` and `/j/{code}` | Join screen: meeting ID, display name, passcode |
| `/schedule` | Schedule form |
| `/meeting/{code}` | Pre-join preview, then the meeting room |
