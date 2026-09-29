"use client";

import { useEffect, useState } from "react";
import { formatElapsed } from "@/lib/format";
import type { Meeting } from "@/lib/types";
import { Icon } from "@/components/ui/Icon";
import { Logo } from "@/components/ui/Logo";
import { Popover } from "@/components/ui/Popover";
import { MeetingInfo } from "./MeetingInfo";

/** Counts up from when the user joined. Starts at 0 on both server and client. */
function useElapsed() {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);
  return seconds;
}

export function RoomTopBar({ meeting, onEnd }: { meeting: Meeting; onEnd: () => void }) {
  const [infoOpen, setInfoOpen] = useState(false);
  const elapsed = useElapsed();

  return (
    <header className="flex h-roomtop shrink-0 items-center gap-3 px-3 sm:px-4">
      <div className="hidden items-baseline gap-1.5 sm:flex">
        <Logo tone="white" size="sm" />
        <span className="text-sm font-semibold text-room-ink">Workplace</span>
      </div>

      <Popover
        open={infoOpen}
        onClose={() => setInfoOpen(false)}
        label="Meeting information"
        placement="bottom"
        align="start"
        trigger={
          <button
            type="button"
            aria-expanded={infoOpen}
            onClick={() => setInfoOpen((v) => !v)}
            className="flex h-8 items-center gap-1.5 rounded-md px-2 text-sm text-room-ink transition-colors hover:bg-room-hover"
          >
            <Icon name="shield" size={18} className="text-success" />
            <span className="max-w-[40vw] truncate font-medium sm:max-w-xs">{meeting.title}</span>
            <Icon name="chevronDown" size={14} className="text-room-ink-muted" />
          </button>
        }
      >
        <MeetingInfo meeting={meeting} />
      </Popover>

      <div className="ml-auto flex items-center gap-2">
        <span className="flex items-center gap-1.5 rounded-sm bg-room-raised px-2 py-1 text-xs font-medium text-room-ink tabular-nums">
          <Icon name="clock" size={12} className="text-room-ink-muted" />
          <span className="sr-only">Meeting time</span>
          {formatElapsed(elapsed)}
        </span>
        <button
          type="button"
          disabled
          className="hidden h-8 items-center gap-1.5 rounded-md px-2 text-sm text-room-ink-muted sm:flex"
          title="Speaker view is not part of this mockup"
        >
          <Icon name="grid" size={16} />
          Gallery
        </button>
        {/* Phones: End sits here, like the Zoom mobile app. */}
        <button
          type="button"
          onClick={onEnd}
          className="h-8 rounded-md bg-danger px-3 text-sm font-semibold text-white transition-colors hover:bg-danger-hover sm:hidden"
        >
          End
        </button>
      </div>
    </header>
  );
}
