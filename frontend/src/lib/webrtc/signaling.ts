// The `data` of a WebSocket `signal` event (docs/api.md). The server relays it and never
// reads it, so the frontend owns this format. Every message carries `sid`: a random id of the
// sender's page. A reload makes a new page, so the other side can tell an old peer connection
// from a new one for the same participant id.

/**
 * - hello: "I am here, call me". A client sends it after each snapshot (see peerManager.ts).
 *   `peerSid` is the receiver's sid when the sender still has a working connection to it.
 * - offer: `fresh` is true for a new peer connection, false for an ICE restart.
 * - answer, ice: the usual WebRTC offer/answer and ICE candidate exchange.
 */
export type SignalData =
  | { kind: "hello"; sid: string; peerSid: string | null }
  | { kind: "offer"; sid: string; sdp: string; fresh: boolean }
  | { kind: "answer"; sid: string; sdp: string }
  | { kind: "ice"; sid: string; candidate: RTCIceCandidateInit };

/** Sends one signal to one participant. Returns false when the socket cannot send now. */
export type SendSignal = (to: number, data: SignalData) => boolean;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isOptional(value: unknown, type: "string" | "number"): boolean {
  return value === undefined || value === null || typeof value === type;
}

function parseCandidate(value: unknown): RTCIceCandidateInit | null {
  if (!isRecord(value) || typeof value.candidate !== "string") return null;
  if (!isOptional(value.sdpMid, "string") || !isOptional(value.sdpMLineIndex, "number")) return null;
  if (!isOptional(value.usernameFragment, "string")) return null;
  return {
    candidate: value.candidate,
    sdpMid: (value.sdpMid as string | null | undefined) ?? null,
    sdpMLineIndex: (value.sdpMLineIndex as number | null | undefined) ?? null,
    usernameFragment: (value.usernameFragment as string | null | undefined) ?? null,
  };
}

/**
 * Checks the `data` of a received `signal`. Returns null for a message that has a wrong shape.
 * Another client wrote it, so the app does not trust it.
 */
export function parseSignal(data: unknown): SignalData | null {
  if (!isRecord(data) || typeof data.sid !== "string" || data.sid === "") return null;
  const sid = data.sid;
  switch (data.kind) {
    case "hello":
      if (!isOptional(data.peerSid, "string")) return null;
      return { kind: "hello", sid, peerSid: (data.peerSid as string | null | undefined) ?? null };
    case "offer":
      if (typeof data.sdp !== "string" || typeof data.fresh !== "boolean") return null;
      return { kind: "offer", sid, sdp: data.sdp, fresh: data.fresh };
    case "answer":
      if (typeof data.sdp !== "string") return null;
      return { kind: "answer", sid, sdp: data.sdp };
    case "ice": {
      const candidate = parseCandidate(data.candidate);
      return candidate ? { kind: "ice", sid, candidate } : null;
    }
    default:
      return null;
  }
}
