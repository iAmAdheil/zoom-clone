# Zoom clone mockup: Design C

Static Next.js + Tailwind mockup. Mock data only. No backend.

## Run

```bash
npm install
npm run dev      # http://localhost:3000
npm run build
npm run lint
```

## Routes

| Route | Screen |
|---|---|
| `/signin` | Sign in |
| `/` | Dashboard |
| `/join`, `/j/{code}` | Join |
| `/schedule` | Schedule form |
| `/meeting/{code}` | Pre-join preview, then the room |
| `/meeting/{code}?stage=room` | Room without the preview |
| `/meeting/{code}?stage=room&panel=participants` | Room with a panel open (`participants` or `chat`) |

Try meeting ID `812 345 6789` on the join page.

## Files

- Tokens and Tailwind config: `src/styles/tokens.css`
- Mock data: `src/lib/mock.ts`
- Research and decisions: `DESIGN_NOTES.md`
- Screenshots: `screenshots/`
