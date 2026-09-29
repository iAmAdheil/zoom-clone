import type { ChatMessage, Meeting, Participant, User } from "./types";

// All data in Design A is mock data. Nothing calls a backend.

// A fixed "now" keeps server and client renders the same (no hydration mismatch).
export const MOCK_NOW = "2026-09-30T04:54:00Z"; // 10:24 AM in Asia/Kolkata
export const MOCK_TIMEZONE = "Asia/Kolkata";

export const demoUser: User = {
  id: 1,
  email: "demo@zoomclone.dev",
  name: "Alex Morgan",
  avatar_url: null,
  is_demo: true,
};

const priya: User = {
  id: 2,
  email: "priya@zoomclone.dev",
  name: "Priya Sharma",
  avatar_url: null,
  is_demo: false,
};

function inviteLink(code: string, passcode: string | null) {
  const pwd = passcode ? `?pwd=${passcode}` : "";
  return `https://zoomclone.dev/j/${code}${pwd}`;
}

function meeting(partial: Omit<Meeting, "invite_link">): Meeting {
  return { ...partial, invite_link: inviteLink(partial.meeting_code, partial.passcode) };
}

export const upcomingMeetings: Meeting[] = [
  meeting({
    id: 11,
    meeting_code: "8123456790",
    title: "Design review: meeting room",
    description: "Walk through the new video grid and host controls.",
    type: "scheduled",
    status: "scheduled",
    access: "allow_guests",
    passcode: "Zm7q2X",
    scheduled_start: "2026-09-30T06:30:00Z",
    duration_min: 45,
    timezone: MOCK_TIMEZONE,
    started_at: null,
    ended_at: null,
    host: demoUser,
  }),
  meeting({
    id: 12,
    meeting_code: "8129075531",
    title: "Weekly sync with backend team",
    description: null,
    type: "scheduled",
    status: "scheduled",
    access: "verified_only",
    passcode: null,
    scheduled_start: "2026-09-30T09:30:00Z",
    duration_min: 30,
    timezone: MOCK_TIMEZONE,
    started_at: null,
    ended_at: null,
    host: demoUser,
  }),
  meeting({
    id: 13,
    meeting_code: "8120448726",
    title: "1:1 Alex / Priya",
    description: "Career check-in.",
    type: "scheduled",
    status: "scheduled",
    access: "verified_only",
    passcode: "4Rt9Kp",
    scheduled_start: "2026-10-01T05:00:00Z",
    duration_min: 30,
    timezone: MOCK_TIMEZONE,
    started_at: null,
    ended_at: null,
    host: demoUser,
  }),
];

export const recentMeetings: Meeting[] = [
  meeting({
    id: 7,
    meeting_code: "8127734410",
    title: "Sprint planning",
    description: null,
    type: "scheduled",
    status: "ended",
    access: "allow_guests",
    passcode: "p1an9S",
    scheduled_start: "2026-09-29T04:30:00Z",
    duration_min: 60,
    timezone: MOCK_TIMEZONE,
    started_at: "2026-09-29T04:31:00Z",
    ended_at: "2026-09-29T05:26:00Z",
    host: demoUser,
  }),
  meeting({
    id: 6,
    meeting_code: "8125501298",
    title: "Customer demo: Acme Corp",
    description: null,
    type: "scheduled",
    status: "ended",
    access: "allow_guests",
    passcode: "Ac4Me1",
    scheduled_start: "2026-09-28T10:00:00Z",
    duration_min: 30,
    timezone: MOCK_TIMEZONE,
    started_at: "2026-09-28T10:02:00Z",
    ended_at: "2026-09-28T10:41:00Z",
    host: priya,
  }),
  meeting({
    id: 5,
    meeting_code: "8126610042",
    title: "Alex Morgan's Zoom Meeting",
    description: null,
    type: "instant",
    status: "ended",
    access: "allow_guests",
    passcode: null,
    scheduled_start: null,
    duration_min: null,
    timezone: MOCK_TIMEZONE,
    started_at: "2026-09-26T08:15:00Z",
    ended_at: "2026-09-26T08:37:00Z",
    host: demoUser,
  }),
  meeting({
    id: 4,
    meeting_code: "8121187765",
    title: "Hiring debrief",
    description: null,
    type: "scheduled",
    status: "ended",
    access: "verified_only",
    passcode: null,
    scheduled_start: "2026-09-25T11:30:00Z",
    duration_min: 30,
    timezone: MOCK_TIMEZONE,
    started_at: "2026-09-25T11:30:00Z",
    ended_at: "2026-09-25T12:04:00Z",
    host: priya,
  }),
];

/** Meeting that a new instant meeting (and any unknown code) uses in the mockup. */
export const instantMeeting: Meeting = meeting({
  id: 20,
  meeting_code: "8124417096",
  title: "Alex Morgan's Zoom Meeting",
  description: null,
  type: "instant",
  status: "live",
  access: "allow_guests",
  passcode: "8Hx3Qe",
  scheduled_start: null,
  duration_min: null,
  timezone: MOCK_TIMEZONE,
  started_at: MOCK_NOW,
  ended_at: null,
  host: demoUser,
});

const allMeetings = [...upcomingMeetings, ...recentMeetings, instantMeeting];

/** Mock of GET /api/meetings/{code}. Accepts digits with or without spaces. */
export function findMeeting(code: string): Meeting | undefined {
  const digits = code.replace(/\D/g, "");
  return allMeetings.find((m) => m.meeting_code === digits);
}

export const SELF_ID = 1;

export const participants: Participant[] = [
  { id: SELF_ID, display_name: demoUser.name, role: "host", is_muted: false, is_video_off: false, joined_at: MOCK_NOW, user_id: 1 },
  { id: 2, display_name: "Priya Sharma", role: "co_host", is_muted: false, is_video_off: false, joined_at: MOCK_NOW, user_id: 2 },
  { id: 3, display_name: "Jordan Lee", role: "attendee", is_muted: true, is_video_off: true, joined_at: MOCK_NOW, user_id: 3 },
  { id: 4, display_name: "Wei Chen", role: "attendee", is_muted: true, is_video_off: false, joined_at: MOCK_NOW, user_id: 4 },
  { id: 5, display_name: "Maria Garcia", role: "attendee", is_muted: false, is_video_off: false, joined_at: MOCK_NOW, user_id: null },
  { id: 6, display_name: "Sam Carter", role: "attendee", is_muted: true, is_video_off: true, joined_at: MOCK_NOW, user_id: null },
];

/** The participant who talks now in the mockup (gets the active speaker frame). */
export const ACTIVE_SPEAKER_ID = 2;

export const chatMessages: ChatMessage[] = [
  { id: 1, from: "Priya Sharma", to: "Everyone", sent_at: "2026-09-30T04:55:00Z", text: "Morning all! Sharing the agenda in a sec." },
  { id: 2, from: "Wei Chen", to: "Everyone", sent_at: "2026-09-30T04:56:00Z", text: "My mic is acting up, I will type here." },
  { id: 3, from: "Maria Garcia", to: "Everyone", sent_at: "2026-09-30T04:57:00Z", text: "Joined as a guest from the invite link, works fine." },
];

export const REACTIONS = ["👏", "👍", "❤️", "😂", "😮", "🎉"] as const;

/** Meeting for the /meeting/[code] route. Unknown codes get a copy of the instant meeting. */
export function meetingForCode(code: string): Meeting {
  const found = findMeeting(code);
  if (found) return found;
  const digits = code.replace(/\D/g, "") || instantMeeting.meeting_code;
  return { ...instantMeeting, meeting_code: digits, invite_link: inviteLink(digits, instantMeeting.passcode) };
}
