"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Icon } from "@/components/ui/Icon";
import { formatTime } from "@/lib/format";
import type { ChatMessage } from "@/lib/types";
import { SidePanel } from "./SidePanel";

type ChatPanelProps = {
  messages: ChatMessage[];
  selfName: string;
  onSend: (text: string) => void;
  onClose: () => void;
};

/** "Meeting Chat" panel: message list, "To: Everyone" and the message box. */
export function ChatPanel({ messages, selfName, onSend, onClose }: ChatPanelProps) {
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  function send(e?: FormEvent) {
    e?.preventDefault();
    const text = draft.trim();
    if (!text) return;
    onSend(text);
    setDraft("");
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <SidePanel
      title="Meeting Chat"
      onClose={onClose}
      footer={
        <form onSubmit={send} className="flex flex-col gap-2">
          <div className="flex items-center gap-1 text-xs text-ink-muted">
            To:
            <span className="inline-flex items-center gap-0.5 rounded-sm bg-primary px-1.5 py-0.5 font-bold text-white">
              Everyone <Icon name="chevronDown" size={12} />
            </span>
          </div>
          <div className="flex items-end gap-2 rounded-md border border-line-strong p-2 focus-within:border-primary">
            <textarea
              aria-label="Message to everyone"
              value={draft}
              rows={2}
              maxLength={1000}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Type message here ..."
              className="min-h-10 flex-1 resize-none bg-transparent text-sm placeholder:text-ink-subtle focus:outline-none"
            />
            <button
              type="submit"
              aria-label="Send message"
              disabled={!draft.trim()}
              className="rounded-md p-1.5 text-primary transition-colors hover:bg-primary-soft disabled:text-ink-subtle disabled:hover:bg-transparent"
            >
              <Icon name="send" size={18} />
            </button>
          </div>
          <p className="text-2xs text-ink-subtle">Who can see your messages? Everyone in the meeting.</p>
        </form>
      }
    >
      <ol className="flex flex-col gap-4 p-4">
        {messages.map((m) => {
          const mine = m.from === selfName;
          return (
            <li key={m.id} className="flex gap-2.5">
              <Avatar name={m.from} size="sm" shape="square" />
              <div className="min-w-0">
                <p className="text-xs text-ink-muted">
                  <span className="font-bold text-ink">{mine ? "Me" : m.from}</span> to {m.to}
                  <span className="ml-2">{formatTime(m.sent_at)}</span>
                </p>
                <p className="mt-1 text-sm break-words whitespace-pre-wrap text-ink-2">{m.text}</p>
              </div>
            </li>
          );
        })}
      </ol>
      <div ref={endRef} />
    </SidePanel>
  );
}
