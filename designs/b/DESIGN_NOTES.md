# Design B: design notes

Direction: the Zoom look, with the newer Zoom Workplace styling.
The dashboard is light. The pre-join screen and the meeting room are dark.

## Research (lazyweb)

I searched Lazyweb for real Zoom, Google Meet and Microsoft Teams screens before I designed.
Tools used: `lazyweb_search_screens` (6 searches) and `lazyweb_search_flows` (1 search).
I saved the selected screens in one Agentic Search:
https://www.lazyweb.com/agentic-search/5b5ad358-a0b7-4438-b53a-138ad88d9b0c (private to the account owner).

| # | Product | Screen | Lazyweb ref | What I used |
|---|---|---|---|---|
| 1 | Zoom Workplace (desktop) | Meeting room, gallery view | `screens:155d1c8a8a5d64947f36040f` | "zoom Workplace" wordmark. Near-black room. Tiles with a name tag in the bottom-left and a red muted mic. Toolbar with icon over label. Green Share button. Red End button on the right. |
| 2 | Zoom (desktop) | Room with participants panel | `screens:cad68270a628f1cc21d73f4c` | Right panel with "Participants (N)". Mic and camera icons per row. Invite and Mute buttons in the panel footer. Active Participants button in the toolbar. |
| 3 | Zoom (web) | Video preview before join | `screens:f45e8a6e78392f0110fb5228` | Dark preview frame. Mute and Start Video toggles on the frame. One blue Join button under it. |
| 4 | Zoom Workplace (mobile) | Home tab | `screens:ab90b1d58f6e59644d7c1c40` | The Workplace home actions: an orange "Meet" squircle and blue Join, Schedule and Share squircles with labels under them. "No upcoming meetings" empty state. |
| 5 | Zoom (web) | Schedule Meeting form | `screens:cc8388ddccc9c2b080058cf5` | Field order: Topic, Description, When, Duration (hr + min), Time Zone, Security (Passcode). Save and Cancel at the bottom. |
| 6 | Zoom (web) | Meetings list with left nav | `screens:9ea93c08c8aca907778fbb9e` | Left navigation with an active blue item. Upcoming and Previous lists. |
| 7 | Zoom (mobile) | In-call participants panel | `screens:d5f0606dc49f6f17117d4f9a` | Full-screen participants sheet on phone. Invite action. Compact toolbar. |
| 8 | Google Meet | "Ready to join?" preview | `screens:63d74a43941988699dbf1a6a` | Two-column pre-join: preview on the left, "Ready to join?", who is in the call and the Join button on the right. Round mic and camera toggles that turn red when off. Device pickers under the preview. |
| 9 | Google Meet | People panel and control pill | `screens:9c9c97ff19f488a466648fdd` | Panel search field. Host label under a name. Rounded dark panel. |
| 10 | Microsoft Teams | Meeting grid with reactions | `screens:938e0d790042ea076833d89c` | Reactions tray with emoji and Raise hand. Speaker ring on the active tile. |
| 11 | Microsoft Teams | Pre-join with toggles | `screens:b6232e245dbad7549978c093` | Clear on and off states for mic and camera before join. |
| 12 | Microsoft Teams | New meeting form | `screens:ffc3ca6b967d0aa246abbc66` | Date and time side by side. |
| 13 | Zoom (mobile) | Sign up flow (8 steps) | `flows:5547780b490edb06cb994645` | Sign-in screen with Google as the main option and a "Join meeting" path for guests. |

## Decisions

- **Brand color.** Zoom Workplace blue `#0B5CFF` for primary actions. Deep navy `#00053D` for the hero areas (sign in, clock card). Orange `#FF6D1F` only for "New meeting", as in the Workplace home (ref 4).
- **Shapes.** Workplace uses soft, large corners. Cards use 20px. Home action tiles are 64 to 80px squircles.
- **Dashboard.** It follows the Zoom desktop home: four big actions on the left, a clock card with upcoming meetings on the right. A recent meetings table sits below. The top bar has search, notifications, settings and the profile menu. The left rail has icon-over-label items, like the Workplace client.
- **Pre-join.** Zoom's dark preview frame (ref 3) in the Google Meet two-column layout (ref 8). This puts the meeting name, the people already in the call and the Join button next to the preview.
- **Meeting room.** Zoom's toolbar layout (ref 1): audio and video on the left, tools in the center, End on the right. The active speaker gets a green ring. Muted people get a red mic in the name tag. People with video off show their name in large text, as in Zoom.
- **Host controls.** In the participants panel, a host sees "Mute" or "Ask to unmute" and a "More" menu (Remove) on hover. On phone these buttons are always visible because there is no hover. "Mute all" opens a confirm dialog with "Allow participants to unmute themselves", as in Zoom.
- **Meeting info.** The title in the room top bar opens a popover with the meeting ID, host, passcode and invite link. It has "Copy link" and "Copy invitation" buttons. The "Invite" button in the participants panel opens the same popover.
- **Access setting.** The schedule form uses two radio cards: "Allow guests" and "Verified users only". This matches `meetings.access` in `docs/architecture.md`.

## Tokens

All colors, radii, spacing, shadows, fonts and motion are in `src/styles/tokens.css`.
Tailwind v4 reads its config from the `@theme` block in that file, so the tokens file is also the Tailwind config. There is no `tailwind.config.js` in Tailwind v4.
The default Tailwind color palette is reset (`--color-*: initial`). A class like `bg-blue-500` does not exist. Components can only use token colors such as `bg-brand`, `text-ink-2` or `bg-room-3`.

## Screens and routes

| Brief screen | Route | Notes |
|---|---|---|
| 1. Sign in | `/signin` | Google button and "Continue as demo user". Both go to `/` (mock). |
| 2. Dashboard | `/` | Top bar, left rail (bottom tabs on phone), New meeting, Join, Schedule, Share screen, Upcoming, Recent. |
| 3. Join | `/join`, `/j/{code}` | Meeting ID or link, name, passcode. Live lookup against mock meetings. Try `841 209 3375`. |
| 4. Schedule | `/schedule` | Title, description, date, time, duration, time zone, access, passcode. Validation and a success state. |
| 5. Pre-join | `/meeting/{code}` | Camera preview frame, mic and video toggles, device pickers, name, Join. |
| 6. Meeting room | `/meeting/{code}?stage=room` | Grid, self view, control bar, participants panel with host controls, chat, reactions, meeting info popover, leave and end. |
| 7. Responsive | all | Checked at 1440x900, 834x1112 and 390x844. See `screenshots/`. |

Extra query options for the room (mock only): `panel=participants` or `panel=chat` opens a side panel. `mic=off` and `cam=off` set the start state.

## States and small details

- Focus rings on every control (`focus-ring` and `focus-ring-room` utilities in the tokens file).
- Hover and active states on buttons, rows, tiles and menu items.
- Copy buttons change to "Copied" with a check icon for 2 seconds.
- Keyboard: Alt+A mutes and unmutes. Alt+V starts and stops video. Escape closes popovers and dialogs.
- Unread dot on Chat. Count bubble on Participants. Hand raised badge on tiles and in the panel.
- Toast messages after host actions ("Everyone is muted").
- Screen share banner and a "left the meeting" screen with Rejoin.
- `prefers-reduced-motion` turns animations off.
