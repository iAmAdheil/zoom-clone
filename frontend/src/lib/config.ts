// Public settings. Next.js puts NEXT_PUBLIC_* values in the browser bundle at build time.

const WS_BASE = (process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000").replace(/\/+$/, "");

/** WebSocket URL of a meeting room (docs/api.md). The browser connects to it directly. */
export function roomSocketUrl(code: string, ticket: string): string {
  return `${WS_BASE}/ws/meetings/${encodeURIComponent(code)}?ticket=${encodeURIComponent(ticket)}`;
}
