"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { Popover } from "@/components/ui/Popover";
import { formatMeetingCode, passcodeText } from "@/lib/format";
import type { Meeting } from "@/lib/types";
import { InviteLinkBox } from "./InviteLinkBox";

type MeetingInfoPopoverProps = { meeting: Meeting; onCopied: (message: string) => void };

/** Green shield in the top-left corner. It opens the dark meeting information card. */
export function MeetingInfoPopover({ meeting, onCopied }: MeetingInfoPopoverProps) {
  const [open, setOpen] = useState(false);

  const rows: Array<[string, string]> = [
    ["Meeting ID", formatMeetingCode(meeting.meeting_code)],
    ["Host", meeting.host.name],
    ["Passcode", passcodeText(meeting)],
    ["Access", meeting.access === "allow_guests" ? "Guests allowed" : "Verified users only"],
  ];

  return (
    <Popover
      open={open}
      onClose={() => setOpen(false)}
      label="Meeting information"
      tone="dark"
      placement="bottom-start"
      panelClassName="w-[min(420px,calc(100vw-24px))] p-5"
      trigger={
        <button
          type="button"
          aria-label="Meeting information"
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="flex size-8 items-center justify-center rounded-md text-success transition-colors hover:bg-room-hover max-sm:size-10"
        >
          <Icon name="shield" size={20} strokeWidth={2} />
        </button>
      }
    >
      <h2 className="mb-4 text-base font-bold">{meeting.title}</h2>
      <dl className="grid grid-cols-[96px_1fr] gap-x-3 gap-y-2.5 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-room-muted">{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
        <dt className="text-room-muted">Invite Link</dt>
        <dd>
          <InviteLinkBox meeting={meeting} onCopied={onCopied} />
        </dd>
        <dt className="text-room-muted">Encryption</dt>
        <dd className="inline-flex items-center gap-1">
          <Icon name="lock" size={14} className="text-success" /> Enabled
        </dd>
      </dl>
    </Popover>
  );
}
