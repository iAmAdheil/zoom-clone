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
| 404 | `meeting_not_found` | The meeting code or id is unknown. |
| 404 | `participant_not_found` | The participant id is not in this meeting. |
| 404 | `demo_disabled` | `ENABLE_DEMO_LOGIN` is not `true`. |
| 409 | `meeting_not_editable` | The meeting ended, or a time field changes on a meeting that is not `scheduled`. |
| 409 | `meeting_not_cancellable` | Only a `scheduled` meeting can be cancelled. |
| 410 | `meeting_ended` | The meeting ended (join, host action, or a second `end`). |
| 422 | `validation_error` | The body or a query parameter is not valid. `detail` lists the fields. |
| 422 | `start_in_past` | `scheduled_start` is in the past. |
| 422 | `invalid_field` | A PATCH sets `title`, `scheduled_start`, `duration_min`, `timezone` or `access` to null. |
| 500 | `code_generation_failed` | The server could not make a free meeting code. |
| 503 | `google_not_configured` | The Google client id or secret is not set. |

Other HTTP errors use `http_error` as the code. The WebSocket has its own close codes (see below).

## Auth
| Method | Path | Notes |
|---|---|---|
| GET | `/api/auth/google/login` | Redirects to Google. Optional `next` query parameter (relative path). |
| GET | `/api/auth/google/callback` | Sets `session` cookie. Redirects to `next` or `/`. |
| POST | `/api/auth/demo` | Logs in as the seeded demo user. Returns 404 if `ENABLE_DEMO_LOGIN` is not `true`. |
| POST | `/api/auth/logout` | Clears cookie. |
| GET | `/api/me` | Returns `User` or 401. |

`User`: `{id, email, name, avatar_url, is_demo}`

## Meetings
`Meeting`: `{id, meeting_code, title, description, type, status, access, passcode, scheduled_start, duration_min, timezone, started_at, ended_at, host: User, invite_link}`

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/api/meetings/instant` | user | Body: `{title?, access?}`. Creates a `live` meeting. Returns `Meeting`. |
| POST | `/api/meetings` | user | Schedule. Body: `{title, description?, scheduled_start, duration_min, timezone, access?, passcode?}`. Returns `Meeting` with `status=scheduled`. |
| GET | `/api/meetings/upcoming` | user | Meetings the user hosts with `status=scheduled` whose window has not passed (see below). Ascending by `scheduled_start`. |
| GET | `/api/meetings/recent?limit=20` | user | Meetings the user hosted or joined, newest first. Includes lapsed meetings (see below). |
| GET | `/api/meetings/{code}` | none | Public lookup for the join page. Returns `{meeting_code, title, host_name, status, access, requires_passcode}`. 404 if unknown. `code` accepts digits with or without spaces. |
| PATCH | `/api/meetings/{id}` | host | Edit title, description, time, access. |
| DELETE | `/api/meetings/{id}` | host | Cancel a scheduled meeting. |
| POST | `/api/meetings/{code}/join` | user or guest | Body: `{display_name, passcode?, rejoin_token?}`. Returns `{participant, ws_ticket, rejoin_token, meeting}`. A valid `rejoin_token` from an earlier join gives back the same participant row (see WebSocket). 403 `guests_not_allowed` if `access=verified_only` and no session. 403 `bad_passcode`. 410 `meeting_ended`. Starts the meeting (`live`) if the host joins. |
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

## Participants (host controls)
| Method | Path | Auth |
|---|---|---|
| GET | `/api/meetings/{code}/participants` | participant ticket or session |
| POST | `/api/meetings/{code}/participants/{pid}/mute` | host or co_host |
| POST | `/api/meetings/{code}/mute-all` | host or co_host |
| POST | `/api/meetings/{code}/participants/{pid}/remove` | host or co_host |

- `GET /participants` returns the participants who have not left and were not removed, ordered by `joined_at`. It accepts the `ticket` query parameter (`?ticket=<ws_ticket>`). A valid, unexpired ticket for this meeting works in place of a session, even if the socket already used it. Without a ticket, the caller needs a session as the host or as a participant. Otherwise the error is 403 `not_participant`.
- `mute` returns the muted `Participant`. It broadcasts `participant_updated`.
- `mute-all` mutes every active attendee. The host and co-hosts stay unmuted. It returns the list of muted `Participant` objects (`Participant[]`), and broadcasts `mute_all`.
- `remove` returns the removed `Participant`. It sets `removed=true`, sends `you_were_removed` to that participant, closes its sockets, and broadcasts `participant_left`. The host cannot be removed (403 `cannot_remove_host`).
- These three actions return 410 `meeting_ended` if the meeting ended, and 404 `participant_not_found` for an unknown `pid`.

`Participant`: `{id, display_name, role, is_muted, is_video_off, joined_at, user_id|null}`

### rejoin_token
- `join` returns a `rejoin_token`. The client keeps it (for example in `sessionStorage`).
- After a dropped connection the client calls `join` again with `rejoin_token` in the body. The server returns the same `participant` row, a new `ws_ticket` and a new `rejoin_token`.
- The token is a signed JWT. It lives 12 hours. It names one participant of one meeting. It is valid only for the same caller: a guest token cannot be used with a session, and one user's token does not work for another user.
- The token does not skip the join checks (ended, access, removed, passcode). A removed participant gets 403 `removed_from_meeting`.
- A bad or expired token is ignored. The join then follows the normal rules and can create a new row.

## WebSocket
`GET {NEXT_PUBLIC_WS_URL}/ws/meetings/{code}?ticket=<ws_ticket>`
- The ticket is a signed token that lives 60 seconds and works once. It carries `participant_id` and `meeting_id`.
- The server tracks used tickets in memory. This works for one server process only.
- Host actions use the REST endpoints above. The server then sends the event.

### Server to client events
Each event is a JSON object with a `type` field. `Participant` is the REST shape.

| Event | Payload | Sent to |
|---|---|---|
| `snapshot` | `{participants: Participant[], connected_ids: number[]}` | The new socket. Always the first message. `connected_ids` lists the ids of the participants that have an open socket in the room now, ascending. It includes the new client. A client calls each id except its own (see Signaling). |
| `participant_joined` | `{participant}` | Everyone. Sent at REST join time, and when a row comes back. |
| `participant_left` | `{participant_id}` | Everyone. |
| `participant_updated` | `{participant}` | Everyone. After `set_muted`, `set_video_off`, or a host mute. |
| `mute_all` | `{participant_ids}` | Everyone. The ids of the muted attendees. |
| `you_were_removed` | `{participant_id}` | Only the removed participant. The server then closes its sockets. |
| `meeting_ended` | `{}` | Everyone. The server then closes every socket. |
| `signal` | `{from, data}` | Only the target of a client `signal`. See Signaling. |
| `error` | `{code, detail}` | The sender of a bad client event. The socket stays open. `code` is `bad_event`, `bad_target` or `payload_too_large`. |

A client must apply `participant_joined` and `participant_updated` as an upsert by `id`. An event can repeat data that the `snapshot` already has.

### Client to server events
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
| 4404 | `meeting_not_found` | The meeting code is unknown. |
| 4410 | `meeting_ended` | The meeting ended. Also sent after `meeting_ended`. |

### Disconnect and reconnect
- One participant can have more than one socket (for example, two tabs of one signed-in user).
- When the last socket of a participant closes, the server sets `left_at` and sends `participant_left`.
- To reconnect, call `join` again with the `rejoin_token` from the first join. The server gives back the same participant row, so there is no duplicate. The token lives 12 hours. It does not skip the join checks. A removed participant gets 403 `removed_from_meeting`.
- A signed-in user whose row is still open gets the same row without a token.
- If a ticket's row left after the ticket was made, the socket brings the row back and the server sends `participant_joined`.

## Frontend pages
| Route | Page |
|---|---|
| `/signin` | Google sign in button, "Continue as demo user" button |
| `/` | Dashboard (auth required): New Meeting, Join, Schedule, Upcoming, Recent |
| `/join` and `/j/{code}` | Join screen: meeting ID, display name, passcode |
| `/schedule` | Schedule form |
| `/meeting/{code}` | Pre-join preview, then the meeting room |
