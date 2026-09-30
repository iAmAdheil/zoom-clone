// Public settings. Next.js puts NEXT_PUBLIC_* values in the browser bundle at build time.

const WS_BASE = (process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000").replace(/\/+$/, "");

/** WebSocket URL of a meeting room (docs/api.md). The browser connects to it directly. */
export function roomSocketUrl(code: string, ticket: string): string {
  return `${WS_BASE}/ws/meetings/${encodeURIComponent(code)}?ticket=${encodeURIComponent(ticket)}`;
}

// Next.js replaces each process.env.NEXT_PUBLIC_* name only when the code writes it in full.
const TURN_URL = process.env.NEXT_PUBLIC_TURN_URL;
const TURN_USERNAME = process.env.NEXT_PUBLIC_TURN_USERNAME;
const TURN_CREDENTIAL = process.env.NEXT_PUBLIC_TURN_CREDENTIAL;

/**
 * ICE servers for every RTCPeerConnection (docs/webrtc-plan.md).
 * STUN always. TURN only when NEXT_PUBLIC_TURN_URL is set. It can hold more than one URL,
 * separated by commas (for example the UDP and the TCP URL of one TURN server).
 */
export function iceServers(): RTCIceServer[] {
  const servers: RTCIceServer[] = [{ urls: "stun:stun.l.google.com:19302" }];
  const turnUrls = (TURN_URL ?? "")
    .split(",")
    .map((url) => url.trim())
    .filter(Boolean);
  if (turnUrls.length > 0) {
    servers.push({ urls: turnUrls, username: TURN_USERNAME, credential: TURN_CREDENTIAL });
  }
  return servers;
}
