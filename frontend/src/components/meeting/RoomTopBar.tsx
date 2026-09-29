"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import type { Meeting } from "@/lib/types";
import { MeetingInfoPopover } from "./MeetingInfoPopover";

function useElapsed() {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, []);
  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

/** Thin top bar of the meeting window: info shield, title, timer and View. */
export function RoomTopBar({ meeting, onCopied }: { meeting: Meeting; onCopied: (m: string) => void }) {
  const elapsed = useElapsed();

  return (
    <div className="flex h-roombar shrink-0 items-center justify-between gap-3 bg-room-bar px-2 text-room-text sm:px-3">
      <div className="flex min-w-0 items-center gap-2">
        <MeetingInfoPopover meeting={meeting} onCopied={onCopied} />
        <p className="truncate text-xs text-room-muted sm:text-sm">{meeting.title}</p>
      </div>
      <div className="flex shrink-0 items-center gap-3 text-xs">
        <span className="tabular-nums text-room-muted" aria-label={`Meeting time ${elapsed}`}>
          {elapsed}
        </span>
        <span className="flex items-center gap-1.5 rounded-md px-2 py-1 text-room-text">
          <Icon name="gallery" size={16} /> View
        </span>
      </div>
    </div>
  );
}
