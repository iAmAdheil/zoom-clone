# Design C: notes

Design C is my own reading of the brief. It keeps the Zoom look: Zoom blue, a light dashboard and a dark meeting room. Where Zoom is weak, it borrows one pattern from Google Meet or Microsoft Teams.

## Research (lazyweb)

I used `lazyweb_search_screens` and `lazyweb_search_flows`. The saved search is private to the account:
https://www.lazyweb.com/agentic-search/98d26bca-a0a5-42af-8206-fc213d477a0c

Queries:
- "Zoom video meeting room with control bar" (desktop)
- "meeting dashboard home new meeting join schedule" (company: zoom)
- "Google Meet pre-join camera preview green room"
- "Microsoft Teams meeting participants panel mute all"
- Flow search: "join a video meeting"

`docs/reference/` does not exist, so I had no other reference screenshots.

### Screens I used

| Product | Screen (lazyweb ref) | What I took from it |
|---|---|---|
| Zoom Workplace desktop | Meeting room grid (`screens:155d1c8a8a5d64947f36040f`) | Near-black room. Name chip at the bottom left of each tile. Muted mic in red. Bottom bar: icon over label. Mute and Video on the left, tools in the middle, red End on the right. Small carets next to Mute and Video. |
| Zoom desktop | Speaker view with side panel (`screens:10e2c91ea93fa530f510aef0`) | Side panel sits to the right of the video. The video area shrinks. |
| Zoom web | Schedule Meeting form (`screens:cc8388ddccc9c2b080058cf5`) | Label column on the left, fields on the right. Topic, When, Duration (hr + min), Time zone, Security with Passcode checkbox. Save and Cancel at the bottom. |
| Zoom web | Meetings page (`screens:9ea93c08c8aca907778fbb9e`) | Light portal. Left nav with a blue selected row. Blue "Schedule a Meeting" button. |
| Zoom web | Meeting details (`screens:87889d60ef1fc1939d0d3a5f`) | Meeting ID, passcode and invite link as a simple key and value list. Used for the "Meeting scheduled" state. |
| Zoom Workplace app | Home (`screens:ab90b1d58f6e59644d7c1c40`, `screens:7cbfc3ceefaf0ba12766b908`) | Big square action tiles. Orange for New meeting, blue for Join, Schedule and Share. Bottom tab bar on phones. Empty state "No upcoming meetings". |
| Zoom mobile | Participants sheet (`screens:d5f0606dc49f6f17117d4f9a`) | "Name (Host, me)" labels. Mic and video icons at the right of each row. Invite button at the bottom. Red End button at the top right on phones. |
| Zoom mobile | Sign up flow (`flows:5547780b490edb06cb994645`) | Blue brand welcome screen with a dark sheet of buttons. Sign in with Google. Lands on Home. |
| Google Meet | Mic and camera choice (`screens:bd2a4a64af603467e4f0b344`) | Ask about mic and camera before the room. Round toggles. |
| Whereby | Pre-join (`screens:0f7c9bea8b8e3f635971342a`) | Large preview, device selects under it, one Join button. |
| Microsoft Teams | Meeting with reactions (`screens:938e0d790042ea076833d89c`) | Reaction row in a small popover over the toolbar. |
| Microsoft Teams | Avatar tile (`screens:5c1f79b8d06b65497d661cd7`) | When video is off, show a large avatar with initials in the tile. |
| Sessions | Participant list (`screens:c63431a27ee3e6a7261498f4`) | Host actions (mute, invite) in the participant list. |

## Design decisions

1. **Zoom blue and orange.** Brand blue `#0b5cff` for primary actions. Orange `#ff742e` only for "New meeting", like the Zoom home.
2. **Dashboard = Zoom app home + Zoom web portal.** The web portal gives the top bar and left nav. The app gives the big action tiles. The right card shows the time and date, like the Zoom desktop home, with the Upcoming list below it.
3. **Upcoming list grouped by day.** "Today", "Tomorrow", then dates. Each row shows time, duration, meeting ID and the access setting. The next meeting gets a blue Start button and "Starts in 60 min".
4. **Access setting in plain words.** `verified_only` shows as "Signed-in only" with a lock. `allow_guests` shows as "Guests allowed" with a globe. The same badge is used on the dashboard, the join lookup, the pre-join screen and the meeting info popover.
5. **Pre-join takes one idea from Meet.** Zoom's own preview is a small dialog. Design C uses a large preview with round mic and camera toggles on the video, device selects under it, and the join panel on the right. It says who is already in the meeting ("Priya, Marco and 3 others are here").
6. **Room follows Zoom closely.** Dark room, gallery grid, green ring on the active speaker, name chips, raised hand badge, green Share icon, red End. The meeting title with a green shield opens the meeting info popover with the invite link.
7. **Host controls like Zoom.** Hover a row in Participants to see "Mute" (or "Ask to unmute") and a "More" menu with "Remove". "Mute all" opens the Zoom confirm dialog with "Allow participants to unmute themselves". Remove asks for confirmation.
8. **End menu like Zoom.** The host sees "End meeting for all" and "Leave meeting".
9. **Gallery math.** The grid picks the largest tile that fits the space. Wide spaces get 16:9 tiles. Tall spaces (phones, tablets with a panel open) get 3:4 tiles in two columns. See `src/components/meeting/VideoGrid.module.css`.
10. **Responsive.**
    - Desktop (1024 px and up): top bar, full left nav, side panels as a column.
    - Tablet (768 to 1023 px): left nav becomes an icon rail. Panels stay as a column.
    - Phone (below 768 px): bottom tab bar, like the Zoom app. In the room, End moves to the top bar. Share and Reactions move into More. Panels cover the screen.

## Tokens

All colors, radii, fonts, shadows, spacing and layout sizes are in `src/styles/tokens.css`. That file is also the Tailwind v4 config (`@theme`). It clears the default Tailwind palette, radii, fonts and shadows, so only our tokens exist. For example, `bg-blue-500` does not compile to anything.

Exceptions: the Google "G" mark uses Google's own colors. `layout.tsx` repeats the brand blue for the browser `themeColor`, because metadata cannot read CSS variables.

## Components

- `components/ui`: Button, Field (TextInput, TextArea, Select, Checkbox), RadioCard, Avatar, Badge, Card, Dialog, Popover, CopyButton, Icon, Logo, GoogleMark.
- `components/layout`: AppShell, TopNav, SideNav, TabBar, ProfileMenu.
- `components/dashboard`: ActionTiles, UpcomingList, RecentList, AccessBadge, EmptyState.
- `components/join`, `components/schedule`: the two forms.
- `components/meeting`: PreJoin, MeetingRoom, VideoGrid, VideoTile, CameraFeed, ControlBar, ControlButton, RoomMenus, RoomTopBar, MeetingInfo, SidePanel, ParticipantsPanel, ChatPanel.

## Mock data

`src/lib/mock.ts` holds all data. `src/lib/types.ts` copies the shapes in `docs/api.md`. "Now" is fixed at 30 Sep 2026, 10:00 in Asia/Kolkata, so server and browser renders match.

## Gaps

- No real camera or microphone. `CameraFeed` draws a person. Pre-join does not call `getUserMedia`.
- Screen share only shows a banner. There is no shared screen view.
- Speaker view is not built. Only gallery view.
- Recordings, Contacts, Settings and Profile are placeholders.
- Sign in and join use a short fake delay, then go to the next page. No auth.
- Host controls on the participants panel show on hover or focus on desktop and tablet. A touch tablet has no hover, so a real app needs a tap target there.
- The logo is a text wordmark, not the Zoom logo file.
