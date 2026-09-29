import {
  formatDuration,
  formatLongDay,
  formatMeetingCode,
  formatTime,
  minutesUntil,
  relativeDay,
} from "@/lib/format";
import { MOCK_NOW } from "@/lib/mock";
import type { Meeting } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { CopyButton } from "@/components/ui/CopyButton";
import { AccessBadge } from "./AccessBadge";
import { EmptyState } from "./EmptyState";

/** Groups meetings by "Today", "Tomorrow" or date, keeping the order. */
function groupByDay(meetings: Meeting[]) {
  const groups: { day: string; items: Meeting[] }[] = [];
  for (const m of meetings) {
    const day = relativeDay(m.scheduled_start!);
    const last = groups[groups.length - 1];
    if (last && last.day === day) last.items.push(m);
    else groups.push({ day, items: [m] });
  }
  return groups;
}

function UpcomingRow({ meeting }: { meeting: Meeting }) {
  const start = meeting.scheduled_start!;
  const mins = minutesUntil(start);
  const soon = mins >= 0 && mins <= 60;

  return (
    <li className="group flex flex-wrap items-center gap-x-4 gap-y-3 px-5 py-4 transition-colors hover:bg-surface-hover sm:flex-nowrap">
      <div className="w-20 shrink-0">
        <p className="text-sm font-semibold text-ink">{formatTime(start)}</p>
        <p className="text-xs text-ink-muted">{formatDuration(meeting.duration_min ?? 0)}</p>
      </div>
      <div className="min-w-0 flex-1 border-l-2 border-brand pl-4">
        <p className="truncate text-sm font-semibold text-ink">{meeting.title}</p>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-ink-muted">
          <span>ID {formatMeetingCode(meeting.meeting_code)}</span>
          <AccessBadge access={meeting.access} />
          {soon && <span className="font-medium text-warning-ink">Starts in {mins} min</span>}
        </div>
      </div>
      <div className="flex w-full shrink-0 items-center gap-2 sm:w-auto">
        <CopyButton
          text={meeting.invite_link}
          label="Invite"
          variant="ghost"
          className="flex-1 sm:flex-none"
        />
        <Button
          href={`/meeting/${meeting.meeting_code}`}
          size="sm"
          variant={soon ? "primary" : "secondary"}
          className="flex-1 sm:flex-none"
        >
          Start
        </Button>
      </div>
    </li>
  );
}

export function UpcomingList({ meetings }: { meetings: Meeting[] }) {
  const groups = groupByDay(meetings);

  return (
    <Card className="overflow-hidden">
      {/* Clock banner: the right-hand card on the Zoom desktop home. */}
      <div className="relative overflow-hidden bg-linear-to-br from-brand to-brand-press px-5 py-6 text-on-brand">
        <div aria-hidden="true" className="absolute -top-16 -right-10 size-48 rounded-full bg-white/10" />
        <div aria-hidden="true" className="absolute -right-2 -bottom-20 size-40 rounded-full bg-white/10" />
        <p className="relative text-4xl font-semibold tracking-tight">{formatTime(MOCK_NOW)}</p>
        <p className="relative mt-1 text-sm text-white/80">{formatLongDay(MOCK_NOW)}</p>
      </div>

      <div className="flex items-center justify-between border-b border-line px-5 py-3">
        <h2 id="upcoming-title" className="text-base font-semibold">
          Upcoming
        </h2>
        <Button href="/schedule" variant="ghost" size="sm" icon="plus">
          Schedule
        </Button>
      </div>

      {groups.length === 0 ? (
        <EmptyState
          icon="calendar"
          title="No upcoming meetings"
          body="Scheduled meetings show here."
          action={
            <Button href="/schedule" size="sm">
              Schedule a meeting
            </Button>
          }
        />
      ) : (
        <div aria-labelledby="upcoming-title">
          {groups.map((g) => (
            <section key={g.day} aria-label={g.day}>
              <h3 className="bg-canvas px-5 py-2 text-xs font-semibold tracking-wide text-ink-muted uppercase">
                {g.day}
              </h3>
              <ul className="divide-y divide-line">
                {g.items.map((m) => (
                  <UpcomingRow key={m.id} meeting={m} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </Card>
  );
}
