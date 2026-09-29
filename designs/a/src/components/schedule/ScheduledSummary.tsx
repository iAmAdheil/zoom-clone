"use client";

import { Button, ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Toast } from "@/components/ui/Toast";
import { formatDay, formatMeetingCode, formatTimeRange } from "@/lib/format";
import { copyText, useToast } from "@/lib/hooks";
import type { MeetingAccess } from "@/lib/types";

export type ScheduledMeeting = {
  title: string;
  description: string | null;
  start: string;
  duration: number;
  timezoneLabel: string;
  access: MeetingAccess;
  passcode: string | null;
  waitingRoom: boolean;
  code: string;
};

/** Meeting details page shown after Save, like the Zoom portal does. */
export function ScheduledSummary({ meeting, onEdit }: { meeting: ScheduledMeeting; onEdit: () => void }) {
  const toast = useToast();
  const link = `https://zoomclone.dev/j/${meeting.code}${meeting.passcode ? `?pwd=${meeting.passcode}` : ""}`;

  const rows: Array<[string, string]> = [
    ["Topic", meeting.title],
    ["Description", meeting.description ?? "None"],
    ["Time", `${formatDay(meeting.start)}, ${formatTimeRange(meeting.start, meeting.duration)} ${meeting.timezoneLabel}`],
    ["Meeting ID", formatMeetingCode(meeting.code)],
    [
      "Security",
      [meeting.passcode ? `Passcode ${meeting.passcode}` : "No passcode", meeting.waitingRoom ? "Waiting Room" : null]
        .filter(Boolean)
        .join(", "),
    ],
    ["Meeting access", meeting.access === "allow_guests" ? "Guests allowed" : "Verified users only"],
  ];

  async function copyInvite() {
    const ok = await copyText(`${meeting.title}\n${link}\nMeeting ID: ${formatMeetingCode(meeting.code)}`);
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
          <dt className="text-sm font-bold text-ink-2">Invite Link</dt>
          <dd className="flex flex-wrap items-center gap-3 text-sm">
            <span className="break-all text-primary">{link}</span>
            <Button variant="link" onClick={copyInvite}>
              <Icon name="copy" size={16} /> Copy Invitation
            </Button>
          </dd>
        </div>
      </dl>

      <div className="mt-6 flex flex-wrap gap-3">
        <ButtonLink href={`/meeting/${meeting.code}`}>Start this Meeting</ButtonLink>
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
