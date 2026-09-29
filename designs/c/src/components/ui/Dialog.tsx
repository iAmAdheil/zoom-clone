"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { cn } from "@/lib/cn";

type DialogProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  tone?: "light" | "dark";
};

/** A small modal built on the native <dialog> element. */
export function Dialog({ open, onClose, title, children, footer, tone = "dark" }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      data-theme={tone === "dark" ? "dark" : undefined}
      className={cn(
        "m-auto w-[calc(100vw-2rem)] max-w-md rounded-lg p-0 backdrop:bg-scrim open:animate-pop-in",
        tone === "dark" ? "bg-room-panel text-room-ink shadow-pop-dark" : "bg-surface text-ink shadow-pop",
      )}
    >
      <div className="grid gap-3 p-5">
        <h2 id={titleId} className="text-base font-semibold">
          {title}
        </h2>
        <div className={cn("text-sm", tone === "dark" ? "text-room-ink-muted" : "text-ink-muted")}>
          {children}
        </div>
      </div>
      {footer && <div className="flex justify-end gap-2 px-5 pb-5">{footer}</div>}
    </dialog>
  );
}
