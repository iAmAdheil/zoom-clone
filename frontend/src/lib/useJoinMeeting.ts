"use client";

import { useState } from "react";
import { ApiError, api } from "./api";
import { meetingStore, rejoinTokens, type MeetingSession } from "./meetingStore";
import { passcodes } from "./storage";

type JoinArgs = {
  displayName: string;
  passcode?: string;
  micOn?: boolean;
  camOn?: boolean;
};

type JoinOutcome = { session: MeetingSession; error: null } | { session: null; error: ApiError };

/**
 * Calls POST /api/meetings/{code}/join and keeps the result:
 * the rejoin token goes to sessionStorage, the rest goes to the meeting store.
 * It sends the saved rejoin token, so a second join gives back the same participant row.
 */
export function useJoinMeeting() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  async function join(code: string, args: JoinArgs): Promise<JoinOutcome> {
    const digits = code.replace(/\D/g, "");
    // With no typed passcode, use the one that worked before for this meeting (reload, reconnect).
    const passcode = args.passcode?.trim() || passcodes.read(digits) || undefined;
    setPending(true);
    setError(null);
    try {
      const result = await api.join(digits, {
        display_name: args.displayName.trim(),
        passcode,
        rejoin_token: rejoinTokens.read(digits) ?? undefined,
      });
      rejoinTokens.write(digits, result.rejoin_token);
      if (passcode) passcodes.write(digits, passcode);
      const session: MeetingSession = {
        ...result,
        code: digits,
        passcode,
        micOn: args.micOn ?? true,
        camOn: args.camOn ?? true,
      };
      meetingStore.set(session);
      return { session, error: null };
    } catch (caught) {
      const failure =
        caught instanceof ApiError ? caught : new ApiError(0, "unknown", "Something went wrong. Try again.");
      // A saved passcode that the server refuses is stale. Drop it.
      if (failure.code === "bad_passcode") passcodes.write(digits, null);
      setError(failure);
      return { session: null, error: failure };
    } finally {
      setPending(false);
    }
  }

  return { join, pending, error, clearError: () => setError(null) };
}
