import type { ChatMessage, Participant } from "./types";

// Sample people and chat for the room. The room shows them next to the real participant
// until the WebSocket gives the real list. Negative ids never clash with database ids.

const JOINED = "2026-09-30T04:54:00Z";

export const sampleParticipants: Participant[] = [
  { id: -2, display_name: "Priya Sharma", role: "co_host", is_muted: false, is_video_off: false, joined_at: JOINED, user_id: -2 },
  { id: -3, display_name: "Jordan Lee", role: "attendee", is_muted: true, is_video_off: true, joined_at: JOINED, user_id: -3 },
  { id: -4, display_name: "Wei Chen", role: "attendee", is_muted: true, is_video_off: false, joined_at: JOINED, user_id: -4 },
  { id: -5, display_name: "Maria Garcia", role: "attendee", is_muted: false, is_video_off: false, joined_at: JOINED, user_id: null },
  { id: -6, display_name: "Sam Carter", role: "attendee", is_muted: true, is_video_off: true, joined_at: JOINED, user_id: null },
];

/** The sample participant who talks now (gets the active speaker frame). */
export const SAMPLE_SPEAKER_ID = -2;

export const sampleChat: ChatMessage[] = [
  { id: 1, from: "Priya Sharma", to: "Everyone", sent_at: "2026-09-30T04:55:00Z", text: "Morning all! Sharing the agenda in a sec." },
  { id: 2, from: "Wei Chen", to: "Everyone", sent_at: "2026-09-30T04:56:00Z", text: "My mic is acting up, I will type here." },
  { id: 3, from: "Maria Garcia", to: "Everyone", sent_at: "2026-09-30T04:57:00Z", text: "Joined as a guest from the invite link, works fine." },
];
