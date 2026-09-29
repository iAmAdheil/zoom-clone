import { ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { formatMeetingCode, formatShortDate, formatTime, minutesBetween } from "@/lib/format";
import type { Meeting, User } from "@/lib/types";

type RecentMeetingsProps = { meetings: Meeting[]; me: User };

/** Recent meetings, in the table style of the portal "Previous" meetings tab. */
export function RecentMeetings({ meetings, me }: RecentMeetingsProps) {
  return (
    <section aria-labelledby="recent-title">
      <div className="flex items-end justify-between border-b border-line pb-2">
        <h2 id="recent-title" className="text-lg font-bold text-ink">
          Recent
        </h2>
        <span className="text-xs text-ink-muted">Last 7 days</span>
      </div>

      {meetings.length === 0 ? (
        <p className="py-10 text-center text-sm text-ink-muted">
          You have no recent meetings. Start one with New Meeting.
        </p>
      ) : (
        <ul className="divide-y divide-line">
          {meetings.map((m) => {
            const start = m.started_at ?? m.scheduled_start ?? "";
            const length = m.started_at && m.ended_at ? minutesBetween(m.started_at, m.ended_at) : null;
            const hostLabel = m.host.id === me.id ? "You hosted" : `Host: ${m.host.name}`;
            return (
              <li
                key={m.id}
                className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 px-1 py-3 transition-colors hover:bg-surface-muted sm:grid-cols-[140px_1fr_auto] sm:px-3"
              >
                <div className="col-span-2 text-xs text-ink-muted sm:col-span-1 sm:text-sm">
                  <span className="font-bold text-ink-2">{formatShortDate(start)}</span>
                  <span className="ml-2 sm:ml-0 sm:block">{formatTime(start)}</span>
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-ink">{m.title}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-ink-muted">
                    <span>ID: {formatMeetingCode(m.meeting_code)}</span>
                    {length !== null ? (
                      <span className="inline-flex items-center gap-1">
                        <Icon name="clock" size={12} /> {length} min
                      </span>
                    ) : null}
                    <span>{hostLabel}</span>
                  </p>
                </div>
                <ButtonLink href={`/meeting/${m.meeting_code}`} variant="secondary" size="sm">
                  Start again
                </ButtonLink>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
