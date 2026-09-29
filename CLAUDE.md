# Zoom Clone (Scaler SDE Fullstack Assignment)

Source brief: `ASSIGNMENT.pdf`. Stack: Next.js (frontend), FastAPI (backend), SQLite.

## Roles
- The lead session is the reviewer. It makes core system-design decisions, spawns Sonnet 5.5 workers, reviews each PR, and merges to `main`.
- A worker owns one task. It works on its own branch and opens one PR. It never merges its own PR.

## Rules for workers
- Read this file and the task ticket before you start.
- For any UI work, use the `lazyweb` MCP tools and the `lazyweb` skill to find real product evidence before you design.
- Use the `fastapi` skill for backend code. Use the `vercel-react-best-practices` skill for frontend code.
- Write commit messages and PR text in simple, short sentences. Do not add AI attribution lines.
- Keep code modular. The author must be able to explain every line.
- Run the tests and the linter before you open the PR. State the result in the PR.

## Task routing (model and effort)
- Allowed models: Sonnet 5.5 and Opus 5.5 only. Do not use any other model.
- Lowest allowed effort: medium. Never use low.
- Simple, well-scoped task: agent type `worker-simple` (Sonnet 5.5, high effort).
- Complex task, or any design task: agent type `worker-complex` (Opus 5.5, high effort).
- The lead may raise the effort for a hard task. The lead may not go below medium.
