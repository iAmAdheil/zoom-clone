// Types copy the shapes in docs/api.md, so the real frontend can reuse them.

export type User = {
  id: number;
  email: string;
  name: string;
  avatar_url: string | null;
  is_demo: boolean;
};

export type MeetingAccess = "verified_only" | "allow_guests";
export type MeetingStatus = "scheduled" | "live" | "ended";
export type MeetingType = "instant" | "scheduled";

export type Meeting = {
  id: number;
  meeting_code: string; // 10 digits, no spaces
  title: string;
  description: string | null;
  type: MeetingType;
  status: MeetingStatus;
  access: MeetingAccess;
  passcode: string | null;
  scheduled_start: string | null; // UTC ISO-8601
  duration_min: number | null;
  timezone: string;
  started_at: string | null;
  ended_at: string | null;
  host: User;
  invite_link: string;
};

export type ParticipantRole = "host" | "co_host" | "attendee";

export type Participant = {
  id: number;
  display_name: string;
  role: ParticipantRole;
  is_muted: boolean;
  is_video_off: boolean;
  joined_at: string;
  user_id: number | null;
};

export type ChatMessage = {
  id: number;
  from: string;
  text: string;
  at: string;
};
