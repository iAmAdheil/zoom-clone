"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, errorMessage } from "./api";
import { refreshMeetingLists } from "./queries";

/**
 * "New Meeting": creates a live instant meeting, then opens its preview page.
 * `start()` resolves to an error message, or to null when the page changes.
 */
export function useStartInstantMeeting() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function start(): Promise<string | null> {
    if (pending) return null;
    setPending(true);
    try {
      const meeting = await api.createInstant();
      void refreshMeetingLists();
      router.push(`/meeting/${meeting.meeting_code}`);
      // Keep `pending` true: the page changes next.
      return null;
    } catch (caught) {
      setPending(false);
      return errorMessage(caught);
    }
  }

  return { start, pending };
}
