// Mock data only. There is no backend in this mockup.
// "Now" is fixed so the server render and the browser render match.

import type { ChatMessage, Meeting, Participant, User } from "./types";

export const MOCK_NOW = "2026-09-30T04:30:00Z"; // 10:00 in Asia/Kolkata
export const DISPLAY_TIMEZONE = "Asia/Kolkata";
export const INVITE_ORIGIN = "https://zoom-clone.app";

export const demoUser: User = {
  id: 1,
  email: "demo@zoom-clone.app",
  name: "Demo User",
  avatar_url: null,
  is_demo: true,
};

const priya: User = {
  id: 2,
  email: "priya@example.com",
  name: "Priya Nair",
  avatar_url: null,
  is_demo: false,
};
const marco: User = {
  id: 3,
  email: "marco@example.com",
  name: "Marco Rossi",
  avatar_url: null,
  is_demo: false,
};

function meeting(partial: Partial<Meeting> & Pick<Meeting, "id" | "meeting_code" | "title">): Meeting {
  return {
    description: null,
    type: "scheduled",
    status: "scheduled",
    access: "allow_guests",
    passcode: null,
    scheduled_start: null,
    duration_min: 30,
    timezone: DISPLAY_TIMEZONE,
    started_at: null,
    ended_at: null,
    host: demoUser,
    invite_link: `${INVITE_ORIGIN}/j/${partial.meeting_code}`,
    ...partial,
  };
}

export const upcomingMeetings: Meeting[] = [
  meeting({
    id: 11,
    meeting_code: "8123456789",
    title: "Design review: Zoom clone",
    description: "Compare designs A, B and C. Pick one.",
    scheduled_start: "2026-09-30T05:30:00Z",
    duration_min: 45,
    access: "verified_only",
    passcode: "4F7k2q",
  }),
  meeting({
    id: 12,
    meeting_code: "7340019922",
    title: "Backend sync",
    scheduled_start: "2026-09-30T09:00:00Z",
    duration_min: 30,
  }),
  meeting({
    id: 13,
    meeting_code: "9051237745",
    title: "Weekly team standup",
    description: "Status, blockers, next steps.",
    scheduled_start: "2026-10-01T04:00:00Z",
    duration_min: 15,
  }),
  meeting({
    id: 14,
    meeting_code: "6610048271",
    title: "Customer demo with Acme",
    scheduled_start: "2026-10-02T10:30:00Z",
    duration_min: 60,
    access: "verified_only",
    passcode: "acme22",
  }),
];

export const recentMeetings: Meeting[] = [
  meeting({
    id: 21,
    meeting_code: "5512098833",
    title: "Sprint planning",
    status: "ended",
    started_at: "2026-09-29T05:02:00Z",
    ended_at: "2026-09-29T05:49:00Z",
    duration_min: 47,
  }),
  meeting({
    id: 22,
    meeting_code: "4420017765",
    title: "Instant meeting",
    type: "instant",
    status: "ended",
    started_at: "2026-09-28T11:15:00Z",
    ended_at: "2026-09-28T11:27:00Z",
    duration_min: 12,
  }),
  meeting({
    id: 23,
    meeting_code: "3309981276",
    title: "API contract walkthrough",
    status: "ended",
    host: priya,
    started_at: "2026-09-26T09:30:00Z",
    ended_at: "2026-09-26T10:20:00Z",
    duration_min: 50,
  }),
  meeting({
    id: 24,
    meeting_code: "2208874410",
    title: "Hiring loop debrief",
    status: "ended",
    host: marco,
    access: "verified_only",
    started_at: "2026-09-24T12:00:00Z",
    ended_at: "2026-09-24T12:25:00Z",
    duration_min: 25,
  }),
];

// The meeting that the room and pre-join screens show.
export const liveMeeting: Meeting = meeting({
  id: 31,
  meeting_code: "8123456789",
  title: "Design review: Zoom clone",
  status: "live",
  access: "verified_only",
  passcode: "4F7k2q",
  started_at: "2026-09-30T05:30:00Z",
  duration_min: 45,
});

export const SELF_ID = 1;

export const roomParticipants: Participant[] = [
  {
    id: SELF_ID,
    display_name: "Demo User",
    role: "host",
    is_muted: false,
    is_video_off: false,
    joined_at: "2026-09-30T05:30:00Z",
    user_id: 1,
  },
  {
    id: 2,
    display_name: "Priya Nair",
    role: "co_host",
    is_muted: false,
    is_video_off: false,
    joined_at: "2026-09-30T05:30:40Z",
    user_id: 2,
  },
  {
    id: 3,
    display_name: "Marco Rossi",
    role: "attendee",
    is_muted: true,
    is_video_off: false,
    joined_at: "2026-09-30T05:31:05Z",
    user_id: 3,
  },
  {
    id: 4,
    display_name: "Aiko Tanaka",
    role: "attendee",
    is_muted: true,
    is_video_off: true,
    joined_at: "2026-09-30T05:31:20Z",
    user_id: 4,
  },
  {
    id: 5,
    display_name: "Sam Lee",
    role: "attendee",
    is_muted: false,
    is_video_off: false,
    joined_at: "2026-09-30T05:32:00Z",
    user_id: null,
  },
  {
    id: 6,
    display_name: "Jane Okafor",
    role: "attendee",
    is_muted: true,
    is_video_off: true,
    joined_at: "2026-09-30T05:33:10Z",
    user_id: null,
  },
];

// The participant who is "speaking" in the mock room.
export const ACTIVE_SPEAKER_ID = 2;

export const chatMessages: ChatMessage[] = [
  {
    id: 1,
    from: "Priya Nair",
    text: "Morning all. I shared the three PR links in the doc.",
    at: "2026-09-30T05:31:00Z",
  },
  {
    id: 2,
    from: "Marco Rossi",
    text: "Design C room looks closest to the real client to me.",
    at: "2026-09-30T05:32:30Z",
  },
  { id: 3, from: "Sam Lee", text: "Can we check the phone layout next?", at: "2026-09-30T05:33:45Z" },
];

// Public lookup for the join page (GET /api/meetings/{code}).
export type MeetingLookup = {
  meeting_code: string;
  title: string;
  host_name: string;
  status: Meeting["status"];
  access: Meeting["access"];
  requires_passcode: boolean;
};

export function lookupMeeting(code: string): MeetingLookup | null {
  const digits = code.replace(/\D/g, "");
  const all = [liveMeeting, ...upcomingMeetings, ...recentMeetings];
  const found = all.find((m) => m.meeting_code === digits);
  if (!found) return null;
  return {
    meeting_code: found.meeting_code,
    title: found.title,
    host_name: found.host.name,
    status: found.status,
    access: found.access,
    requires_passcode: found.passcode !== null,
  };
}
