"use client";

import { useSyncExternalStore } from "react";
import { readStorage, writeStorage } from "./storage";
import type { JoinResult } from "./types";

// A small in-memory store for the meeting that this tab joined.
// It keeps the join response (participant, ws_ticket, meeting) between the join page,
// the pre-join preview and the room. A page reload clears it; the rejoin token survives
// in sessionStorage, so the next join gives back the same participant row.

export type MeetingSession = JoinResult & {
  /** The 10-digit meeting code. */
  code: string;
  /** The passcode that worked. A rejoin must send it again (docs/api.md). */
  passcode?: string;
  /** Microphone and camera choice from the preview. */
  micOn: boolean;
  camOn: boolean;
};

const sessions = new Map<string, MeetingSession>();
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

export const meetingStore = {
  get: (code: string) => sessions.get(code) ?? null,
  set(session: MeetingSession) {
    sessions.set(session.code, session);
    emit();
  },
  clearAll() {
    sessions.clear();
    emit();
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

/** The joined session for one meeting code, or null. Null during the server render. */
export function useMeetingSession(code: string): MeetingSession | null {
  return useSyncExternalStore(
    meetingStore.subscribe,
    () => meetingStore.get(code),
    () => null,
  );
}

/** Rejoin tokens live in sessionStorage, one per meeting code, so they die with the tab. */
export const rejoinTokens = {
  read: (code: string) => readStorage("session", `zc:rejoin:${code}`),
  write: (code: string, token: string) => writeStorage("session", `zc:rejoin:${code}`, token),
};
