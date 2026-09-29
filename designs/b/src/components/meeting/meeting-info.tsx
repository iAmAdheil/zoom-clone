"use client";

import { ShieldCheck, X } from "lucide-react";
import { CopyButton } from "@/components/ui/copy-button";
import { formatMeetingCode } from "@/lib/format";
import type { Meeting } from "@/lib/types";

type MeetingInfoProps = {
  meeting: Meeting;
  open: boolean;
  onClose: () => void;
};

function invitationText(m: Meeting) {
  return [
    `${m.host.name} is inviting you to a meeting.`,
    `Topic: ${m.title}`,
    `Join: ${m.invite_link}`,
    `Meeting ID: ${formatMeetingCode(m.meeting_code)}`,
    m.passcode ? `Passcode: ${m.passcode}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

/** Popover with meeting details and the invite link. */
export function MeetingInfo({ meeting, open, onClose }: MeetingInfoProps) {
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-label="Meeting information"
      className="absolute top-full left-0 z-40 mt-2 w-sm animate-pop-in max-sm:fixed max-sm:inset-x-2 max-sm:top-14 max-sm:mt-0 max-sm:w-auto rounded-2xl border border-room-line bg-room-3 p-5 text-room-ink shadow-room-pop"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-base font-semibold">{meeting.title}</h2>
          <p className="mt-0.5 flex items-center gap-1 text-xs text-speaker">
            <ShieldCheck className="size-3.5" />
            {meeting.access === "verified_only" ? "Verified users only" : "Guests allowed"}
          </p>
        </div>
        <button
          type="button"
          aria-label="Close meeting information"
          onClick={onClose}
          className="focus-ring-room -m-1 rounded-md p-1 text-room-ink-2 hover:bg-room-hover hover:text-room-ink"
        >
          <X className="size-4" />
        </button>
      </div>

      <dl className="mt-4 grid grid-cols-[6.5rem_minmax(0,1fr)] gap-y-2.5 text-sm">
        <dt className="text-room-ink-3">Meeting ID</dt>
        <dd className="tabular-nums">{formatMeetingCode(meeting.meeting_code)}</dd>
        <dt className="text-room-ink-3">Host</dt>
        <dd className="truncate">{meeting.host.name}</dd>
        <dt className="text-room-ink-3">Passcode</dt>
        <dd className="font-mono">{meeting.passcode ?? "None"}</dd>
        <dt className="text-room-ink-3">Invite link</dt>
        <dd className="flex min-w-0 items-center gap-1">
          <span className="truncate text-brand-soft-2">{meeting.invite_link}</span>
          <CopyButton text={meeting.invite_link} label="Copy link" theme="room" className="shrink-0" />
        </dd>
      </dl>

      <div className="mt-5 grid grid-cols-2 gap-2">
        <CopyButton text={meeting.invite_link} label="Copy link" display="text" theme="room" />
        <CopyButton text={invitationText(meeting)} label="Copy invitation" display="text" theme="room" />
      </div>
    </div>
  );
}
