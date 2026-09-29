# Design B: Zoom Workplace style

Static Next.js + Tailwind mockup of the Zoom web app. It uses mock data only. There is no backend.

## Run

```bash
npm install
npm run dev     # http://localhost:3000
npm run build
npm run lint
```

## Where things are

- `src/styles/tokens.css`: all design tokens. This is also the Tailwind v4 config.
- `src/lib/mock.ts`: mock data. `src/lib/types.ts`: types from `docs/api.md`.
- `src/components/ui/`: shared primitives (button, field, avatar, badge, card, switch, copy button).
- `src/components/layout/`, `dashboard/`, `join/`, `schedule/`, `meeting/`: screen parts.
- `DESIGN_NOTES.md`: lazyweb research and design decisions.
- `screenshots/`: every screen at desktop, tablet and phone sizes.

## Screens

- `/signin`
- `/` (dashboard)
- `/join` and `/j/{code}`
- `/schedule`
- `/meeting/{code}` (pre-join preview). Add `?stage=room` to open the room.
