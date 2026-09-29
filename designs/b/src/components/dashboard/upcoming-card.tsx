import Link from "next/link";
import { CalendarPlus } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CopyButton } from "@/components/ui/copy-button";
import { dayKey, formatDuration, formatLongDay, formatMeetingCode, formatTime } from "@/lib/format";
import type { Meeting, User } from "@/lib/types";
import { AccessBadges } from "./access-badge";
import { Clock } from "./greeting";

function groupByDay(meetings: Meeting[]) {
  const groups = new Map<string, Meeting[]>();
  for (const m of meetings) {
    if (!m.scheduled_start) continue;
    const key = dayKey(m.scheduled_start);
    const list = groups.get(key) ?? [];
    list.push(m);
    groups.set(key, list);
  }
  return [...groups.values()];
}

/** Right column of the home screen: clock hero plus upcoming meetings. */
export function UpcomingCard({ meetings, me }: { meetings: Meeting[]; me: User }) {
  const groups = groupByDay(meetings);

  return (
    <Card className="overflow-hidden">
      <div className="relative overflow-hidden bg-linear-to-br from-navy via-navy-2 to-brand px-5 py-6 text-white md:px-6 md:py-7">
        <span aria-hidden className="absolute -top-16 -right-10 size-48 rounded-full bg-white/10" />
        <span aria-hidden className="absolute -right-4 -bottom-20 size-40 rounded-full bg-white/5" />
        <div className="relative">
          <Clock />
        </div>
      </div>

      <div className="flex items-center justify-between px-5 pt-4 pb-2">
        <h2 id="upcoming-title" className="text-base font-semibold text-ink">
          Upcoming meetings
        </h2>
        <Link href="/schedule" className="focus-ring rounded-md text-sm font-medium text-brand hover:underline">
          View all
        </Link>
      </div>

      {groups.length === 0 ? (
        <EmptyUpcoming />
      ) : (
        <div aria-labelledby="upcoming-title" className="pb-2">
          {groups.map((group) => (
            <section key={group[0].id}>
              <h3 className="px-5 pt-3 pb-1 text-xs font-semibold tracking-wide text-ink-3 uppercase">
                {formatLongDay(group[0].scheduled_start!)}
              </h3>
              <ul>
                {group.map((m) => (
                  <UpcomingRow key={m.id} meeting={m} isHost={m.host.id === me.id} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </Card>
  );
}

function UpcomingRow({ meeting, isHost }: { meeting: Meeting; isHost: boolean }) {
  return (
    <li className="group mx-2 flex gap-3 rounded-xl px-3 py-3 transition-colors hover:bg-surface-2">
      <div className="w-18 shrink-0 pt-0.5">
        <p className="text-sm font-semibold whitespace-nowrap text-ink tabular-nums">{formatTime(meeting.scheduled_start!)}</p>
        <p className="text-xs text-ink-3">{formatDuration(meeting.duration_min ?? 0)}</p>
      </div>
      <div className="min-w-0 flex-1 border-l-2 border-brand pl-3">
        <p className="truncate text-sm font-semibold text-ink">{meeting.title}</p>
        <p className="mt-0.5 truncate text-xs text-ink-3">
          ID {formatMeetingCode(meeting.meeting_code)}
          {isHost ? null : ` · Hosted by ${meeting.host.name}`}
        </p>
        <div className="mt-2">
          <AccessBadges meeting={meeting} />
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1.5 sm:flex-row sm:items-start">
        <CopyButton text={meeting.invite_link} label="Copy invite link" />
        <ButtonLink
          href={`/meeting/${meeting.meeting_code}`}
          size="sm"
          variant={isHost ? "primary" : "secondary"}
        >
          {isHost ? "Start" : "Join"}
        </ButtonLink>
      </div>
    </li>
  );
}

function EmptyUpcoming() {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      <span className="flex size-12 items-center justify-center rounded-2xl bg-brand-soft text-brand">
        <CalendarPlus className="size-6" />
      </span>
      <p className="mt-3 text-sm font-semibold text-ink">No upcoming meetings</p>
      <p className="mt-1 text-xs text-ink-3">Scheduled meetings will show here.</p>
      <ButtonLink href="/schedule" size="sm" variant="soft" className="mt-4">
        Schedule a meeting
      </ButtonLink>
    </div>
  );
}
