# API contract

Base path: `/api`. JSON bodies. Times are UTC ISO-8601. Auth uses the httpOnly `session` cookie.
Error body: `{"detail": "<message>", "code": "<machine_code>"}`.

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
| GET | `/api/meetings/upcoming` | user | Scheduled meetings the user hosts, `scheduled_start >= now`, ascending. |
| GET | `/api/meetings/recent?limit=20` | user | Meetings the user hosted or joined, newest first. |
| GET | `/api/meetings/{code}` | none | Public lookup for the join page. Returns `{meeting_code, title, host_name, status, access, requires_passcode}`. 404 if unknown. `code` accepts digits with or without spaces. |
| PATCH | `/api/meetings/{id}` | host | Edit title, description, time, access. |
| DELETE | `/api/meetings/{id}` | host | Cancel a scheduled meeting. |
| POST | `/api/meetings/{code}/join` | user or guest | Body: `{display_name, passcode?, rejoin_token?}`. Returns `{participant, ws_ticket, rejoin_token, meeting}`. A valid `rejoin_token` from an earlier join gives back the same participant row (see WebSocket). 403 `guests_not_allowed` if `access=verified_only` and no session. 403 `bad_passcode`. 410 `meeting_ended`. Starts the meeting (`live`) if the host joins. |
| POST | `/api/meetings/{code}/end` | host | Sets `status=ended`. Broadcasts `meeting_ended`. |

## Participants (host controls)
| Method | Path | Auth |
|---|---|---|
| GET | `/api/meetings/{code}/participants` | participant ticket or session |
| POST | `/api/meetings/{code}/participants/{pid}/mute` | host or co_host |
| POST | `/api/meetings/{code}/mute-all` | host or co_host |
| POST | `/api/meetings/{code}/participants/{pid}/remove` | host or co_host |

`Participant`: `{id, display_name, role, is_muted, is_video_off, joined_at, user_id|null}`

## WebSocket
`GET {NEXT_PUBLIC_WS_URL}/ws/meetings/{code}?ticket=<ws_ticket>`
- The ticket is a signed token that lives 60 seconds and works once. It carries `participant_id` and `meeting_id`.
- The server tracks used tickets in memory. This works for one server process only.
- Host actions use the REST endpoints above. The server then sends the event.

### Server to client events
Each event is a JSON object with a `type` field. `Participant` is the REST shape.

| Event | Payload | Sent to |
|---|---|---|
| `snapshot` | `{participants: Participant[]}` | The new socket. Always the first message. |
| `participant_joined` | `{participant}` | Everyone. Sent at REST join time, and when a row comes back. |
| `participant_left` | `{participant_id}` | Everyone. |
| `participant_updated` | `{participant}` | Everyone. After `set_muted`, `set_video_off`, or a host mute. |
| `mute_all` | `{participant_ids}` | Everyone. The ids of the muted attendees. |
| `you_were_removed` | `{participant_id}` | Only the removed participant. The server then closes its sockets. |
| `meeting_ended` | `{}` | Everyone. The server then closes every socket. |
| `error` | `{code, detail}` | The sender of a bad client event. `code` is `bad_event`. The socket stays open. |

A client must apply `participant_joined` and `participant_updated` as an upsert by `id`. An event can repeat data that the `snapshot` already has.

### Client to server events
- `{"type": "set_muted", "value": bool}`
- `{"type": "set_video_off", "value": bool}`
- `{"type": "leave"}`: the server closes every socket of this participant with code 1000.

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
