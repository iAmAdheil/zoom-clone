"use client";

import { useRef, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { useDismiss } from "@/lib/useDismiss";

type PopoverProps = {
  open: boolean;
  onClose: () => void;
  /** The button that opens the popover. It stays inside the dismiss area. */
  trigger: ReactNode;
  children: ReactNode;
  placement?: "top" | "bottom";
  align?: "start" | "center" | "end";
  label: string;
  className?: string;
};

/** A dark popover for the meeting room. Closes on outside click and Escape. */
export function Popover({
  open,
  onClose,
  trigger,
  children,
  placement = "top",
  align = "center",
  label,
  className,
}: PopoverProps) {
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(ref, open, onClose);

  return (
    <div ref={ref} className="relative">
      {trigger}
      {open && (
        <div
          role="dialog"
          aria-label={label}
          className={cn(
            "absolute z-40 animate-pop-in rounded-lg border border-room-line bg-room-panel text-room-ink shadow-pop-dark",
            placement === "top" ? "bottom-full mb-2" : "top-full mt-2",
            align === "start" && "left-0",
            align === "center" && "left-1/2 -translate-x-1/2",
            align === "end" && "right-0",
            className,
          )}
        >
          {children}
        </div>
      )}
    </div>
  );
}
