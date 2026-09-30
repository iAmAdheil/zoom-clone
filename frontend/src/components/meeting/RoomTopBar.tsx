"use client";

import { useSyncExternalStore } from "react";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";
import type { Meeting } from "@/lib/types";
import { MeetingInfoPopover } from "./MeetingInfoPopover";

function subscribeToSeconds(onTick: () => void) {
  const id = setInterval(onTick, 1000);
  return () => clearInterval(id);
}

/** The current time in whole seconds. Null during the server render. */
function useNowSeconds(): number | null {
  return useSyncExternalStore(
    subscribeToSeconds,
    () => Math.floor(Date.now() / 1000),
    () => null,
  );
}

/** 75 -> "01:15", 3725 -> "1:02:05". */
function formatElapsed(totalSeconds: number): string {
  const s = Math.max(0, totalSeconds);
  const pad = (n: number) => String(n).padStart(2, "0");
  const h = Math.floor(s / 3600);
  const mm = pad(Math.floor((s % 3600) / 60));
  const ss = pad(s % 60);
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** Time since the meeting started (`started_at`), and the planned length (`duration_min`). */
function MeetingTimer({ meeting }: { meeting: Meeting }) {
  const now = useNowSeconds();
  const start = meeting.started_at ?? meeting.scheduled_start;
  if (now === null || !start) return null;

  const elapsed = now - Math.floor(new Date(start).getTime() / 1000);
  const text = formatElapsed(elapsed);
  const planned = meeting.duration_min;
  const overtime = planned !== null && elapsed > planned * 60;

  return (
    <span
      className={cn("tabular-nums", overtime ? "text-danger" : "text-room-muted")}
      title={planned ? `Planned length: ${planned} min` : undefined}
      aria-label={`Meeting time ${text}${planned ? ` of ${planned} minutes` : ""}`}
    >
      {text}
      {planned ? <span className="hidden sm:inline"> / {planned} min</span> : null}
    </span>
  );
}

/** Thin top bar of the meeting window: info shield, title, timer and View. */
export function RoomTopBar({ meeting, onCopied }: { meeting: Meeting; onCopied: (m: string) => void }) {
  return (
    <div className="flex h-roombar shrink-0 items-center justify-between gap-3 bg-room-bar px-2 text-room-text sm:px-3">
      <div className="flex min-w-0 items-center gap-2">
        <MeetingInfoPopover meeting={meeting} onCopied={onCopied} />
        <p className="truncate text-xs text-room-muted sm:text-sm">{meeting.title}</p>
      </div>
      <div className="flex shrink-0 items-center gap-3 text-xs">
        <MeetingTimer meeting={meeting} />
        <span className="flex items-center gap-1.5 rounded-md px-2 py-1 text-room-text">
          <Icon name="gallery" size={16} /> View
        </span>
      </div>
    </div>
  );
}
