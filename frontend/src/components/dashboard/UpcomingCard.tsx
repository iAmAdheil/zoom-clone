"use client";

import Link from "next/link";
import { ButtonLink } from "@/components/ui/Button";
import { errorMessage } from "@/lib/api";
import { formatDay, formatMeetingCode, formatRelativeDay, formatTime, formatTimeRange } from "@/lib/format";
import type { Meeting } from "@/lib/types";
import { ListMessage } from "./ListMessage";
import { AccessBadge, CopyInviteButton } from "./MeetingRowBits";

type UpcomingCardProps = {
  /** Current time in ms, or null before the browser clock is known. */
  now: number | null;
  meetings: Meeting[] | undefined;
  error: unknown;
  onRetry: () => void;
  onCopied: (message: string) => void;
};

/** Right-hand card of the Zoom Home screen: clock banner plus the upcoming list. */
export function UpcomingCard({ now, meetings, error, onRetry, onCopied }: UpcomingCardProps) {
  const nowDate = now === null ? null : new Date(now);

  return (
    <section
      aria-labelledby="upcoming-title"
      className="overflow-hidden rounded-lg border border-line bg-surface shadow-card"
    >
      <div className="relative bg-ink px-6 py-6 text-white">
        {/* Soft shapes stand in for the photo banner in the real client. */}
        <div aria-hidden="true" className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-16 -right-10 size-56 rounded-full bg-primary opacity-40 blur-2xl" />
          <div className="absolute -bottom-20 left-10 size-48 rounded-full bg-avatar-2 opacity-30 blur-2xl" />
        </div>
        <div className="relative">
          {/* The non-breaking space keeps the banner height before the clock is known. */}
          <p className="text-4xl font-bold tracking-tight sm:text-5xl">
            {nowDate ? formatTime(nowDate.toISOString()) : " "}
          </p>
          <p className="mt-1 text-sm text-white/80">{nowDate ? formatDay(nowDate.toISOString()) : " "}</p>
        </div>
      </div>

      <div className="flex items-center justify-between px-5 pt-4 pb-2">
        <h2 id="upcoming-title" className="text-base font-bold text-ink">
          Upcoming
        </h2>
        <Link href="/schedule" className="inline-flex items-center rounded-sm text-sm font-bold text-primary hover:underline max-sm:min-h-10">
          Schedule
        </Link>
      </div>

      {error ? (
        <ListMessage tone="error" onRetry={onRetry} className="px-5 pb-6">
          {errorMessage(error)}
        </ListMessage>
      ) : !meetings || !nowDate ? (
        <ListMessage className="px-5 pb-6">Loading meetings...</ListMessage>
      ) : meetings.length === 0 ? (
        <ListMessage className="px-5 pb-6">No upcoming meetings. Use Schedule to plan one.</ListMessage>
      ) : (
        <ul className="divide-y divide-line px-2 pb-2">
          {meetings.map((m) => {
            const start = m.scheduled_start ?? nowDate.toISOString();
            const day = formatRelativeDay(start, nowDate);
            return (
              <li
                key={m.id}
                className="flex items-start gap-3 rounded-md px-3 py-3 transition-colors hover:bg-surface-muted"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-ink-muted">
                    {day}, {formatTimeRange(start, m.duration_min ?? 30)}
                  </p>
                  <p className="mt-0.5 truncate text-sm font-bold text-ink">{m.title}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-muted">
                    Meeting ID: {formatMeetingCode(m.meeting_code)}
                    <AccessBadge access={m.access} />
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <CopyInviteButton meeting={m} onCopied={onCopied} />
                  <ButtonLink
                    href={`/meeting/${m.meeting_code}`}
                    size="sm"
                    variant={day === "Today" ? "primary" : "secondary"}
                  >
                    Start
                  </ButtonLink>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
