import { formatDay, formatDuration, formatMeetingCode, formatTime } from "@/lib/format";
import { demoUser } from "@/lib/mock";
import type { Meeting } from "@/lib/types";
import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { EmptyState } from "./EmptyState";

function RecentRow({ meeting }: { meeting: Meeting }) {
  const isHost = meeting.host.id === demoUser.id;
  const started = meeting.started_at!;

  return (
    <li className="flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-surface-hover">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-surface-sunken text-ink-muted">
        <Icon name={meeting.type === "instant" ? "video" : "calendar"} size={18} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink">{meeting.title}</p>
        <p className="mt-0.5 truncate text-xs text-ink-muted">
          {formatDay(started)} · {formatTime(started)} · {formatDuration(meeting.duration_min ?? 0)}
          <span className="hidden sm:inline"> · ID {formatMeetingCode(meeting.meeting_code)}</span>
        </p>
      </div>
      <div className="hidden shrink-0 text-right text-xs text-ink-muted md:block">
        {isHost ? "You hosted" : `Host: ${meeting.host.name}`}
      </div>
      <Badge tone={isHost ? "brand" : "neutral"} className="shrink-0">
        {isHost ? "Host" : "Attendee"}
      </Badge>
    </li>
  );
}

export function RecentList({ meetings }: { meetings: Meeting[] }) {
  return (
    <Card>
      <CardHeader id="recent-title" title="Recent" subtitle="Meetings you hosted or joined" />
      {meetings.length === 0 ? (
        <EmptyState icon="clock" title="No recent meetings" body="Meetings you join show here." />
      ) : (
        <ul aria-labelledby="recent-title" className="divide-y divide-line">
          {meetings.map((m) => (
            <RecentRow key={m.id} meeting={m} />
          ))}
        </ul>
      )}
    </Card>
  );
}
