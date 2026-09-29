// Mock data only. No backend calls. Shapes match docs/api.md.
import type { ChatMessage, Meeting, RoomParticipant, User } from "./types";

/** The time zone the mock UI uses to show times. */
export const DISPLAY_TIMEZONE = "Asia/Kolkata";

export const demoUser: User = {
  id: 1,
  email: "demo@zoomclone.dev",
  name: "Aarav Mehta",
  avatar_url: null,
  is_demo: true,
};

const priya: User = {
  id: 2,
  email: "priya@zoomclone.dev",
  name: "Priya Nair",
  avatar_url: null,
  is_demo: false,
};

const origin = "https://zoomclone.dev";

function meeting(
  partial: Omit<Meeting, "invite_link" | "timezone" | "host" | "description"> & {
    host?: User;
    description?: string | null;
  },
): Meeting {
  return {
    description: null,
    host: demoUser,
    timezone: DISPLAY_TIMEZONE,
    invite_link: `${origin}/j/${partial.meeting_code}`,
    ...partial,
  };
}

export const upcomingMeetings: Meeting[] = [
  meeting({
    id: 101,
    meeting_code: "8412093375",
    title: "Design review: Workplace refresh",
    description: "Walk through the new dashboard and meeting room.",
    type: "scheduled",
    status: "scheduled",
    access: "verified_only",
    passcode: "Wp7kQ2",
    scheduled_start: "2026-09-30T09:30:00Z",
    duration_min: 45,
    started_at: null,
    ended_at: null,
  }),
  meeting({
    id: 102,
    meeting_code: "5530182244",
    title: "Weekly sync with Platform team",
    type: "scheduled",
    status: "scheduled",
    access: "allow_guests",
    passcode: null,
    scheduled_start: "2026-09-30T11:00:00Z",
    duration_min: 30,
    started_at: null,
    ended_at: null,
  }),
  meeting({
    id: 103,
    meeting_code: "9021447760",
    title: "Candidate interview: Frontend",
    type: "scheduled",
    status: "scheduled",
    access: "verified_only",
    passcode: "Hr22xa",
    scheduled_start: "2026-10-01T05:00:00Z",
    duration_min: 60,
    host: priya,
    started_at: null,
    ended_at: null,
  }),
  meeting({
    id: 104,
    meeting_code: "3378120956",
    title: "Sprint planning",
    type: "scheduled",
    status: "scheduled",
    access: "allow_guests",
    passcode: "sp1nt9",
    scheduled_start: "2026-10-02T04:30:00Z",
    duration_min: 90,
    started_at: null,
    ended_at: null,
  }),
];

export const recentMeetings: Meeting[] = [
  meeting({
    id: 90,
    meeting_code: "7719203481",
    title: "Quick call with Priya",
    type: "instant",
    status: "ended",
    access: "allow_guests",
    passcode: null,
    scheduled_start: null,
    duration_min: null,
    started_at: "2026-09-29T12:10:00Z",
    ended_at: "2026-09-29T12:32:00Z",
  }),
  meeting({
    id: 89,
    meeting_code: "6620418834",
    title: "Customer onboarding: Acme Corp",
    type: "scheduled",
    status: "ended",
    access: "allow_guests",
    passcode: "acme01",
    scheduled_start: "2026-09-29T08:00:00Z",
    duration_min: 60,
    host: priya,
    started_at: "2026-09-29T08:02:00Z",
    ended_at: "2026-09-29T08:58:00Z",
  }),
  meeting({
    id: 88,
    meeting_code: "4410982275",
    title: "Architecture deep dive",
    type: "scheduled",
    status: "ended",
    access: "verified_only",
    passcode: "arch42",
    scheduled_start: "2026-09-28T10:00:00Z",
    duration_min: 90,
    started_at: "2026-09-28T10:01:00Z",
    ended_at: "2026-09-28T11:24:00Z",
  }),
  meeting({
    id: 87,
    meeting_code: "2208817734",
    title: "1:1 with Rohan",
    type: "instant",
    status: "ended",
    access: "verified_only",
    passcode: null,
    scheduled_start: null,
    duration_min: null,
    started_at: "2026-09-26T06:30:00Z",
    ended_at: "2026-09-26T06:55:00Z",
  }),
];

/** Participant counts for the recent list (mock only). */
export const recentAttendance: Record<number, number> = {
  90: 2,
  89: 7,
  88: 12,
  87: 2,
};

/** Meeting used by the pre-join screen and the meeting room. */
export const liveMeeting: Meeting = meeting({
  id: 120,
  meeting_code: "8412093375",
  title: "Design review: Workplace refresh",
  description: "Walk through the new dashboard and meeting room.",
  type: "scheduled",
  status: "live",
  access: "allow_guests",
  passcode: "Wp7kQ2",
  scheduled_start: "2026-09-30T09:30:00Z",
  duration_min: 45,
  started_at: "2026-09-30T09:31:00Z",
  ended_at: null,
});

export const roomParticipants: RoomParticipant[] = [
  {
    id: 1,
    display_name: "Aarav Mehta",
    role: "host",
    is_muted: false,
    is_video_off: false,
    joined_at: "2026-09-30T09:31:00Z",
    user_id: 1,
    tone: 1,
    is_self: true,
  },
  {
    id: 2,
    display_name: "Priya Nair",
    role: "co_host",
    is_muted: false,
    is_video_off: false,
    joined_at: "2026-09-30T09:31:20Z",
    user_id: 2,
    tone: 3,
    is_speaking: true,
  },
  {
    id: 3,
    display_name: "Rohan Das",
    role: "attendee",
    is_muted: true,
    is_video_off: false,
    joined_at: "2026-09-30T09:32:05Z",
    user_id: 3,
    tone: 2,
  },
  {
    id: 4,
    display_name: "Meera Iyer",
    role: "attendee",
    is_muted: true,
    is_video_off: true,
    joined_at: "2026-09-30T09:32:40Z",
    user_id: 4,
    tone: 4,
    hand_raised: true,
  },
  {
    id: 5,
    display_name: "Kabir Singh",
    role: "attendee",
    is_muted: false,
    is_video_off: false,
    joined_at: "2026-09-30T09:33:10Z",
    user_id: 5,
    tone: 5,
  },
  {
    id: 6,
    display_name: "Guest: Ana Lopez",
    role: "attendee",
    is_muted: true,
    is_video_off: true,
    joined_at: "2026-09-30T09:34:00Z",
    user_id: null,
    tone: 6,
  },
];

export const chatMessages: ChatMessage[] = [
  {
    id: 1,
    author: "Priya Nair",
    tone: 3,
    text: "The new home tiles look great. Can we try a darker toolbar?",
    sent_at: "2026-09-30T09:35:00Z",
  },
  {
    id: 2,
    author: "Rohan Das",
    tone: 2,
    text: "+1. Also the invite link popover should copy on one click.",
    sent_at: "2026-09-30T09:36:00Z",
  },
  {
    id: 3,
    author: "Aarav Mehta",
    tone: 1,
    text: "Done. Sharing the build in a minute.",
    sent_at: "2026-09-30T09:37:00Z",
    is_self: true,
  },
];

/** Find a mock meeting by its code, for the join screen lookup. */
export function findMeetingByCode(code: string): Meeting | undefined {
  const digits = code.replace(/\D/g, "");
  return [liveMeeting, ...upcomingMeetings, ...recentMeetings].find(
    (m) => m.meeting_code === digits,
  );
}
