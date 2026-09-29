import { CalendarCheck, Users, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { CopyButton } from "@/components/ui/copy-button";
import { formatDay, formatDuration, formatMeetingCode, formatTime, minutesBetween } from "@/lib/format";
import type { Meeting, User } from "@/lib/types";

type RecentListProps = {
  meetings: Meeting[];
  attendance: Record<number, number>;
  me: User;
};

/** Meetings the user hosted or joined, newest first. */
export function RecentList({ meetings, attendance, me }: RecentListProps) {
  return (
    <Card>
      <CardHeader id="recent-title" title="Recent meetings" subtitle="Meetings you hosted or joined" />
      <div className="hidden grid-cols-[minmax(0,1fr)_9rem_6rem_5rem_2.5rem] gap-4 border-y border-line bg-surface-2 px-5 py-2 text-xs font-medium text-ink-3 md:grid">
        <span>Meeting</span>
        <span>Date</span>
        <span>Duration</span>
        <span>People</span>
        <span className="sr-only">Actions</span>
      </div>
      <ul aria-labelledby="recent-title" className="divide-y divide-line">
        {meetings.map((m) => (
          <RecentRow key={m.id} meeting={m} people={attendance[m.id] ?? 1} isHost={m.host.id === me.id} />
        ))}
      </ul>
    </Card>
  );
}

function RecentRow({ meeting, people, isHost }: { meeting: Meeting; people: number; isHost: boolean }) {
  const start = meeting.started_at!;
  const minutes = meeting.ended_at ? minutesBetween(start, meeting.ended_at) : 0;
  const Icon = meeting.type === "instant" ? Zap : CalendarCheck;

  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-5 py-3 transition-colors hover:bg-surface-2 md:grid-cols-[minmax(0,1fr)_9rem_6rem_5rem_2.5rem]">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-ink-2">
          <Icon className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-ink">{meeting.title}</p>
          <p className="flex items-center gap-2 truncate text-xs text-ink-3">
            <span>ID {formatMeetingCode(meeting.meeting_code)}</span>
            {isHost ? <Badge tone="brand">Host</Badge> : null}
          </p>
          <p className="mt-0.5 text-xs text-ink-3 md:hidden">
            {formatDay(start)}, {formatTime(start)} · {formatDuration(minutes)} · {people} people
          </p>
        </div>
      </div>
      <span className="hidden text-sm text-ink-2 md:block">
        {formatDay(start)}
        <span className="block text-xs text-ink-3">{formatTime(start)}</span>
      </span>
      <span className="hidden text-sm text-ink-2 md:block">{formatDuration(minutes)}</span>
      <span className="hidden items-center gap-1.5 text-sm text-ink-2 md:flex">
        <Users className="size-4 text-ink-3" />
        {people}
      </span>
      <CopyButton text={meeting.meeting_code} label="Copy meeting ID" />
    </li>
  );
}
