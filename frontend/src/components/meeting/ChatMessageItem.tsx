import { memo } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { recipientLabel } from "@/lib/chat";
import { formatTime } from "@/lib/format";
import type { ChatMessage, Participant } from "@/lib/types";

type ChatMessageItemProps = {
  message: ChatMessage;
  selfId: number;
  participants: readonly Participant[];
};

/**
 * One chat message. The name and the text are React children, so React escapes them:
 * `<script>` and `<img onerror=...>` show as text. Links are plain text too (no
 * `dangerouslySetInnerHTML`, no linkify). Do not change this without a security review.
 */
export const ChatMessageItem = memo(function ChatMessageItem({ message, selfId, participants }: ChatMessageItemProps) {
  const mine = message.from === selfId;
  const isPrivate = message.to !== null;
  return (
    <li className="flex gap-2.5" data-private={isPrivate ? "true" : undefined}>
      <Avatar name={message.from_name} size="sm" shape="square" />
      <div className="min-w-0">
        <p className="text-xs text-ink-muted">
          <span className="font-bold text-ink">{mine ? "Me" : message.from_name}</span> to{" "}
          <span className={isPrivate ? "font-bold text-primary" : undefined}>
            {recipientLabel(message, selfId, participants)}
          </span>
          <span className="ml-2">{formatTime(message.at)}</span>
        </p>
        <p className="mt-1 text-sm break-words whitespace-pre-wrap text-ink-2">{message.text}</p>
      </div>
    </li>
  );
});
