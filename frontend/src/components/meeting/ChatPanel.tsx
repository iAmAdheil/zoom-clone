"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Icon } from "@/components/ui/Icon";
import { MAX_TEXT, visibilityText } from "@/lib/chat";
import type { ChatMessage, Participant } from "@/lib/types";
import { ChatMessageItem } from "./ChatMessageItem";
import { SidePanel } from "./SidePanel";

type ChatPanelProps = {
  messages: readonly ChatMessage[];
  participants: readonly Participant[];
  selfId: number;
  /** Returns false when the message could not be sent (offline). The text then stays in the box. */
  onSend: (text: string, to: number | null) => boolean;
  onClose: () => void;
};

/** "Meeting Chat" panel: message list, "To:" menu and the message box. */
export function ChatPanel({ messages, participants, selfId, onSend, onClose }: ChatPanelProps) {
  const [draft, setDraft] = useState("");
  const [toId, setToId] = useState<number | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const others = useMemo(() => participants.filter((p) => p.id !== selfId), [participants, selfId]);
  // When the chosen person leaves, the menu goes back to Everyone.
  const target = others.find((p) => p.id === toId) ?? null;

  const lastId = messages.at(-1)?.id;
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [lastId]);

  function send(e?: FormEvent) {
    e?.preventDefault();
    const text = draft.trim();
    if (!text) return;
    if (onSend(text, target?.id ?? null)) setDraft("");
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    // Enter sends. Shift+Enter adds a line. Enter that confirms an IME word does not send.
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send();
    }
  }

  const toLabel = target ? `Message to ${target.display_name} only` : "Message to everyone";

  return (
    <SidePanel
      title="Meeting Chat"
      onClose={onClose}
      footer={
        <form onSubmit={send} className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-xs text-ink-muted">
            <label htmlFor="chat-to">To:</label>
            <select
              id="chat-to"
              value={target?.id ?? ""}
              onChange={(e) => setToId(e.target.value === "" ? null : Number(e.target.value))}
              className="min-w-0 max-w-full flex-1 truncate rounded-sm border border-line-strong bg-surface px-1.5 py-1 text-xs font-bold text-ink focus-visible:border-primary max-sm:min-h-10"
            >
              <option value="">Everyone</option>
              {others.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.display_name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end gap-2 rounded-md border border-line-strong p-2 focus-within:border-primary">
            <textarea
              aria-label={toLabel}
              value={draft}
              rows={2}
              maxLength={MAX_TEXT}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Type message here ..."
              className="min-h-10 flex-1 resize-none bg-transparent text-sm placeholder:text-ink-subtle focus:outline-none"
            />
            <button
              type="submit"
              aria-label="Send message"
              disabled={!draft.trim()}
              className="inline-flex size-8 items-center justify-center rounded-md text-primary transition-colors hover:bg-primary-soft disabled:text-ink-subtle disabled:hover:bg-transparent max-sm:size-10"
            >
              <Icon name="send" size={18} />
            </button>
          </div>
          <p role="status" className="text-2xs text-ink-subtle">
            {visibilityText(target)}
          </p>
        </form>
      }
    >
      {messages.length === 0 ? <p className="px-4 py-8 text-center text-sm text-ink-muted">No messages yet.</p> : null}
      <ol role="log" aria-label="Messages" className="flex flex-col gap-4 p-4">
        {messages.map((m) => (
          <ChatMessageItem key={m.id} message={m} selfId={selfId} participants={participants} />
        ))}
      </ol>
      <div ref={endRef} />
    </SidePanel>
  );
}
