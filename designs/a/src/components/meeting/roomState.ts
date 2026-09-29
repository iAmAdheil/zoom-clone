import type { ChatMessage, Participant } from "@/lib/types";

// Room state and its reducer. The events match the WebSocket and REST actions in docs/api.md,
// so the mock can later be driven by the real server.

export type RoomState = {
  participants: Participant[];
  messages: ChatMessage[];
  allowSelfUnmute: boolean;
};

export type RoomAction =
  | { type: "set_muted"; id: number; value: boolean }
  | { type: "remove"; id: number }
  | { type: "mute_all"; exceptId: number; allowSelfUnmute: boolean }
  | { type: "toggle_self_unmute" }
  | { type: "send_message"; message: ChatMessage };

export function roomReducer(state: RoomState, action: RoomAction): RoomState {
  switch (action.type) {
    case "set_muted":
      return {
        ...state,
        participants: state.participants.map((p) => (p.id === action.id ? { ...p, is_muted: action.value } : p)),
      };
    case "remove":
      return { ...state, participants: state.participants.filter((p) => p.id !== action.id) };
    case "mute_all":
      return {
        ...state,
        allowSelfUnmute: action.allowSelfUnmute,
        participants: state.participants.map((p) => (p.id === action.exceptId ? p : { ...p, is_muted: true })),
      };
    case "toggle_self_unmute":
      return { ...state, allowSelfUnmute: !state.allowSelfUnmute };
    case "send_message":
      return { ...state, messages: [...state.messages, action.message] };
  }
}
