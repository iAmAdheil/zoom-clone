import Link from "next/link";
import { ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { dayKey, formatDay, formatMeetingCode, formatTime, formatTimeRange } from "@/lib/format";
import type { Meeting } from "@/lib/types";

type UpcomingCardProps = { now: string; meetings: Meeting[] };

/** Right-hand card of the Zoom Home screen: clock banner plus the upcoming list. */
export function UpcomingCard({ now, meetings }: UpcomingCardProps) {
  const today = dayKey(now);

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
          <p className="text-4xl font-bold tracking-tight sm:text-5xl">{formatTime(now)}</p>
          <p className="mt-1 text-sm text-white/80">{formatDay(now)}</p>
        </div>
      </div>

      <div className="flex items-center justify-between px-5 pt-4 pb-2">
        <h2 id="upcoming-title" className="text-base font-bold text-ink">
          Upcoming
        </h2>
        <Link href="/schedule" className="rounded-sm text-sm font-bold text-primary hover:underline">
          Schedule
        </Link>
      </div>

      {meetings.length === 0 ? (
        <p className="px-5 pb-6 text-sm text-ink-muted">No upcoming meetings today.</p>
      ) : (
        <ul className="divide-y divide-line px-2 pb-2">
          {meetings.map((m) => {
            const start = m.scheduled_start ?? now;
            const isToday = dayKey(start) === today;
            return (
              <li
                key={m.id}
                className="flex items-start gap-3 rounded-md px-3 py-3 transition-colors hover:bg-surface-muted"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-ink-muted">
                    {isToday ? "Today" : "Tomorrow"}, {formatTimeRange(start, m.duration_min ?? 30)}
                  </p>
                  <p className="mt-0.5 truncate text-sm font-bold text-ink">{m.title}</p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-muted">
                    Meeting ID: {formatMeetingCode(m.meeting_code)}
                    {m.access === "verified_only" ? (
                      <span title="Only signed-in users can join" className="inline-flex items-center">
                        <Icon name="lock" size={12} />
                        <span className="sr-only">Signed-in users only</span>
                      </span>
                    ) : null}
                  </p>
                </div>
                <ButtonLink href={`/meeting/${m.meeting_code}`} size="sm" variant={isToday ? "primary" : "secondary"}>
                  Start
                </ButtonLink>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
