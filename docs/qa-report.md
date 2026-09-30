# QA report: Zoom clone, `main` at c6e48d6

Date: 2026-09-30. Tester: independent QA (did not build the app).
Target: the running servers from the `main` checkout. Frontend on http://localhost:3000 (Next.js production build). Backend on http://localhost:8000. Database `backend/zoom.db` (the running server uses `DATABASE_URL=sqlite:///./zoom.db`, not `zoomclone.db`).

No file under `frontend/src` or `backend/app` was changed. The servers were not stopped, restarted or reseeded.

## How the tests ran

- Scripts are in `qa/`. Run them from `qa/` with `node <script>.mjs` after `npm install` in `qa/`. `playwright` 1.60 and `axe-core` are dependencies of `qa/` only. They are not in the app.
- `playwright` was not in `frontend/node_modules`, so `qa/` installs it. Playwright 1.60 expects chromium-1223. This machine has chromium-1243, so `qa/lib.mjs` points to that binary.
- Chromium runs headless with `--use-fake-device-for-media-stream --use-fake-ui-for-media-stream`.
- The fake camera: the first two room runs used the default 1280x720 fake camera. Five to six contexts on this 8-core machine pushed the load average to 130-150, and the test itself timed out. Later runs feed the same fake device from a 320x180 test pattern (`--use-file-for-fake-video-capture`, made with ffmpeg into `qa/out/`). Set `QA_SMALL_VIDEO=0` to use 720p again. The 720p run is kept as `docs/qa/results/t4_room_run720p.json`.
- Signed-in users other than the demo user use a session cookie made by `qa/mint_tokens.py` with the backend venv. The tokens go to `qa/out/tokens.json`, which is not committed.
- Contexts in the room test: host (demo user, 1440x900), Alice (user 2), guest 1, guest 2 (XSS name), phone guest (390x844, mobile, touch), then Bob (user 3) as the late 6th joiner.
- WebRTC has no debug hook in the app. The scripts add an init script that records every `RTCPeerConnection`, `WebSocket` and `getUserMedia` stream (`window.__pcs`, `__sockets`, `__streams`). Media checks use `getStats()`, `videoWidth`, and pixel changes of each remote `<video>` drawn to a canvas.
- Raw evidence (every check with its numbers) is in `docs/qa/results/*.json`. In the bug list, `results/` means `docs/qa/results/`. Screenshots are in `docs/qa/`.

| Script | Matrix items |
|---|---|
| `t1_auth_dashboard.mjs`, `t1b_open_redirect.mjs` | 1, 2, 3 |
| `t2_schedule.mjs` | 4 |
| `t3_join.mjs` | 5 |
| `t4_room.mjs`, `t4b_probe500.mjs`, `t4c_media_edge.mjs` | 5 (XSS in room), 6, 7 |
| `t5_realtime.mjs` | 8 |
| `t6_api_security.mjs`, `t6b_burst.mjs` | 9 |
| `t7_responsive.mjs` | 10 |
| `t8_a11y.mjs` | 11 |
| console files `docs/qa/results/console-*.json` | 12 |
| `t9_perf_data.mjs`, `t9b_bitrate.mjs` | 13, 14 |

## Summary

Counts are automated checks from the last run of each script. "Info" rows record a value and have no pass rule.

| # | Area | Passed | Failed | Info | Bugs |
|---|---|---|---|---|---|
| 1 | Auth | 8 | 5 | 0 | BUG-03 |
| 2 | Dashboard | 8 | 0 | 0 | BUG-24 (code reading) |
| 3 | Instant meeting | 4 | 0 | 0 | none |
| 4 | Schedule | 14 | 1 | 0 | BUG-08, BUG-17 |
| 5 | Join and names (incl. XSS) | 25 | 1 | 2 | BUG-07, BUG-23 |
| 6 | Room with 5 and 6 contexts | 14 | 2 | 0 | BUG-05, BUG-06, BUG-12 |
| 7 | Media | 17 | 0 | 0 | BUG-20 (cosmetic) |
| 8 | Realtime resilience | 9 | 6 | 0 | BUG-01, BUG-11, BUG-21 |
| 9 | API security and validation | 21 | 4 | 3 | BUG-02, BUG-04, BUG-09, BUG-10 |
| 10 | Responsive and visual | 1 | 1 | 0 | BUG-13, BUG-18 |
| 11 | Accessibility | 8 | 3 | 1 | BUG-14, BUG-15, BUG-22 |
| 12 | Console and network | manual | - | - | BUG-19 |
| 13 | Performance | 2 | 0 | 1 | none (note below) |
| 14 | Data | 9 | 1 | 4 | BUG-16 |

Bugs by severity: blocker 0, major 4, minor 13, cosmetic 7 (24 in total).

The lead's main concern, media, passed: every pair in a 5-person room and in a 6-person room had live remote video and growing inbound audio. Mute and video off stop the media for real.

## Results per matrix item

### 1. Auth
- PASS: logged out, `/` and `/schedule` redirect to `/signin?next=...`.
- PASS: a garbage `session` cookie also ends on `/signin`.
- PASS: "Continue as demo user" lands on `/`. `/api/me` returns `{id:1, is_demo:true}`.
- PASS: cookie `session` is HttpOnly, SameSite=Lax, Path=/, 7 days. Not Secure (http origin, as designed).
- PASS: Sign out gives `/api/me` 401 and `/` goes to `/signin`. Logout by GET is 405.
- PASS: `GET /api/auth/google/login` gives 302 to `accounts.google.com` with `client_id`, `redirect_uri=http://localhost:3000/api/auth/google/callback`, scope `openid email profile` and `state`. A forged callback gives a clean 400 `google_auth_failed`.
- FAIL: open redirect after sign-in (BUG-03).

### 2. Dashboard
- PASS: Upcoming (4) and Recent (16) match the API in count and order.
- PASS: access badges match the API.
- PASS: copy invite link puts the host link on the clipboard.
- PASS: time zone. The same meeting shows 6:00 AM in America/New_York and 3:30 PM in Asia/Kolkata.
- PASS: empty states. No seeded user has zero meetings, so the list API was mocked with `page.route` (screenshot `dashboard-empty-1440.png`). An API 500 shows the message and "Try again".

### 3. Instant meeting
- PASS: New Meeting opens `/meeting/<10 digits>` in about 120-220 ms. The meeting is `live` at once.
- PASS: the info popover shows the ID in 3-4-3 groups (for example `339 9277 706`), the link, and "Passcode None" (`room-info-popover-1440.png`).

### 4. Schedule (through the form)
- PASS: all fields (topic, description, tomorrow 10:00 AM, 1 h 30 min, Asia/Kolkata, passcode `Ab1@*_-`, verified only). The API has `scheduled_start=04:30Z`, 90 min, the right zone, passcode and access.
- PASS: past date ("Pick a time in the future."), duration 0, empty topic, 24 h exactly.
- FAIL: 24 h 45 min (BUG-08).
- PASS with note: a 300-char title. The input stops at 200 chars (maxLength). The API refuses 300 chars with 422.
- PASS: unicode and emoji title `Réunion 会议 🚀🎉 تجربة ✓` saves and shows unchanged.
- PASS: the form refuses a passcode with spaces and `# !`. The API accepts ` a b#c!&? ` (trimmed). The host invite link encodes it (`?pwd=a%20b%23c%21%26%3F`), and a guest joins with that link.
- PASS: new meetings show in Upcoming with the right badge. PATCH (title, duration) shows after refresh. PATCH `title:null` gives 422 `invalid_field`. A past start gives 422 `start_in_past`. DELETE gives 204, then 404, and the row leaves the list.

### 5. Join
- PASS: ID with spaces, with dashes, with blanks around it. A pasted full invite link fills the ID and the passcode. `/j/<code>?pwd=` fills the passcode. The pre-join then enters the room without asking again.
- PASS: unknown ID, short ID, `/meeting/<unknown>`, `/meeting/abc`, wrong passcode (error under the field), right passcode after a wrong one, passcode with blanks around it, ended meeting.
- PASS: guest on a `verified_only` meeting sees "Only signed-in users can join this meeting", follows Sign in, uses the demo user, returns to `/j/<code>` with the name filled, and joins (`join-verified-only-blocked-1280.png`).
- PASS: blank name refused. The UI cuts a name at 64 chars. The API takes 200 chars and refuses 256.
- PASS: `<script>alert(1)</script><img src=x onerror=alert(2)>` as a name renders as text in tiles and the participants panel on all 6 contexts. No dialog fired in any context. An HTML meeting title renders as text on the join card, pre-join and dashboard.
- PASS: long names (64 in the UI, 200 by API) do not overflow tiles or the panel (`room-long-names-1440.png`, `room-long-names-390.png`).
- FAIL: early click by a signed-in user (BUG-07).

### 6. Room with 5 contexts, then 6
- PASS: all 5 contexts show the same 5 participant ids as the server.
- PASS: roles from the API: host `host`, all others `attendee`. `co_host` exists in the enum but no UI or API sets it.
- PASS: self mute and video off show on the other 4. Host mutes one guest: the guest gets the toast "The host muted you", the button turns to Unmute, the audio stops, and the others see the icon.
- PASS: Mute All (200, ids of the 4 attendees). The host stays unmuted. The phone shows Unmute and sends 0 audio bytes.
- PASS: host removes guest 2. The guest sees "You were removed", the camera is released, and the tile leaves every list. The same tab cannot rejoin ("The host removed you from this meeting. You cannot join it again.").
- FAIL: a fresh join without the rejoin token gets back in (BUG-05).
- PASS: guest (phone) leaves. The tile leaves the others. The phone lands on `/join`.
- PASS: reload of guest 1 comes back with the same participant id (111) and no duplicate tile. It gets 4 remote videos again.
- PASS: the host leaves without ending. The meeting stays `live` and the other 3 stay in the room. The host comes back later.
- PASS: End Meeting for All. Alice, guest 1 and Bob all see "Meeting ended". The API says `ended`. The host sees "You ended the meeting for everyone".
- PASS: a non-host sees no Mute All, no row Mute/Remove and no End.
- PASS: Alice (signed in, not host) gets 403 for mute, mute-all, remove, end, PATCH and DELETE. A guest gets 401.
- FAIL: chat (BUG-06).

### 7. Media
- PASS: 5-way mesh. Each of the 5 contexts had 4 remote videos (`videoWidth` 320, pixels changing), 4 connected peer connections, and inbound audio growth on all 4 over 3 s.
- PASS: 6 people with a late joiner. Bob, the host and the phone each had 5 remote videos, 5 moving, and 5 connections with audio growth.
- PASS: mute stops audio for real. Sender outbound audio bytes 0 over 3 s. The host's inbound bytes from that guest went from 7 467 to 0. After unmute, 7 448 bytes in 2.5 s.
- PASS: video off. The tile shows the avatar ("Guest One, video off", no `<video>`), and the sender sends 0 frames. Video on brings the picture back.
- PASS: 20 fast mute clicks. The end state is unmuted in the UI, the server and on the others, and audio flows (30 169 bytes in 2.5 s).
- PASS: permission denied (a browser without the fake UI flag and no permission; `getUserMedia` gives NotAllowedError). The pre-join says the devices are blocked and disables both toggles. The guest joins, sees and hears the host (320 px video, 9 441 audio bytes). The host sees "muted, video off". Unmute says "No microphone is available".
- PASS: camera busy, simulated with a `NotReadableError` for video. The app falls back to the microphone only (BUG-20 for the wording).
- PASS with limit: camera used by another tab. With the fake device both tabs get a preview. A real busy camera cannot be tested here.
- PASS: leaving releases the camera (all tracks `ended`, all peer connections `closed`). The same holds after removal and after the meeting ends.
- PASS: 10 fast join and leave cycles (about 10 s). No extra tile, no leftover row, the host keeps 3 open connections, and no live tracks stay.
- In the 720p run under a load average of 130-150, 2 of 5 contexts showed frozen remote frames. This was test-machine overload, not an app fault.

### 8. Realtime resilience
- PASS: the guest's socket closed from the page (code 4000). "Reconnecting..." shows, and within about 1.5 s the guest is back with the same id. The host still gets its video.
- PASS: guest offline for 5 s. Nobody noticed during the 5 s (the socket did not close). The room recovered about 13 s after the start, with media flowing both ways.
- PASS: ticket reuse gives 4401 `ticket_used`. A ticket for another meeting gives 4403 `wrong_meeting`. A garbage ticket gives 4401. A ticket after 65 s gives 4401 `invalid_ticket`. GET participants with that expired ticket gives 403.
- PASS: a 20 MB message closes only that socket (1009) and the server lives.
- FAIL (minor): malformed messages. Garbage, `{}`, an unknown type, a bad signal, 1 MB text and a binary frame all get an `error` event, and the socket stays open. But `set_muted: "yes"` is accepted as true (BUG-21).
- FAIL: ghost participant (BUG-01). Also no cap on sockets per participant (BUG-11).

### 9. API security and validation
- PASS: unauthenticated calls to every user and host endpoint give 401 (GET participants gives 403 `not_participant`).
- PASS: Bob cannot PATCH or DELETE Alice's meeting. Alice cannot end, patch, mute-all or remove in the demo user's meeting. All 403.
- PASS: public `GET /api/meetings/{code}` returns only `access, host_name, meeting_code, requires_passcode, status, title`. No passcode, description or email.
- FAIL: the join response leaks the host email (BUG-04).
- PASS: SQL injection strings in lookup, join name, schedule title and `limit` are stored as text or refused. No 500.
- PASS: wrong types give 422 `validation_error` (string duration, bad date, unknown zone, bad access value, array name, not JSON, negative or float duration). A non-integer id gives 422.
- Info: a code with letters. Pure letters give 404. Digits mixed with letters (`43984abc18723`) find the meeting, because letters are stripped (BUG-23).
- PASS: CORS. A preflight from `https://evil.example` gives 400 with no `Access-Control-Allow-Origin`. The frontend origin gets ACAO plus credentials.
- PASS: JWT tampering. Swapped `sub`, `alg:none`, a cut signature, a ws ticket or rejoin token used as a session, a session used as a ticket, a random signature: all refused.
- FAIL: no rate limit (BUG-09). A burst freezes the backend (BUG-02). No body size limit (BUG-10).

### 10. Responsive and visual
- Screenshots for signin, join, join link, pre-join, dashboard (and phone nav), schedule, room with 1, 4 and 6 tiles, participants panel, invite popover, chat panel, info popover, More menu and End menu, at 1440x900, 834x1112 and 390x844: `docs/qa/<screen>-<width>.png`.
- PASS: no horizontal scroll and no text off screen on any of the 46 screens.
- FAIL: tap targets under 40 px on the phone (BUG-13). The phone self-view overlaps a tile (BUG-18).
- Room tiles for 4 and 6 people in `t7` are REST-joined guests. They show as avatar tiles, like "video off". The real-video versions are `room-4tiles-1440.png`, `room-5tiles-*.png` and `room-6tiles-1440.png`/`-390.png` from `t4`.

### 11. Accessibility
- PASS: `<html lang="en">`.
- PASS: join form tab order is logo, Back to Home, ID, name, passcode, remember, footer link. Every stop has a visible focus ring. Enter submits. Enter in the pre-join name field joins.
- PASS: room toolbar is reachable by Tab with a ring. The info popover opens with Enter, closes with Escape, and focus returns to the trigger. Every button has an accessible name.
- PASS with note: schedule form. Tab covers every field, and Enter in the topic submits. The check failed only on the native date input's calendar button, which has no visible ring (browser control).
- FAIL: page titles (BUG-15). axe serious findings (BUG-14).
- axe moderate findings: `region` on the room and the 404 page, and `landmark-one-main` on the 404 page.

### 12. Console and network (unique, from all runs)
- No `pageerror` (uncaught exception) in any run. No app `console.warn` in the browser.
- `GET /api/me` 401 on every guest page, with a red console error "Failed to load resource: 401" (BUG-19). 50 times over the runs.
- Expected errors: 403 on join for a removed or unverified guest, 404 on lookup of an unknown code, 422 on the long-duration schedule. The browser logs each as a console error.
- `net::ERR_ABORTED` on `?_rsc=` prefetches during navigation (about 260 times). These are normal for Next.js.
- In the 720p overload run, non-host host-action calls returned 500 four times. They did not reproduce at normal load (`t4b_probe500`: 10 serial and 40 parallel calls gave 403, and 30 parallel host mutes gave 200). BUG-02 is the likely cause.

### 13. Performance
- PASS: dashboard lists are ready in 81-500 ms (first load 500 ms). 9 JS files, 171 KB transferred. `/api/me` 10-144 ms.
- PASS: `.next/static/chunks` has 14 files, 752 KB in total. The largest is 224 KB (uncompressed).
- Note: the peer connections set no `maxBitrate` or resolution cap. With the 720p camera one peer sent 960x540 at 20 fps, about 480 kbps, limited by bandwidth estimation. In a 6-person mesh each browser encodes 5 streams. On one machine, 5-6 such browsers pushed the load average to 130-150.

### 14. Data
- PASS: foreign keys `meetings.host_id -> users`, `participants.meeting_id -> meetings`, `participants.user_id -> users` (all `NO ACTION`). `PRAGMA foreign_key_check` is clean. The app turns on `PRAGMA foreign_keys=ON`.
- PASS: every `ended` meeting has `ended_at`. No open participant row in an ended meeting. Every removed row has `left_at`. Exactly one demo user. Codes are unique and 10 digits. No `co_host` rows.
- PASS: no orphan participant rows after the cancels in `t2` (a scheduled meeting that had a guest row) and `t6` (Alice's meeting with 3 rows). `cancel_meeting` deletes the rows first.
- FAIL: no index on `participants.user_id` (BUG-16).
- Info: `journal_mode=delete` (no WAL). 0 live meetings at the end (the scripts ended their meetings).

## Bugs

### Major

#### BUG-01: Ghost participants stay in the room forever
- Severity: major
- Steps:
  1. The host is in a live meeting.
  2. A guest opens `/j/<code>`, enters a name and clicks Join. The join form calls `POST /api/meetings/{code}/join`, then opens the pre-join.
  3. The guest closes the tab at the pre-join. (Or: call `POST /api/meetings/{code}/join` with curl and never open the socket.)
- Expected: the person does not show as "in the meeting" until the socket opens, or the row expires soon after the ticket (60 s).
- Actual: the server broadcasts `participant_joined` at REST join time. The row has `left_at = NULL` until a socket closes, and no socket ever opens. The tile stayed on the host for the full 150 s watch (`goneAfterMs: null`) and is still in `GET /participants`. A late joiner also sees it (with no video). The only way out is Remove. In the long-names test, 3 "ID tester" ghosts and 1 "Bob Martins" ghost came only from people who stopped at the pre-join. 50 flood joins made 50 ghosts (`activeParticipants: 54`).
- Evidence: `docs/qa/bug-ghost-tile-1440.png`, `docs/qa/room-long-names-1440.png`, `results/t5_realtime.json`, `results/t4_room.json`, `results/t6_api_security.json`.

#### BUG-02: A burst of requests freezes the backend for minutes (500s, health unreachable)
- Severity: major
- Steps: send 400 parallel `POST /api/auth/demo` (`N=400 node qa/t6b_burst.mjs`). 200 parallel failed in 2 of 3 tries.
- Expected: the requests succeed or get 429. `/api/health` stays fast.
- Actual: 61 of 400 got 200 and 339 got 500 "Internal Server Error" (plain text from uvicorn). The burst took 270 s. `/api/health` timed out (15 s) on 15 probes in a row, so the backend was unusable for about 4.5 min. With 200 parallel: 80 OK, 120 × 500, 90 s. The same pattern gave 500s on non-host calls in the overloaded room run. A likely cause (not verified in the code at runtime): sync endpoints, sync `get_db` teardown and the WebSocket `asyncify` DB work all share one 40-thread pool, and the SQLAlchemy pool (5 + 10) waits 30 s for a connection. Live rooms relay signals through the same pool, so they freeze too.
- Note: these probes froze the shared backend twice during this QA session (about 90 s and about 270 s).
- Evidence: `results/t6b_burst.json`, `results/t6_api_security.json` (rate-limit row: 82 of 200 OK, 91 s).

#### BUG-03: Open redirect after sign-in with `/signin?next=/%09/evil.example/`
- Severity: major
- Steps: open `http://localhost:3000/signin?next=/%09/evil.example/` and click "Continue as demo user". `%0a` and `%0d` also work.
- Expected: `safeNext` keeps the user on the site.
- Actual: the browser goes to `http://evil.example/`. `safeNext` only checks for a leading `//` or `/\`. The browser removes tab, CR and LF from the URL, so `/\t/evil.example/` becomes `//evil.example/`. The backend `safe_next` (used by the Google callback) has the same check. That path was not tested end to end because it needs a real Google login.
- Evidence: `docs/qa/bug-open-redirect-09evilexample.png`, `results/t1b_open_redirect.json`.

#### BUG-04: The join response gives the host's email to anonymous guests
- Severity: major (privacy)
- Steps: `POST /api/meetings/{code}/join` with only `{"display_name":"x"}` (and the passcode, if one is set).
- Expected: a guest gets the host's display name only, like the public lookup (`host_name`).
- Actual: `meeting.host` is the full `User`: `{id, email, name, avatar_url, is_demo}`. Example: `hostEmail: "alice@example.com"`. For an `allow_guests` meeting without a passcode, anyone who knows or guesses a 10-digit code gets the host's email. The same response also includes `passcode` (the guest already typed it).
- Evidence: `results/t6_api_security.json`.

### Minor

#### BUG-05: A removed guest can come back with a fresh join
- Steps: the host removes a guest. The guest opens the link in a new tab or private window (no rejoin token), or calls `join` again without `rejoin_token`.
- Expected: the product says "You cannot join this meeting again", so some block is expected, or the message must be softer.
- Actual: 200 with a new participant row (id 115, old id 112). The new row is also a ghost until a socket opens. Guests have no identity, so a full block needs a design choice (for example, a device token).
- Evidence: `results/t4_room.json`.

#### BUG-06: Chat does not reach anyone, but the panel says "Everyone in the meeting" can see it
- Steps: the host sends a chat message. Alice opens Chat.
- Expected: Alice sees the message, or the panel says clearly that chat is local.
- Actual: Alice has no messages. The empty state says "Chat does not reach the others yet", but after a message is sent, the footer still says "Who can see your messages? Everyone in the meeting."
- Evidence: `docs/qa/room-chat-390.png`, `results/t4_room.json`.
- Fixed: chat now works over the meeting WebSocket (see `docs/api.md`, "Chat"). Evidence: `docs/screenshots/chat/`, `qa/t10_chat.mjs`.

#### BUG-07: A signed-in user who clicks Join at once is told "Enter your name" while the name is shown
- Steps: as Bob (signed in), open `/j/<code>` and click Join before `/api/me` returns.
- Expected: the button waits for the name, or the click uses the name when it arrives.
- Actual: the error "Enter your name." shows under a field that shows "Bob Martins". This happened in 2 of 3 tries. A second click works.
- Evidence: `docs/qa/bug-join-name-race-1280.png`, `results/t3_join.json`.

#### BUG-08: The schedule form offers 24 h 45 min, then shows a raw server message
- Steps: Schedule, Duration 24 hr 45 min, Save.
- Expected: the picker stops at 24 h, or the form shows a clear message.
- Actual: the API refuses 1485 min. The form shows "Input should be less than or equal to 1440" (Pydantic text) under Duration. An empty `role="alert"` element is also in the DOM.
- Evidence: `docs/qa/schedule-error-long-duration-1440.png`, `results/t2_schedule.json`.

#### BUG-09: No rate limit on login, join or passcode guesses
- Steps: 100 parallel joins with wrong passcodes. 50 parallel guest joins. 200 demo logins.
- Expected: 429 after some number of tries, at least on passcode guesses.
- Actual: 100 of 100 wrong passcodes got 403, with no lockout and no slowdown. 50 of 50 joins got 200. No 429 anywhere.
- Evidence: `results/t6_api_security.json`.

#### BUG-10: No request body size limit
- Steps: `POST /api/meetings/{code}/join` with a 50 MB JSON body.
- Expected: 413 before parsing.
- Actual: the server reads and parses the whole body, then gives 422 (360 ms). A 5 MB description gives 422.
- Evidence: `results/t6_api_security.json`.

#### BUG-11: No cap on sockets per participant
- Steps: call `join` 20 times with the rejoin token, then open a socket with each ticket.
- Expected: a small cap (for example 3 tabs).
- Actual: 21 sockets were open for one participant.
- Evidence: `results/t5_realtime.json`.

#### BUG-12: Meetings never end by themselves
- Steps: create an instant meeting and never join. Or, the host leaves without ending.
- Expected: an empty meeting ends after some time, or at least leaves "live". An instant meeting starts when the host joins.
- Actual: an instant meeting is `live` from creation, even if the host never joins. After everyone leaves, it stays `live` with a Join button in Recent. A guest can also join a `scheduled` meeting before the host starts it. The status stays `scheduled` while people are inside.
- Evidence: `results/t1_auth_dashboard.json` (live at creation), `results/t4_room.json` (host left), `results/t6_api_security.json` (join before host).

#### BUG-13: Tap targets under 40 px on the phone
- Examples at 390x844: remember-name checkbox 16x16, "Meeting information" 32x32, End/Leave 48x36, panel Close 30x30, row Mute 51x28 and Remove 66x28, Invite, Mute All and More 32 px high, chat Send 30x30, reactions 32x40, dashboard copy-invite 30x30, Start and Join 32 px high, profile 32x32, header "Join a meeting" and "Back to Home" 32 px high, footer link 15 px high.
- Evidence: `results/t7_responsive.json` (`smallTapTargets`), `docs/qa/*-390.png`.
- Fixed: End, Leave, Cancel and the reaction buttons are at least 40 px high on phones. Checked at 390 and 412 px (`qa/t10_chat.mjs`).

#### BUG-14: Color contrast below WCAG AA (axe "serious")
- Dashboard: 22 nodes. White initials on teal avatar (#00a39e) have a ratio of 3.11. The "Guests allowed" badge (#0e72ed on #e8f…) has 3.96.
- Invite link page: the hint text #747487 on #f7f7fa has 4.27.
- Schedule: the same avatar, and `link-in-text-block` ("Back to Home" link has 1.01:1 against the text around it, with no underline).
- Evidence: `results/t8_a11y.json`.

#### BUG-15: Page titles do not name the page
- Dashboard: "Zoom clone". 404: "Zoom clone". Pre-join, room and meeting-not-found are all "Meeting - Zoom clone", with no meeting title.
- Evidence: `results/t8_a11y.json`.

#### BUG-16: No index on `participants.user_id`
- `list_recent` filters `participants.user_id`, and the join path looks up `(meeting_id, user_id)`. Only `ix_participants_meeting_id` exists. `journal_mode` is `delete`, not WAL, which does not help concurrent reads (see BUG-02).
- Evidence: `results/t9_perf_data.json`.

#### BUG-17: A `scheduled_start` without an offset ignores the `timezone` field
- Steps: `POST /api/meetings` with `scheduled_start: "2031-01-01T10:00:00"` and `timezone: "Asia/Kolkata"`.
- Expected: 10:00 in Kolkata (04:30Z), or 422 for a time without an offset.
- Actual: stored as `2031-01-01T10:00:00Z`. The UI always sends UTC, so only API clients hit this.
- Evidence: `results/t6_api_security.json`.

### Cosmetic

#### BUG-18: On the phone, the floating self-view covers part of the last tile
- At 390x844 with 6 people, the self-view (bottom right) covers the right part of the 5th tile's name tag. The self name is cut to "Dem...".
- Evidence: `docs/qa/room-6tiles-390.png`, `docs/qa/room-5tiles-390.png`.

#### BUG-19: Guest pages log a console error for `/api/me` 401
- Every join, pre-join and room page of a guest calls `/api/me`. It gets 401, and Chrome logs "Failed to load resource: 401".
- Evidence: `results/console-*.json`.

#### BUG-20: A busy camera is reported as "No camera is available"
- With `NotReadableError` on video, the pre-join says "No camera is available. You join with the microphone only." The camera exists but is busy.
- Evidence: `docs/qa/prejoin-camera-busy-1280.png`.
- Fixed: a busy camera now says "The camera is used by another app".

#### BUG-21: The WebSocket accepts loose types, and error order differs from the spec
- `{"type":"set_muted","value":"yes"}` is accepted as `true` (Pydantic lax mode), so it gets `participant_updated`, not `bad_event`.
- A 17 KB `signal` to an unknown target gets `bad_target`, not `payload_too_large`.
- Evidence: `results/t5_realtime.json`.

#### BUG-22: The Participants button's accessible name starts with the count
- Screen readers read "5 Participants" (the badge is before the label in the DOM).
- Evidence: `results/t8_a11y.json`.
- Fixed: the name is now "Participants, 3".

#### BUG-23: A meeting code with letters mixed in is accepted
- `GET /api/meetings/43984abc18723` finds meeting `4398418723`, because all non-digits are stripped. Links from other hosts (`https://us05web.zoom.us/j/<digits>`) are also taken as this app's meeting ID.
- Evidence: `results/t6_api_security.json`, `results/t3_join.json`.

#### BUG-24: Audio and Video option carets do nothing (and a code-reading note)
- The small carets next to Mute and Stop Video (`Audio options`, `Video options`) have no action. They do not open device choice.
- Code reading, not reproduced: `RecentMeetings` shows "Ended" for every non-live row, so a scheduled meeting that nobody started (lapsed) would say "Ended". No lapsed meeting existed, and one cannot be made without a past start.

## Top 10 visual differences from the real Zoom web client

1. Dashboard navigation mixes two products. The left list (Profile, Meetings, Webinars, Recordings, Scheduler, Reports) comes from the web portal, but the home screen copies the desktop app. Zoom Workplace home has a top tab bar (Home, Team Chat, Meetings, ...), not this list.
2. The clock banner uses blurred color blobs. Zoom uses a photo or illustration header.
3. Upcoming rows carry "Guests allowed" and "Verified only" badges and a copy icon. Zoom shows time, topic and a Start button, with details on click.
4. Recent is a flat list. The Zoom portal "Previous" tab is a table with Start Time, Topic and Meeting ID columns.
5. In the room, every name tag has a colored connection dot. Zoom shows only the name (and a mute icon), and shows network problems as a separate icon.
6. "View" in the top bar is a static label. Zoom's View opens Speaker, Gallery and Multi-speaker. There is no active speaker frame and no speaker view.
7. The toolbar has fewer items: no Security, Record, Apps, Whiteboards or Breakout Rooms, and the carets do not open device menus.
8. The top bar shows the meeting title and an elapsed timer. Zoom shows the shield and "Zoom Meeting", and hides the timer by default.
9. On the phone, the grid is 2 columns of square tiles with a floating self-view at the bottom right. The Zoom mobile client opens in speaker view (full-screen active speaker, self-view top right) and swipes to a 2x2 gallery.
10. The participants panel rows have only Mute or Ask to Unmute and Remove. Zoom has a per-row "More" menu with Rename, Make Host, Make Co-Host and Put in Waiting Room. The avatar tile shows the name twice (center and tag), where Zoom shows the large name only.

## Not tested, and why

- Google sign-in end to end: the lead tests it. Only the redirect to Google was checked.
- Backend `safe_next` with a tab character: needs a finished Google login.
- A real camera busy in another app, real device selection, real microphones: only the fake device exists here. The busy case was simulated.
- Real iOS Safari or Android Chrome: the phone context is Chromium with a mobile viewport, touch and an iPhone user agent.
- NAT, TURN, packet loss and bandwidth limits: all peers were on localhost.
- More than one backend process: the room manager and ticket registry are in memory by design.
- Screen sharing, recording, waiting room and co-host: not built.
- A lapsed scheduled meeting in Recent: cannot be made without a past start time (see BUG-24).
- CPU use of the room in a real 6-person call: every peer ran on one machine, so load numbers are not per-user numbers.
