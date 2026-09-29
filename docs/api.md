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
| POST | `/api/meetings/{code}/join` | user or guest | Body: `{display_name, passcode?}`. Returns `{participant, ws_ticket, meeting}`. 403 `guests_not_allowed` if `access=verified_only` and no session. 403 `bad_passcode`. 410 `meeting_ended`. Starts the meeting (`live`) if the host joins. |
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
- Server to client events: `snapshot` (full participant list), `participant_joined`, `participant_left`, `participant_updated`, `you_were_removed`, `mute_all`, `meeting_ended`.
- Client to server events: `set_muted {value}`, `set_video_off {value}`, `leave`.
- Host actions use the REST endpoints above. The server then broadcasts the event.

## Frontend pages
| Route | Page |
|---|---|
| `/signin` | Google sign in button, "Continue as demo user" button |
| `/` | Dashboard (auth required): New Meeting, Join, Schedule, Upcoming, Recent |
| `/join` and `/j/{code}` | Join screen: meeting ID, display name, passcode |
| `/schedule` | Schedule form |
| `/meeting/{code}` | Pre-join preview, then the meeting room |
