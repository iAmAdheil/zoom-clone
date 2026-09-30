import type { ChatMessage, Participant } from "./types";

// The chat state of one room. No React here (useRoom holds it in a reducer), so the rules
// are unit tested. The server owns the rules for the text (docs/api.md, "Chat").

/** The server keeps 100 messages per meeting. The client keeps the same number. */
export const MAX_MESSAGES = 100;
/** The longest text the server accepts, in characters. */
export const MAX_TEXT = 500;

export type ChatState = {
  messages: ChatMessage[];
  /** Messages from others that came while the chat panel was closed. */
  unread: number;
  panelOpen: boolean;
  /** True after the first snapshot. The history of the first snapshot is not "unread". */
  hydrated: boolean;
};

export const initialChat: ChatState = { messages: [], unread: 0, panelOpen: false, hydrated: false };

export type ChatAction =
  | { type: "history"; messages: ChatMessage[]; selfId: number }
  | { type: "message"; message: ChatMessage; selfId: number }
  | { type: "panel"; open: boolean };

/** Keeps the `id`s that are new, in order. A message can come twice (history and event). */
function addMessages(state: ChatState, incoming: readonly ChatMessage[], selfId: number): ChatState {
  const known = new Set(state.messages.map((m) => m.id));
  const fresh: ChatMessage[] = [];
  for (const message of incoming) {
    if (known.has(message.id)) continue;
    known.add(message.id);
    fresh.push(message);
  }
  if (fresh.length === 0) return state;
  const unread = state.panelOpen ? 0 : fresh.filter((m) => m.from !== selfId).length;
  return {
    ...state,
    messages: [...state.messages, ...fresh].slice(-MAX_MESSAGES),
    unread: state.unread + unread,
  };
}

export function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case "history": {
      // The first history is old news for a new participant. After a reconnect, the messages
      // that came while the socket was down are new, so they count as unread.
      const next = addMessages(state, action.messages, action.selfId);
      if (state.hydrated) return next;
      return { ...next, hydrated: true, unread: state.unread };
    }
    case "message":
      return addMessages(state, [action.message], action.selfId);
    case "panel":
      // Opening the panel reads everything.
      return { ...state, panelOpen: action.open, unread: action.open ? 0 : state.unread };
  }
}

/** The server text for a chat error, or null when the error is not about chat. */
export function chatErrorText(code: string): string | null {
  switch (code) {
    case "rate_limited":
      return "You are sending messages too fast. Wait a moment.";
    case "payload_too_large":
      return `Messages can have up to ${MAX_TEXT} characters.`;
    case "bad_target":
      return "That person is not in the meeting now. Your message was not sent.";
    default:
      return null;
  }
}

/** Who can read the message, for the label under the sender name. */
export function recipientLabel(message: ChatMessage, selfId: number, participants: readonly Participant[]): string {
  if (message.to === null) return "Everyone";
  if (message.to === selfId) return "Me (private)";
  const name = participants.find((p) => p.id === message.to)?.display_name ?? "a participant";
  return `${name} (private)`;
}

/** The hint under the message box. */
export function visibilityText(target: Participant | null): string {
  return target ? `Only you and ${target.display_name} can see this` : "Messages are visible to everyone in the meeting";
}

/** The badge text of the Chat button. Null when nothing is unread. */
export function unreadBadge(unread: number): string | null {
  if (unread <= 0) return null;
  return unread > 99 ? "99+" : String(unread);
}
