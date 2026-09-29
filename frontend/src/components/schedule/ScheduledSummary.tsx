"use client";

import { AccessBadge } from "@/components/dashboard/MeetingRowBits";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Toast } from "@/components/ui/Toast";
import { formatDay, formatMeetingCode, formatTimeRange } from "@/lib/format";
import { copyText, useToast } from "@/lib/hooks";
import type { Meeting } from "@/lib/types";

type ScheduledSummaryProps = { meeting: Meeting; timezoneLabel: string; onEdit: () => void };

/** Meeting details page shown after Save, like the Zoom portal does. */
export function ScheduledSummary({ meeting, timezoneLabel, onEdit }: ScheduledSummaryProps) {
  const toast = useToast();
  const start = meeting.scheduled_start;
  const code = formatMeetingCode(meeting.meeting_code);

  // Times show in the meeting time zone, next to its label.
  const rows: Array<[string, string]> = [
    ["Topic", meeting.title],
    ["Description", meeting.description ?? "None"],
    [
      "Time",
      start
        ? `${formatDay(start, meeting.timezone)}, ${formatTimeRange(start, meeting.duration_min ?? 0, meeting.timezone)} ${timezoneLabel}`
        : "Not set",
    ],
    ["Meeting ID", code],
    ["Security", meeting.passcode ? `Passcode ${meeting.passcode}` : "No passcode"],
  ];

  async function copyInvite() {
    const text = [
      `${meeting.host.name} is inviting you to a Zoom meeting.`,
      `Topic: ${meeting.title}`,
      `Join: ${meeting.invite_link}`,
      `Meeting ID: ${code}`,
      meeting.passcode ? `Passcode: ${meeting.passcode}` : null,
    ]
      .filter(Boolean)
      .join("\n");
    const ok = await copyText(text);
    toast.show(ok ? "Invitation copied" : "Copy blocked by the browser");
  }

  return (
    <div className="max-w-form">
      <div role="status" className="mb-6 flex items-center gap-2 rounded-md bg-primary-soft px-4 py-3 text-sm text-ink">
        <Icon name="check" size={18} className="text-primary" />
        Your meeting is scheduled.
      </div>

      <dl className="divide-y divide-line border-y border-line">
        {rows.map(([k, v]) => (
          <div key={k} className="grid gap-1 py-4 sm:grid-cols-[160px_1fr] sm:gap-6">
            <dt className="text-sm font-bold text-ink-2">{k}</dt>
            <dd className="text-sm break-words text-ink">{v}</dd>
          </div>
        ))}
        <div className="grid gap-1 py-4 sm:grid-cols-[160px_1fr] sm:gap-6">
          <dt className="text-sm font-bold text-ink-2">Meeting access</dt>
          <dd className="text-sm">
            <AccessBadge access={meeting.access} />
          </dd>
        </div>
        <div className="grid gap-1 py-4 sm:grid-cols-[160px_1fr] sm:gap-6">
          <dt className="text-sm font-bold text-ink-2">Invite Link</dt>
          <dd className="flex flex-wrap items-center gap-3 text-sm">
            <span className="break-all text-primary">{meeting.invite_link}</span>
            <Button variant="link" onClick={copyInvite}>
              <Icon name="copy" size={16} /> Copy Invitation
            </Button>
          </dd>
        </div>
      </dl>

      <div className="mt-6 flex flex-wrap gap-3">
        <ButtonLink href={`/meeting/${meeting.meeting_code}`}>Start this Meeting</ButtonLink>
        <Button variant="secondary" onClick={onEdit}>
          Edit
        </Button>
        <ButtonLink href="/" variant="ghost">
          Back to Home
        </ButtonLink>
      </div>
      <Toast message={toast.message} />
    </div>
  );
}
