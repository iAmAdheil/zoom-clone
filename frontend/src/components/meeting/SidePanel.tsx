import type { ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";

type SidePanelProps = {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
};

/**
 * White right-hand panel of the Zoom web client (Participants, Chat).
 * Tablet and desktop: a column beside the video. Phone: full screen.
 */
export function SidePanel({ title, onClose, children, footer }: SidePanelProps) {
  return (
    <aside
      aria-label={title}
      className="fixed inset-0 z-40 flex flex-col bg-surface text-ink md:static md:z-auto md:w-panel md:shrink-0"
    >
      <header className="relative flex h-12 shrink-0 items-center justify-center border-b border-line px-10">
        <h2 className="truncate text-sm font-bold">{title}</h2>
        <div className="absolute right-2 flex items-center gap-0.5">
          <span
            title="Pop out (not in mockup)"
            className="hidden rounded-md p-1.5 text-ink-subtle lg:inline-flex"
          >
            <Icon name="popOut" size={16} />
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label={`Close ${title}`}
            className="rounded-md p-1.5 text-ink-muted transition-colors hover:bg-surface-hover hover:text-ink"
          >
            <Icon name="close" size={18} />
          </button>
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      {footer ? <footer className="shrink-0 border-t border-line p-3">{footer}</footer> : null}
    </aside>
  );
}
