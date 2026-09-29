"use client";

import { Icon } from "@/components/ui/Icon";
import { formatMeetingCode } from "@/lib/format";
import { copyText } from "@/lib/hooks";
import type { Meeting } from "@/lib/types";

type InviteLinkBoxProps = {
  meeting: Meeting;
  onCopied: (message: string) => void;
  tone?: "dark" | "light";
};

/** Invite link with copy actions. Used by the meeting info popover and the Invite button. */
export function InviteLinkBox({ meeting, onCopied, tone = "dark" }: InviteLinkBoxProps) {
  const linkClass =
    tone === "dark" ? "text-room-link hover:underline" : "text-primary hover:underline";

  async function copy(text: string, label: string) {
    const ok = await copyText(text);
    onCopied(ok ? `${label} copied` : "Copy blocked by the browser");
  }

  const invitation = [
    `${meeting.host.name} is inviting you to a Zoom meeting.`,
    `Topic: ${meeting.title}`,
    `Join: ${meeting.invite_link}`,
    `Meeting ID: ${formatMeetingCode(meeting.meeting_code)}`,
    meeting.passcode ? `Passcode: ${meeting.passcode}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm break-all">{meeting.invite_link}</p>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        <button
          type="button"
          onClick={() => copy(meeting.invite_link, "Invite link")}
          className={`inline-flex items-center gap-1.5 rounded-sm ${linkClass}`}
        >
          <Icon name="copy" size={16} /> Copy Link
        </button>
        <button
          type="button"
          onClick={() => copy(invitation, "Invitation")}
          className={`inline-flex items-center gap-1.5 rounded-sm ${linkClass}`}
        >
          <Icon name="link" size={16} /> Copy Invitation
        </button>
      </div>
    </div>
  );
}
