"use client";

import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";
import { accessLabel } from "@/lib/format";
import { copyText } from "@/lib/hooks";
import type { Meeting, MeetingAccess } from "@/lib/types";

/** Small pill that says who can join: "Verified only" or "Guests allowed". */
export function AccessBadge({ access }: { access: MeetingAccess }) {
  const verified = access === "verified_only";
  return (
    <span
      title={verified ? "Only signed-in users can join" : "Anyone with the link can join"}
      className={cn(
        "inline-flex items-center gap-1 rounded-sm px-1.5 text-2xs font-bold whitespace-nowrap",
        verified ? "bg-warning-soft text-warning-ink" : "bg-primary-soft text-primary",
      )}
    >
      <Icon name={verified ? "lock" : "users"} size={11} strokeWidth={2.2} />
      {accessLabel(access)}
    </span>
  );
}

type CopyInviteButtonProps = { meeting: Meeting; onCopied: (message: string) => void };

/** Icon button that copies the meeting invite link. */
export function CopyInviteButton({ meeting, onCopied }: CopyInviteButtonProps) {
  async function copy() {
    const ok = await copyText(meeting.invite_link);
    onCopied(ok ? "Invite link copied" : "Copy blocked by the browser");
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={`Copy invite link for ${meeting.title}`}
      title="Copy invite link"
      className="inline-flex size-8 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-surface-hover hover:text-primary max-sm:size-10"
    >
      <Icon name="copy" size={18} />
    </button>
  );
}
