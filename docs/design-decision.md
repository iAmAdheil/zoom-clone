# Design decision

Three designs were built and scored on the rubric in `docs/design-brief.md` (10 points each, 50 total).

| Design | Zoom similarity | Tokens | Responsive | Completeness | Polish | Total |
|---|---|---|---|---|---|---|
| A: classic Zoom web client | 9 | 8 | 9 | 9 | 8 | 43 |
| B: Zoom Workplace | 8 | 9 | 8 | 9 | 9 | 43 |
| C: evidence-led | 7 | 8 | 8 | 8 | 7 | 38 |

Note: B ties on the total, but the brief's first rule is "exactly like Zoom". A wins the tie on similarity.

**Chosen: Design A** (`designs/a`). Designs B and C stay on their branches (`design/b-workplace`, `design-c`) for reference.

## Ideas to take from B and C into the final frontend
- Access badges on meeting rows (`Verified only`, `Guests allowed`), from B and C.
- Copy-invite button on upcoming and recent rows (B).
- Hand-raised badge and recording dot in the room (B).

## Frontend plan
The frontend worker moves `designs/a` to `frontend/`, replaces `src/lib/mock.ts` with the API client from `docs/api.md`, and deletes `designs/`.
