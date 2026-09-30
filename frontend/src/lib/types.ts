// API shapes. Each type copies docs/api.md. Times are UTC ISO-8601 strings.

// ---- errors -----------------------------------------------------------------

/** Error body of every failed API call. */
export type ApiErrorBody = { detail: string; code: string };

// ---- auth -------------------------------------------------------------------

export type User = {
  id: number;
  email: string;
  name: string;
  avatar_url: string | null;
  is_demo: boolean;
};

// ---- meetings ---------------------------------------------------------------

export type MeetingType = "instant" | "scheduled";
export type MeetingStatus = "scheduled" | "live" | "ended";
export type MeetingAccess = "verified_only" | "allow_guests";

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

/** GET /api/meetings/{code}: the public lookup for the join page. */
export type MeetingLookup = {
  meeting_code: string;
  title: string;
  host_name: string;
  status: MeetingStatus;
  access: MeetingAccess;
  requires_passcode: boolean;
};

/** POST /api/meetings/instant */
export type InstantMeetingInput = {
  title?: string;
  access?: MeetingAccess;
};

/** POST /api/meetings */
export type ScheduleMeetingInput = {
  title: string;
  description?: string | null;
  scheduled_start: string;
  duration_min: number;
  timezone: string;
  access?: MeetingAccess;
  passcode?: string | null;
};

/** PATCH /api/meetings/{id}. Only the fields you send change. */
export type MeetingPatch = Partial<ScheduleMeetingInput>;

// ---- participants and join --------------------------------------------------

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

/** POST /api/meetings/{code}/join */
export type JoinInput = {
  display_name: string;
  passcode?: string;
  rejoin_token?: string;
};

export type JoinResult = {
  participant: Participant;
  ws_ticket: string;
  rejoin_token: string;
  meeting: Meeting;
};

// ---- meeting WebSocket (docs/api.md, "WebSocket") ---------------------------

/** A message from the server. Each one has a `type` field. */
export type ServerEvent =
  | { type: "snapshot"; participants: Participant[] }
  | { type: "participant_joined"; participant: Participant }
  | { type: "participant_left"; participant_id: number }
  | { type: "participant_updated"; participant: Participant }
  | { type: "mute_all"; participant_ids: number[] }
  | { type: "you_were_removed"; participant_id: number }
  | { type: "meeting_ended" }
  | { type: "error"; code: string; detail: string };

/** A message to the server. */
export type ClientEvent =
  | { type: "set_muted"; value: boolean }
  | { type: "set_video_off"; value: boolean }
  | { type: "leave" };

// ---- UI-only ----------------------------------------------------------------

/** A chat message in the room. The API has no chat yet, so messages stay in this browser. */
export type ChatMessage = {
  id: number;
  from: string;
  to: "Everyone";
  sent_at: string;
  text: string;
};
