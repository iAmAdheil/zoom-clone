# Design A notes

Design A is the closest copy of the current Zoom web client that we can make.
The meeting room is dark. The portal (dashboard, schedule) is light.

## Research (lazyweb)

Tools used: `lazyweb_search_screens` (4 searches), `lazyweb_search_flows` (2 searches), `lazyweb_agentic_search_finalize`.
Saved search (private): https://www.lazyweb.com/agentic-search/ce2a5c54-4139-4038-b700-79fdd9b050e7

The `docs/reference/` folder does not exist, so the lazyweb screens are the only reference.

### Screens used

| Ref | Product | Screen | What we took |
|---|---|---|---|
| screens:155d1c8a8a5d64947f36040f | Zoom | Gallery view | Near-black stage, dark tiles, name tag at bottom-left with red muted mic, big bold name when video is off, last row centered. |
| screens:e6fff082d3a43e0a99fcf287 | Zoom | Meeting toolbar | Toolbar order: Mute and Stop Video with carets on the left. Participants (count), Chat, Reactions, Share Screen (green), More in the center. End on the right. Icon over a small label. |
| screens:7fbb4c50c09f7e352a523303 | Zoom | Participants panel | White panel on a dark room. Centered "Participants (n)" title with pop-out and close. "(Host, Me)" labels. Footer with Invite, Mute All, More. |
| screens:b75ccce22a3df492374ea8bb | Zoom | Meeting info card | Dark card from the green shield: Meeting ID, Host, Passcode, Invite Link, Copy Link, Encryption. |
| screens:f45e8a6e78392f0110fb5228 | Zoom | Web "Video Preview" | White page, dark 16:9 preview frame, black pill with Mute and Start Video, blue Join button, legal footer. |
| screens:a5d0d40516d1f862d1e5ecf3 | Zoom | Chat panel | Chat as a right-hand panel beside the video. |
| screens:cc8388ddccc9c2b080058cf5 | Zoom | Portal "Schedule Meeting" | Label-left form rows: Topic, Add Description, When (date, time, AM/PM), Duration (hr, min), Time Zone, Security (Passcode, Waiting Room), Save and Cancel. |
| screens:9ea93c08c8aca907778fbb9e | Zoom | Portal "Meetings" | Left nav "PERSONAL" list with a solid blue active row, white header with blue wordmark and Schedule / Join / Host links. |
| screens:320aae6241a9ce1d72ead04a | Zoom | Portal profile | Left nav items and order. |
| flows:5547780b490edb06cb994645 | Zoom | Sign up / sign in flow | Sign in first, Google as a main option, "Join meeting" next to sign in. |
| screens:9c9c97ff19f488a466648fdd | Google Meet | Participants panel | Search field at the top of the people list. |
| screens:6d3e8c8b60e350b8fa803b41 | Google Meet | In-call chat | "Who can see your messages" hint under the message box. |
| screens:938e0d790042ea076833d89c | Microsoft Teams | Grid with reactions | Reactions float over the sender's tile. |
| screens:5c1f79b8d06b65497d661cd7 | Microsoft Teams | Camera-off tile | Checked against Zoom. We kept Zoom's big name text, not the Teams avatar circle. |

The Zoom Home tiles (orange New Meeting, blue Join, Schedule, Share Screen) and the clock card come from the Zoom desktop and web app Home. Lazyweb had no desktop capture of that screen, so this part uses the known Zoom layout.

## Tokens

All colors, radii, layout sizes, shadows and the font live in one file: `src/styles/tokens.css`.
Tailwind v4 reads its theme from the `@theme` block in that file. Tailwind v4 has no `tailwind.config.js`, so this block is the Tailwind config.
The default Tailwind palette is removed (`--color-*: initial`). A component can only use token colors, such as `bg-primary`, `text-ink-muted` or `bg-room-tile`.

Key values:
- Primary blue `#0E72ED`, New Meeting orange `#FF742E`, End red `#E02828`, Share Screen green `#0FB35C`.
- Room: stage `#111111`, bars `#1A1A1A`, tiles `#242424`, active speaker frame `#B6E45A`.
- Portal ink `#232333`, muted `#747487`, lines `#EDEDF4` and `#BABACC`.
- Font: Lato (the Zoom web font), loaded with `next/font`.
- Radii: 8px controls, 12px cards and popovers, 22px Home tiles.

The Google "G" mark keeps Google's four brand colors inside `Icon.tsx`. That is the only color outside the token file.

## Components

- `components/ui`: Button, ButtonLink, Field, TextInput, Select, Check (checkbox and radio), Avatar, Icon, Logo, Popover, MenuItem, Modal, Toast.
- `components/layout`: PortalShell (header + left nav + phone drawer), PortalHeader, SideNav, SimpleShell.
- `components/dashboard`: ActionTiles, UpcomingCard, RecentMeetings.
- `components/meeting`: PreJoin, MeetingRoom, RoomTopBar, VideoGrid, ParticipantTile, ControlBar, ControlButton, SidePanel, ParticipantsPanel, ChatPanel, MeetingInfoPopover, InviteLinkBox, useLocalCamera, roomState.

## Responsive rules

- Desktop (1024px and up): left nav is a column. Side panels sit beside the video.
- Tablet (768px to 1023px): left nav moves into a drawer. Side panels still sit beside the video. Reactions and Share Screen move into More while a panel is open.
- Phone (below 640px): side panels are full screen. The self view is a small floating tile (like the Zoom mobile app). Tiles are square. Reactions and Share Screen are in More.
- The gallery picks the column count that gives the largest tile that still fits (`bestTileSize` in `VideoGrid.tsx`).

## Mock data and routes

All data comes from `src/lib/mock.ts`. The types in `src/lib/types.ts` copy `docs/api.md`.
A fixed mock time (`MOCK_NOW`, 10:24 AM Asia/Kolkata) keeps server and browser output the same.

| Route | Screen |
|---|---|
| `/signin` | Sign in |
| `/` | Dashboard |
| `/join`, `/j/{code}` | Join |
| `/schedule` | Schedule form, then the saved meeting page |
| `/meeting/{code}` | Pre-join preview, then the room |
| `/meeting/{code}?stage=room&panel=participants` | Room with a panel open (for demos) |

## Known gaps

- Camera preview uses `getUserMedia` only. If the camera is blocked, a placeholder picture shows. Other participants are placeholder pictures, not video.
- Screen share, recording, settings and profile are placeholders.
- Speaker view, pinning and the "View" menu are not built. The room has gallery view only.
- The date field is the native browser date picker, not the Zoom calendar popover.
- The "zoom" wordmark is plain text, not the official logo file.
