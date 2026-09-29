import type { ReactNode } from "react";
import { X } from "lucide-react";

/**
 * Right panel frame for participants and chat. It sits beside the grid
 * on desktop. On tablet and phone it covers the grid.
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
      className="absolute inset-0 z-20 flex animate-pop-in flex-col bg-room-2 text-room-ink sm:left-auto sm:w-panel sm:border-l sm:border-room-line sm:shadow-room-pop lg:static lg:shadow-none"
    >
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-room-line px-4">
        <h2 className="text-sm font-semibold">{title}</h2>
        <button
          type="button"
          aria-label={`Close ${title.toLowerCase()}`}
          onClick={onClose}
          className="focus-ring-room -mr-1 rounded-md p-1 text-room-ink-2 hover:bg-room-hover hover:text-room-ink"
        >
          <X className="size-4" />
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      {footer ? <div className="shrink-0 border-t border-room-line p-3">{footer}</div> : null}
    </aside>
  );
}
