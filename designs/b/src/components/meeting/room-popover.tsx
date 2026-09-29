"use client";

import { useRef, type ReactNode } from "react";
import { cn } from "@/lib/format";
import { useDismiss } from "@/lib/hooks";

type RoomPopoverProps = {
  open: boolean;
  onClose: () => void;
  trigger: ReactNode;
  children: ReactNode;
  align?: "center" | "end";
  side?: "top" | "bottom";
  label: string;
  className?: string;
};

/**
 * Popover that opens above a toolbar button. Clicks outside the trigger
 * and the panel close it, and so does Escape.
 */
export function RoomPopover({
  open,
  onClose,
  trigger,
  children,
  align = "center",
  side = "top",
  label,
  className,
}: RoomPopoverProps) {
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(ref, open, onClose);

  return (
    <div ref={ref} className="relative">
      {trigger}
      {open ? (
        <div
          role="dialog"
          aria-label={label}
          className={cn(
            "absolute z-40 animate-pop-in rounded-xl border border-room-line bg-room-3 p-2 text-room-ink shadow-room-pop",
            side === "top" ? "bottom-full mb-2" : "top-full mt-1",
            align === "center" ? "left-1/2 -translate-x-1/2" : "right-0",
            className,
          )}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}

export function RoomMenuItem({
  icon,
  children,
  onClick,
  tone = "default",
}: {
  icon?: ReactNode;
  children: ReactNode;
  onClick?: () => void;
  tone?: "default" | "danger";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "focus-ring-room flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-room-hover",
        tone === "danger" ? "text-danger" : "text-room-ink",
      )}
    >
      {icon ? <span className="text-room-ink-2">{icon}</span> : null}
      {children}
    </button>
  );
}
