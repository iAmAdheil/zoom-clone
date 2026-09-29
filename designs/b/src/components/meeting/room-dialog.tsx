"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/format";

type RoomDialogProps = {
  title: string;
  children?: ReactNode;
  confirmLabel: string;
  tone?: "brand" | "danger";
  onConfirm: () => void;
  onCancel: () => void;
};

/** Confirm dialog on the dark room theme. Escape cancels. */
export function RoomDialog({ title, children, confirmLabel, tone = "brand", onConfirm, onCancel }: RoomDialogProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    confirmRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onCancel}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="room-dialog-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm animate-pop-in rounded-2xl border border-room-line bg-room-3 p-5 text-room-ink shadow-room-pop"
      >
        <h2 id="room-dialog-title" className="text-base font-semibold">
          {title}
        </h2>
        {children ? <div className="mt-2 text-sm text-room-ink-2">{children}</div> : null}
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="focus-ring-room h-9 rounded-lg px-4 text-sm font-medium text-room-ink hover:bg-room-hover"
          >
            Cancel
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            className={cn(
              "focus-ring-room h-9 rounded-lg px-4 text-sm font-semibold text-white",
              tone === "danger" ? "bg-danger hover:bg-danger-hover" : "bg-brand hover:bg-brand-hover",
            )}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
