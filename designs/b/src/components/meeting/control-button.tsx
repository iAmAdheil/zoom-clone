"use client";

import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/format";

type ControlButtonProps = ComponentProps<"button"> & {
  icon: ReactNode;
  label: string;
  /** Small count bubble, for example the participant count. */
  count?: number;
  /** Red dot for unread items. */
  dot?: boolean;
  active?: boolean;
};

/** Icon over label, like the Zoom Workplace meeting toolbar. */
export function ControlButton({ icon, label, count, dot, active, className, ...props }: ControlButtonProps) {
  return (
    <button
      type="button"
      className={cn(
        "focus-ring-room relative flex h-14 min-w-14 flex-col items-center justify-center gap-1 rounded-lg px-2 text-[11px] font-medium text-room-ink transition-colors hover:bg-room-hover active:bg-room-3",
        active && "bg-room-3",
        className,
      )}
      {...props}
    >
      <span className="relative">
        {icon}
        {typeof count === "number" ? (
          <span className="absolute -top-1.5 -right-3 min-w-4 rounded-full bg-room-3 px-1 text-[10px] leading-4 text-room-ink">
            {count}
          </span>
        ) : null}
        {dot ? <span className="absolute -top-0.5 -right-1 size-2 rounded-full bg-danger" /> : null}
      </span>
      <span className="whitespace-nowrap">{label}</span>
    </button>
  );
}

/** Small caret next to mic and camera buttons (audio and video settings). */
export function CaretButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={`${label} (placeholder)`}
      className="focus-ring-room -ml-1 hidden h-7 w-5 items-center justify-center self-start rounded-md text-room-ink-2 hover:bg-room-hover hover:text-room-ink sm:flex"
    >
      <svg viewBox="0 0 12 12" className="size-3" aria-hidden>
        <path d="M3 7.5l3-3 3 3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </button>
  );
}
