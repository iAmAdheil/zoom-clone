import { ApiError } from "./api";
import { roomSocketUrl } from "./config";
import type { ClientEvent, ServerEvent } from "./types";

// One meeting WebSocket with reconnect. React does not appear here: useRoom creates one
// RoomSocket per room and reads its events and status. The rules come from docs/api.md.

/**
 * - connecting: the first socket is opening.
 * - live: the server sent the snapshot.
 * - reconnecting: the socket dropped. A new ticket and a new socket are on the way.
 * - failed: the reconnect gave up after MAX_ATTEMPTS, or the server refused the socket.
 * - removed, ended, left: final. The server closed the socket for a known reason.
 */
export type RoomStatus = "connecting" | "live" | "reconnecting" | "failed" | "removed" | "ended" | "left";

type RoomSocketOptions = {
  code: string;
  onEvent: (event: ServerEvent) => void;
  onStatus: (status: RoomStatus) => void;
  /** Calls `join` again with the rejoin token and returns the new ws_ticket. */
  renewTicket: () => Promise<string>;
};

/** Wait 1s, 2s, 4s, 8s, 16s before each try. Then stop. */
const MAX_ATTEMPTS = 5;
const BASE_DELAY_MS = 1000;

// A ticket works once (docs/api.md). A second RoomSocket in this tab, for example after a
// Fast Refresh, must not send a ticket that an earlier socket already sent.
const sentTickets = new Set<string>();

/** Close codes that end the room for good. Other codes mean "reconnect". */
function finalStatus(code: number, reason: string): RoomStatus | null {
  if (code === 1000) return "left"; // This participant sent `leave`, maybe from another tab.
  if (code === 4410) return "ended";
  if (code === 4403) return reason === "removed_from_meeting" ? "removed" : "failed";
  if (code === 4404) return "failed";
  return null; // 4401 (bad or used ticket) and network drops: get a new ticket and try again.
}

/** Join errors that end the room for good. Other errors mean "try again later". */
function finalJoinStatus(error: unknown): RoomStatus | null {
  if (!(error instanceof ApiError)) return null;
  if (error.code === "removed_from_meeting") return "removed";
  if (error.code === "meeting_ended") return "ended";
  if (error.status === 403 || error.status === 404) return "failed";
  return null;
}

export class RoomSocket {
  private readonly options: RoomSocketOptions;
  private ws: WebSocket | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private attempts = 0;
  /** True after the snapshot of the current socket. useRoom sends my state at that point. */
  private ready = false;
  /** True after dispose() or a final status. No event or reconnect happens after that. */
  private stopped = false;

  constructor(options: RoomSocketOptions) {
    this.options = options;
  }

  /** Opens the first socket. A ticket that this tab sent before is replaced at once. */
  start(ticket: string) {
    this.options.onStatus("connecting");
    if (sentTickets.has(ticket)) this.reconnect(0, "connecting");
    else this.open(ticket);
  }

  /** Sends an event. Returns false before the snapshot or when the socket is closed. */
  send(event: ClientEvent): boolean {
    if (!this.ready || this.ws?.readyState !== WebSocket.OPEN) return false;
    this.ws.send(JSON.stringify(event));
    return true;
  }

  /** Sends `leave` and closes the socket. The server then tells the others. */
  leave() {
    this.send({ type: "leave" });
    this.dispose();
  }

  /** After "failed": start again with a full set of tries. */
  retry() {
    this.stopped = false;
    this.attempts = 0;
    this.reconnect(0);
  }

  /** Closes the socket and cancels a pending reconnect. Safe to call more than once. */
  dispose() {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    const ws = this.ws;
    this.ws = null;
    this.ready = false;
    // close() sends the queued data (for example `leave`) before the close frame.
    if (ws && ws.readyState <= WebSocket.OPEN) ws.close(1000);
  }

  private finish(status: RoomStatus) {
    this.dispose();
    this.options.onStatus(status);
  }

  private open(ticket: string) {
    sentTickets.add(ticket);
    this.ready = false;
    const ws = new WebSocket(roomSocketUrl(this.options.code, ticket));
    this.ws = ws;

    ws.onmessage = (message) => {
      if (this.ws !== ws) return;
      let event: ServerEvent;
      try {
        event = JSON.parse(String(message.data)) as ServerEvent;
      } catch {
        return;
      }
      if (event.type === "snapshot") {
        this.attempts = 0;
        this.ready = true;
        this.options.onStatus("live");
      }
      this.options.onEvent(event);
      // The server closes the socket next. Stop now, so the close does not start a reconnect.
      if (event.type === "you_were_removed") this.finish("removed");
      if (event.type === "meeting_ended") this.finish("ended");
    };

    ws.onclose = (event) => {
      if (this.ws !== ws || this.stopped) return;
      this.ws = null;
      this.ready = false;
      const status = finalStatus(event.code, event.reason);
      if (status) this.finish(status);
      else this.reconnect();
    };
  }

  /** Waits (1s, 2s, 4s, ...), gets a new ticket with `join`, then opens a new socket. */
  private reconnect(delay?: number, status: "connecting" | "reconnecting" = "reconnecting") {
    if (this.stopped) return;
    if (this.attempts >= MAX_ATTEMPTS) {
      this.finish("failed");
      return;
    }
    const wait = delay ?? BASE_DELAY_MS * 2 ** this.attempts;
    this.attempts += 1;
    this.options.onStatus(status);

    this.timer = setTimeout(async () => {
      this.timer = null;
      let ticket: string;
      try {
        ticket = await this.options.renewTicket();
      } catch (error) {
        if (this.stopped) return;
        const status = finalJoinStatus(error);
        if (status) this.finish(status);
        else this.reconnect();
        return;
      }
      if (!this.stopped) this.open(ticket);
    }, wait);
  }
}
