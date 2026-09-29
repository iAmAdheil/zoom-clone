"use client";

import { useState, type FormEvent } from "react";
import { SendHorizontal } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { cn, formatTime } from "@/lib/format";
import type { ChatMessage } from "@/lib/types";
import { SidePanel } from "./side-panel";

type ChatPanelProps = {
  messages: ChatMessage[];
  onSend: (text: string) => void;
  onClose: () => void;
};

export function ChatPanel({ messages, onSend, onClose }: ChatPanelProps) {
  const [draft, setDraft] = useState("");

  function submit(e: FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    onSend(text);
    setDraft("");
  }

  return (
    <SidePanel
      title="Meeting chat"
      onClose={onClose}
      footer={
        <form onSubmit={submit} className="flex flex-col gap-2">
          <p className="text-xs text-room-ink-3">
            To: <span className="rounded bg-room-3 px-1.5 py-0.5 text-room-ink">Everyone</span>
          </p>
          <div className="flex items-end gap-2 rounded-xl border border-room-line bg-room-3 p-2 focus-within:border-brand">
            <label htmlFor="chat-input" className="sr-only">
              Message
            </label>
            <textarea
              id="chat-input"
              rows={2}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) submit(e);
              }}
              placeholder="Message everyone"
              className="min-h-10 flex-1 resize-none bg-transparent text-sm text-room-ink placeholder:text-room-ink-3 focus:outline-none"
            />
            <button
              type="submit"
              aria-label="Send message"
              disabled={!draft.trim()}
              className="focus-ring-room flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand text-white transition-colors hover:bg-brand-hover disabled:bg-room-line disabled:text-room-ink-3"
            >
              <SendHorizontal className="size-4" />
            </button>
          </div>
        </form>
      }
    >
      <ol className="flex flex-col gap-4 p-4" aria-live="polite">
        {messages.map((m) => (
          <li key={m.id} className="flex gap-2.5">
            <Avatar name={m.author} tone={m.tone} size="xs" className="mt-0.5" />
            <div className="min-w-0">
              <p className="text-xs text-room-ink-3">
                <span className="font-semibold text-room-ink">{m.is_self ? "You" : m.author}</span>
                <span className="ml-2">{formatTime(m.sent_at)}</span>
              </p>
              <p
                className={cn(
                  "mt-1 inline-block rounded-xl rounded-tl-sm px-3 py-2 text-sm",
                  m.is_self ? "bg-brand text-white" : "bg-room-3 text-room-ink",
                )}
              >
                {m.text}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </SidePanel>
  );
}
