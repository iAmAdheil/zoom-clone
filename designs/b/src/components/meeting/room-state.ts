import type { ChatMessage, RoomParticipant } from "@/lib/types";

/**
 * Local state for the mock meeting room. The real app will get the same
 * changes from the WebSocket events in docs/api.md
 * (participant_updated, mute_all, participant_left, and so on).
 */
export type RoomState = {
  participants: RoomParticipant[];
  messages: ChatMessage[];
};

export type RoomAction =
  | { type: "toggle_self_mic" }
  | { type: "toggle_self_cam" }
  | { type: "toggle_self_hand" }
  | { type: "mute"; id: number }
  | { type: "mute_all" }
  | { type: "remove"; id: number }
  | { type: "send_message"; text: string; sentAt: string };

function updateSelf(list: RoomParticipant[], fn: (p: RoomParticipant) => RoomParticipant) {
  return list.map((p) => (p.is_self ? fn(p) : p));
}

export function roomReducer(state: RoomState, action: RoomAction): RoomState {
  switch (action.type) {
    case "toggle_self_mic":
      return { ...state, participants: updateSelf(state.participants, (p) => ({ ...p, is_muted: !p.is_muted })) };
    case "toggle_self_cam":
      return {
        ...state,
        participants: updateSelf(state.participants, (p) => ({ ...p, is_video_off: !p.is_video_off })),
      };
    case "toggle_self_hand":
      return {
        ...state,
        participants: updateSelf(state.participants, (p) => ({ ...p, hand_raised: !p.hand_raised })),
      };
    case "mute":
      return {
        ...state,
        participants: state.participants.map((p) =>
          p.id === action.id ? { ...p, is_muted: true, is_speaking: false } : p,
        ),
      };
    case "mute_all":
      // Hosts and co-hosts keep their audio, like Zoom's "Mute all".
      return {
        ...state,
        participants: state.participants.map((p) =>
          p.role === "attendee" ? { ...p, is_muted: true, is_speaking: false } : p,
        ),
      };
    case "remove":
      return { ...state, participants: state.participants.filter((p) => p.id !== action.id) };
    case "send_message": {
      const self = state.participants.find((p) => p.is_self);
      const message: ChatMessage = {
        id: state.messages.length + 1,
        author: self?.display_name ?? "You",
        tone: self?.tone ?? 1,
        text: action.text,
        sent_at: action.sentAt,
        is_self: true,
      };
      return { ...state, messages: [...state.messages, message] };
    }
  }
}

/** Self first, then hosts, raised hands, then the rest by join time. */
export function sortForPanel(list: RoomParticipant[]): RoomParticipant[] {
  const rank = (p: RoomParticipant) =>
    p.is_self ? 0 : p.role === "host" ? 1 : p.role === "co_host" ? 2 : p.hand_raised ? 3 : 4;
  return [...list].sort((a, b) => rank(a) - rank(b) || a.joined_at.localeCompare(b.joined_at));
}

export function roleLabel(p: RoomParticipant): string | null {
  const parts: string[] = [];
  if (p.role === "host") parts.push("Host");
  if (p.role === "co_host") parts.push("Co-host");
  if (p.user_id === null) parts.push("Guest");
  if (p.is_self) parts.push("me");
  return parts.length ? parts.join(", ") : null;
}
