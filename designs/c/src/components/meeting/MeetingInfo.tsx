import { formatMeetingCode } from "@/lib/format";
import type { Meeting } from "@/lib/types";
import { CopyButton } from "@/components/ui/CopyButton";
import { Icon } from "@/components/ui/Icon";
import { AccessBadge } from "@/components/dashboard/AccessBadge";

/** Body of the meeting info popover (the green shield in Zoom). */
export function MeetingInfo({ meeting }: { meeting: Meeting }) {
  const rows: [string, string][] = [
    ["Meeting ID", formatMeetingCode(meeting.meeting_code)],
    ["Host", meeting.host.name],
    ["Passcode", meeting.passcode ?? "None"],
  ];

  return (
    <div className="grid w-80 max-w-[calc(100vw-2rem)] gap-4 p-4">
      <div>
        <p className="text-base font-semibold text-room-ink">{meeting.title}</p>
        <p className="mt-1 flex items-center gap-1.5 text-xs text-success">
          <Icon name="shield" size={14} />
          Encryption on
        </p>
      </div>
      <dl className="grid gap-2 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="grid grid-cols-[88px_minmax(0,1fr)] gap-3">
            <dt className="text-room-ink-muted">{k}</dt>
            <dd className="truncate font-medium text-room-ink">{v}</dd>
          </div>
        ))}
        <div className="grid grid-cols-[88px_minmax(0,1fr)] gap-3">
          <dt className="text-room-ink-muted">Access</dt>
          <dd>
            <AccessBadge access={meeting.access} tone="dark" />
          </dd>
        </div>
      </dl>
      <div className="grid gap-2 border-t border-room-line pt-4">
        <p className="text-xs text-room-ink-muted">Invite link</p>
        <code className="truncate rounded-sm bg-room-raised px-2 py-1.5 text-xs text-room-ink">
          {meeting.invite_link}
        </code>
        <CopyButton text={meeting.invite_link} label="Copy invite link" variant="primary" />
      </div>
    </div>
  );
}
