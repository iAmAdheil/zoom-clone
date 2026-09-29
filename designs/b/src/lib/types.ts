// Types follow docs/api.md so the real API can replace the mock data later.

export type User = {
  id: number;
  email: string;
  name: string;
  avatar_url: string | null;
  is_demo: boolean;
};

export type MeetingAccess = "verified_only" | "allow_guests";
export type MeetingType = "instant" | "scheduled";
export type MeetingStatus = "scheduled" | "live" | "ended";

export type Meeting = {
  id: number;
  meeting_code: string;
  title: string;
  description: string | null;
  type: MeetingType;
  status: MeetingStatus;
  access: MeetingAccess;
  passcode: string | null;
  scheduled_start: string | null;
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

/** Avatar color index. Maps to the `tone-*` tokens. */
export type Tone = 1 | 2 | 3 | 4 | 5 | 6;

/** UI-only fields for the mock meeting room. */
export type RoomParticipant = Participant & {
  tone: Tone;
  is_self?: boolean;
  is_speaking?: boolean;
  hand_raised?: boolean;
};

export type ChatMessage = {
  id: number;
  author: string;
  tone: Tone;
  text: string;
  sent_at: string;
  is_self?: boolean;
};
