"use client";

import type { ButtonHTMLAttributes } from "react";
import { Icon, type IconName } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";

type ControlButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: IconName;
  label: string;
  /** Red icon, for "muted" and "video off". */
  alert?: boolean;
  /** Filled green square icon, for Share Screen. */
  highlight?: boolean;
  /** Selected state, for open panels. */
  active?: boolean;
  badge?: number | string;
  /** "count" is the plain superscript number (Participants). "alert" is a red dot badge (unread chat). */
  badgeTone?: "count" | "alert";
};

/** Icon-over-label toolbar button of the Zoom meeting toolbar. */
export function ControlButton({
  icon,
  label,
  alert,
  highlight,
  active,
  badge,
  badgeTone = "alert",
  className,
  ...rest
}: ControlButtonProps) {
  return (
    <button
      type="button"
      className={cn(
        "relative flex h-14 min-w-14 flex-col items-center justify-center gap-1 rounded-md px-2 text-2xs text-room-text transition-colors hover:bg-room-hover active:bg-room-press sm:min-w-16",
        active && "bg-room-hover",
        className,
      )}
      {...rest}
    >
      <span className="relative">
        {highlight ? (
          <span className="flex size-6 items-center justify-center rounded-sm bg-success text-white">
            <Icon name="arrowUp" size={16} strokeWidth={2.6} />
          </span>
        ) : (
          <Icon name={icon} size={24} strokeWidth={1.7} className={cn(alert && "text-danger")} />
        )}
        {badge !== undefined ? (
          <span
            className={cn(
              "absolute -top-1.5 -right-3 min-w-4 text-center text-2xs leading-4",
              badgeTone === "alert" ? "rounded-full bg-danger px-1 font-bold text-white" : "text-room-text",
            )}
          >
            {badge}
          </span>
        ) : null}
      </span>
      <span className="whitespace-nowrap">{label}</span>
    </button>
  );
}

/** Small caret beside Mute and Stop Video (opens device options in the real client). */
export function CaretButton({ label, onClick }: { label: string; onClick?: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="-ml-1 hidden h-14 items-start rounded-md px-0.5 pt-2.5 text-room-muted transition-colors hover:bg-room-hover hover:text-room-text sm:flex"
    >
      <Icon name="chevronUp" size={14} strokeWidth={2.2} />
    </button>
  );
}
