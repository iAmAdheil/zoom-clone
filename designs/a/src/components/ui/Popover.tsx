"use client";

import { useRef, type ReactNode } from "react";
import { useDismiss } from "@/lib/hooks";
import { cn } from "@/lib/cn";

type PopoverProps = {
  open: boolean;
  onClose: () => void;
  /** The trigger button. It stays inside the dismiss area. */
  trigger: ReactNode;
  children: ReactNode;
  placement?: "bottom-start" | "bottom-end" | "top-start" | "top-center" | "top-end";
  tone?: "light" | "dark";
  label: string;
  className?: string;
  panelClassName?: string;
};

const placements = {
  "bottom-start": "top-full left-0 mt-2",
  "bottom-end": "top-full right-0 mt-2",
  "top-start": "bottom-full left-0 mb-2",
  "top-center": "bottom-full left-1/2 -translate-x-1/2 mb-2",
  "top-end": "bottom-full right-0 mb-2",
};

/** Anchored panel. Escape or a click outside closes it. */
export function Popover({
  open,
  onClose,
  trigger,
  children,
  placement = "bottom-start",
  tone = "light",
  label,
  className,
  panelClassName,
}: PopoverProps) {
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(ref, open, onClose);

  return (
    <div ref={ref} className={cn("relative", className)}>
      {trigger}
      {open ? (
        <div
          role="dialog"
          aria-label={label}
          className={cn(
            "absolute z-40 rounded-lg shadow-popover",
            tone === "light"
              ? "border border-line bg-surface text-ink"
              : "border border-room-line bg-room-popover text-room-text",
            placements[placement],
            panelClassName,
          )}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}

type MenuItemProps = {
  children: ReactNode;
  onSelect: () => void;
  tone?: "light" | "dark";
  danger?: boolean;
};

/** One row in a popover menu. */
export function MenuItem({ children, onSelect, tone = "light", danger }: MenuItemProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors",
        tone === "light" ? "hover:bg-surface-hover" : "hover:bg-room-hover",
        danger ? "text-danger" : tone === "light" ? "text-ink" : "text-room-text",
      )}
    >
      {children}
    </button>
  );
}
