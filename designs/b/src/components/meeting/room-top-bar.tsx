"use client";

import { useRef } from "react";
import { ChevronDown, Info, LayoutGrid, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/format";
import { useDismiss, useElapsedSeconds } from "@/lib/hooks";
import type { Meeting } from "@/lib/types";
import { MeetingInfo } from "./meeting-info";

function formatElapsed(total: number) {
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

type RoomTopBarProps = {
  meeting: Meeting;
  infoOpen: boolean;
  onToggleInfo: () => void;
  onCloseInfo: () => void;
};

export function RoomTopBar({ meeting, infoOpen, onToggleInfo, onCloseInfo }: RoomTopBarProps) {
  const elapsed = useElapsedSeconds();
  const infoRef = useRef<HTMLDivElement>(null);
  useDismiss(infoRef, infoOpen, onCloseInfo);

  return (
    <header className="relative flex h-12 shrink-0 items-center gap-2 px-2 text-room-ink sm:px-4">
      <span
        title="This meeting is encrypted (mock)"
        className="flex size-7 items-center justify-center rounded-md text-speaker"
      >
        <ShieldCheck className="size-5" />
      </span>
      <div ref={infoRef} className="relative min-w-0">
      <button
        type="button"
        onClick={onToggleInfo}
        aria-expanded={infoOpen}
        aria-haspopup="dialog"
        className={cn(
          "focus-ring-room flex min-w-0 items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-medium transition-colors hover:bg-room-hover",
          infoOpen && "bg-room-hover",
        )}
      >
        <span className="truncate">{meeting.title}</span>
        <Info className="size-4 shrink-0 text-room-ink-2" />
      </button>
      <MeetingInfo meeting={meeting} open={infoOpen} onClose={onCloseInfo} />
      </div>

      <div className="ml-auto flex items-center gap-2">
        <span className="flex items-center gap-1.5 rounded-md bg-room-3 px-2 py-1 text-xs text-room-ink-2 tabular-nums">
          <span className="size-1.5 rounded-full bg-danger" aria-hidden />
          {formatElapsed(elapsed)}
        </span>
        <button
          type="button"
          title="Change view (placeholder)"
          className="focus-ring-room hidden items-center gap-1.5 rounded-lg px-2 py-1 text-sm text-room-ink hover:bg-room-hover sm:flex"
        >
          <LayoutGrid className="size-4" />
          View
          <ChevronDown className="size-3.5 text-room-ink-2" />
        </button>
      </div>
    </header>
  );
}
