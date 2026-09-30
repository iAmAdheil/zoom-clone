import { describe, expect, it } from "vitest";
import {
  MAX_MESSAGES,
  chatErrorText,
  chatReducer,
  initialChat,
  recipientLabel,
  unreadBadge,
  visibilityText,
  type ChatAction,
  type ChatState,
} from "./chat";
import type { ChatMessage, Participant } from "./types";

const ME = 1;
const message = (id: string, from = 2, to: number | null = null): ChatMessage => ({
  id,
  from,
  from_name: `User ${from}`,
  to,
  text: `text ${id}`,
  at: "2026-01-01T10:00:00.000Z",
});
const person = (id: number, name: string): Participant => ({
  id,
  display_name: name,
  role: "attendee",
  is_muted: false,
  is_video_off: false,
  joined_at: "2026-01-01T10:00:00Z",
  user_id: null,
});

function run(actions: ChatAction[], start: ChatState = initialChat): ChatState {
  return actions.reduce(chatReducer, start);
}

describe("chatReducer", () => {
  it("adds a message at the end", () => {
    const state = run([
      { type: "message", message: message("a"), selfId: ME },
      { type: "message", message: message("b"), selfId: ME },
    ]);
    expect(state.messages.map((m) => m.id)).toEqual(["a", "b"]);
  });

  it("ignores a message that it already has (same id)", () => {
    const state = run([
      { type: "message", message: message("a"), selfId: ME },
      { type: "message", message: message("a"), selfId: ME },
    ]);
    expect(state.messages).toHaveLength(1);
    expect(state.unread).toBe(1);
  });

  it("counts unread messages from others while the panel is closed", () => {
    const state = run([
      { type: "message", message: message("a", 2), selfId: ME },
      { type: "message", message: message("b", 3, ME), selfId: ME },
    ]);
    expect(state.unread).toBe(2);
  });

  it("does not count my own messages", () => {
    const state = run([{ type: "message", message: message("a", ME), selfId: ME }]);
    expect(state.messages).toHaveLength(1);
    expect(state.unread).toBe(0);
  });

  it("does not count messages while the panel is open, and opening it reads all", () => {
    const state = run([
      { type: "message", message: message("a"), selfId: ME },
      { type: "panel", open: true },
      { type: "message", message: message("b"), selfId: ME },
    ]);
    expect(state.unread).toBe(0);
    const closed = run([{ type: "panel", open: false }, { type: "message", message: message("c"), selfId: ME }], state);
    expect(closed.unread).toBe(1);
    expect(run([{ type: "panel", open: true }], closed).unread).toBe(0);
  });

  it("closing the panel keeps the count", () => {
    const state = run([{ type: "message", message: message("a"), selfId: ME }, { type: "panel", open: false }]);
    expect(state.unread).toBe(1);
  });

  it("keeps only the last 100 messages", () => {
    const many = Array.from({ length: MAX_MESSAGES + 7 }, (_, i) => message(`m${i}`));
    const state = run(many.map((m) => ({ type: "message", message: m, selfId: ME }) as const));
    expect(state.messages).toHaveLength(MAX_MESSAGES);
    expect(state.messages[0].id).toBe("m7");
    expect(state.messages.at(-1)?.id).toBe(`m${MAX_MESSAGES + 6}`);
  });

  describe("history from a snapshot", () => {
    it("fills the list and is not unread the first time", () => {
      const state = run([{ type: "history", messages: [message("a"), message("b")], selfId: ME }]);
      expect(state.messages.map((m) => m.id)).toEqual(["a", "b"]);
      expect(state.unread).toBe(0);
      expect(state.hydrated).toBe(true);
    });

    it("does not add a message twice when it came as an event first", () => {
      const state = run([
        { type: "message", message: message("a"), selfId: ME },
        { type: "history", messages: [message("a"), message("b")], selfId: ME },
      ]);
      expect(state.messages.map((m) => m.id)).toEqual(["a", "b"]);
    });

    it("counts the messages that came while the socket was down (a later snapshot)", () => {
      const state = run([
        { type: "history", messages: [message("a")], selfId: ME },
        { type: "history", messages: [message("a"), message("b", 2), message("c", ME)], selfId: ME },
      ]);
      expect(state.messages.map((m) => m.id)).toEqual(["a", "b", "c"]);
      expect(state.unread).toBe(1);
    });

    it("an empty history changes nothing", () => {
      expect(run([{ type: "history", messages: [], selfId: ME }]).messages).toEqual([]);
    });
  });
});

describe("chat text helpers", () => {
  const people = [person(1, "Me Myself"), person(2, "Bob"), person(3, "Cy")];

  it("names the recipient", () => {
    expect(recipientLabel(message("a"), ME, people)).toBe("Everyone");
    expect(recipientLabel(message("a", 2, ME), ME, people)).toBe("Me (private)");
    expect(recipientLabel(message("a", ME, 2), ME, people)).toBe("Bob (private)");
    expect(recipientLabel(message("a", ME, 99), ME, people)).toBe("a participant (private)");
  });

  it("says who can see the message", () => {
    expect(visibilityText(null)).toBe("Messages are visible to everyone in the meeting");
    expect(visibilityText(people[1])).toBe("Only you and Bob can see this");
    expect(visibilityText(null)).not.toMatch(/does not reach/i);
  });

  it("shows a short unread badge", () => {
    expect(unreadBadge(0)).toBeNull();
    expect(unreadBadge(3)).toBe("3");
    expect(unreadBadge(100)).toBe("99+");
  });

  it("explains the chat errors and ignores the other ones", () => {
    expect(chatErrorText("rate_limited")).toMatch(/too fast/);
    expect(chatErrorText("payload_too_large")).toMatch(/500/);
    expect(chatErrorText("bad_target")).toMatch(/not in the meeting/);
    expect(chatErrorText("bad_event")).toBeNull();
  });
});
