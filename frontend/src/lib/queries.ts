"use client";

import useSWR, { mutate } from "swr";
import { ApiError, api } from "./api";
import type { Meeting, MeetingLookup, User } from "./types";

// SWR hooks for the data that more than one component reads.
// SWR shares one request per key, so the header and the page can both call useMe().

export const keys = {
  me: "/me",
  upcoming: "/meetings/upcoming",
  recent: "/meetings/recent",
  lookup: (code: string) => `/meetings/${code}`,
} as const;

/** The signed-in user, or null for a guest. A 401 is a normal answer here, not an error. */
async function fetchMe(): Promise<User | null> {
  try {
    return await api.me();
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null;
    throw error;
  }
}

export function useMe() {
  return useSWR<User | null>(keys.me, fetchMe, { revalidateOnFocus: false });
}

export function useUpcomingMeetings() {
  return useSWR<Meeting[]>(keys.upcoming, api.upcoming);
}

export function useRecentMeetings() {
  return useSWR<Meeting[]>(keys.recent, () => api.recent(20));
}

/** Public lookup for the join page. Pass null to skip the request (no full code yet). */
export function useMeetingLookup(code: string | null) {
  return useSWR<MeetingLookup>(code ? keys.lookup(code) : null, () => api.lookup(code!), {
    shouldRetryOnError: false,
    revalidateOnFocus: false,
  });
}

/** Reloads both dashboard lists (after a new or changed meeting). */
export function refreshMeetingLists() {
  return Promise.all([mutate(keys.upcoming), mutate(keys.recent)]);
}

/** Drops every cached response. Used at sign out, so the next user sees no old data. */
export function clearCache() {
  return mutate(() => true, undefined, { revalidate: false });
}
