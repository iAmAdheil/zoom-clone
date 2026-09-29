import type { ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";

/**
 * Right-hand panel in the room. On tablets and desktops it is a column
 * next to the video. On phones it covers the screen, like the Zoom app sheet.
 */
export function SidePanel({
  title,
  onClose,
  children,
  footer,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <aside
      aria-label={title}
      className="fixed inset-0 z-40 flex animate-pop-in flex-col bg-room-panel md:static md:z-auto md:m-2 md:ml-0 md:w-panel md:shrink-0 md:rounded-lg md:border md:border-room-line"
    >
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-room-line px-4">
        <h2 className="text-sm font-semibold text-room-ink">{title}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label={`Close ${title}`}
          className="flex size-8 items-center justify-center rounded-md text-room-ink-muted transition-colors hover:bg-room-hover hover:text-room-ink"
        >
          <Icon name="x" size={18} />
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      {footer && <footer className="shrink-0 border-t border-room-line p-3">{footer}</footer>}
    </aside>
  );
}
