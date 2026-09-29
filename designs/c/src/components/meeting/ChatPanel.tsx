"use client";

import { useState, type FormEvent } from "react";
import { formatTime } from "@/lib/format";
import type { ChatMessage } from "@/lib/types";
import { Avatar } from "@/components/ui/Avatar";
import { Icon } from "@/components/ui/Icon";
import { SidePanel } from "./SidePanel";

export function ChatPanel({
  messages,
  selfName,
  onSend,
  onClose,
}: {
  messages: ChatMessage[];
  selfName: string;
  onSend: (text: string) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState("");

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!draft.trim()) return;
    onSend(draft.trim());
    setDraft("");
  }

  return (
    <SidePanel
      title="Chat"
      onClose={onClose}
      footer={
        <form onSubmit={submit} className="grid gap-2">
          <p className="text-xs text-room-ink-faint">
            To: <span className="rounded-xs bg-room-raised px-1.5 py-0.5 text-room-ink-muted">Everyone</span>
          </p>
          <div className="flex items-center gap-2">
            <label htmlFor="chat-input" className="sr-only">
              Message
            </label>
            <input
              id="chat-input"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Type message here…"
              autoComplete="off"
              className="h-10 min-w-0 flex-1 rounded-md border border-room-line bg-room-raised px-3 text-sm text-room-ink placeholder:text-room-ink-faint focus:border-focus-dark focus:outline-none"
            />
            <button
              type="submit"
              aria-label="Send"
              disabled={!draft.trim()}
              className="flex size-10 items-center justify-center rounded-md bg-brand text-on-brand transition-colors hover:bg-brand-hover disabled:bg-room-raised disabled:text-room-ink-faint"
            >
              <Icon name="send" size={18} />
            </button>
          </div>
        </form>
      }
    >
      <ol className="grid gap-4 p-4" aria-live="polite">
        {messages.map((m) => {
          const mine = m.from === selfName;
          return (
            <li key={m.id} className="flex gap-2.5">
              <Avatar name={m.from} size="sm" />
              <div className="min-w-0">
                <p className="text-xs text-room-ink-muted">
                  <span className="font-semibold text-room-ink">{mine ? "You" : m.from}</span> ·{" "}
                  {formatTime(m.at)}
                </p>
                <p className="mt-1 rounded-md rounded-tl-xs bg-room-raised px-3 py-2 text-sm text-room-ink">
                  {m.text}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </SidePanel>
  );
}
