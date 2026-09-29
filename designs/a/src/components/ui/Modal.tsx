"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useDismiss } from "@/lib/hooks";
import { Icon } from "./Icon";

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
};

/** Centered dialog on a scrim, in the light Zoom dialog style. */
export function Modal({ open, onClose, title, children, footer }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  useDismiss(panelRef, open, onClose);

  // Move focus into the dialog when it opens.
  useEffect(() => {
    if (!open) return;
    const first = panelRef.current?.querySelector<HTMLElement>(
      "input, button:not([data-close]), select, textarea",
    );
    first?.focus();
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-scrim p-4">
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className="w-full max-w-sm rounded-lg bg-surface text-ink shadow-popover"
      >
        <div className="flex items-center justify-between px-5 pt-4">
          <h2 id="modal-title" className="text-base font-bold">
            {title}
          </h2>
          <button
            type="button"
            data-close
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1 text-ink-muted hover:bg-surface-hover hover:text-ink"
          >
            <Icon name="close" size={18} />
          </button>
        </div>
        <div className="px-5 py-3 text-sm text-ink-2">{children}</div>
        {footer ? <div className="flex justify-end gap-2 px-5 pt-1 pb-4">{footer}</div> : null}
      </div>
    </div>
  );
}
