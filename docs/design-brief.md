# Design brief (for the three design workers)

Goal: a static Next.js + Tailwind mockup of the full Zoom web app. The look and feel must match the real Zoom web client (dark meeting room, light dashboard).

## Screens (all required, with mock data, no backend)
1. Sign in (Google button, "Continue as demo user").
2. Dashboard: top navbar with profile and settings placeholders, left nav, New Meeting, Join, Schedule buttons, Upcoming list, Recent list.
3. Join screen: meeting ID or link, display name, passcode.
4. Schedule form: title, description, date and time pickers, duration, access setting (verified only / allow guests), passcode.
5. Pre-join preview: camera preview frame, mute and video toggles, join button.
6. Meeting room: video grid with participant tiles, self view, bottom control bar (mute, video, participants, chat, share, reactions, leave), participants side panel with host controls (mute, remove, mute all), meeting info and invite link popover.
7. Responsive: desktop, tablet, phone.

## Rules
- Before designing, use the lazyweb MCP tools (`lazyweb_search_screens`, `lazyweb_search_flows`) and the `lazyweb` skill. Search for Zoom, Google Meet and Microsoft Teams screens. Record the screens you used in `DESIGN_NOTES.md`.
- Study the reference screenshots in `docs/reference/` if the folder has them.
- Put all colors, radii, spacing and fonts in one tokens file (`src/styles/tokens.css` plus the Tailwind config).
- Each worker builds a different visual direction of the same Zoom look:
  - Design A: closest possible copy of the current Zoom web client.
  - Design B: Zoom look with the newer Zoom Workplace styling.
  - Design C: your own best reading of the brief, guided by the lazyweb evidence.
- Do not add a backend. Use mock data in `src/lib/mock.ts`.
- Work in `designs/<a|b|c>/` inside your branch, as a standalone Next.js app. Open one PR. Do not merge it.

## How the lead scores the designs (10 points each)
Zoom similarity (dashboard, room), component reuse and token discipline, responsive quality, completeness of the 7 screens, and polish of small details (states, focus rings, hover).
