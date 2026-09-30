"use client";

import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";
import { useDismiss } from "@/lib/hooks";
import type { DeviceOption } from "@/lib/webrtc/devices";

// A toolbar button with a "^" caret, like Mute and Stop Video in Zoom. The button and the caret
// share one hover box of the same height. The caret opens a device menu above the toolbar.

export type MenuGroup = {
  label: string;
  options: DeviceOption[];
  selectedId: string | null;
  onSelect: (id: string) => void;
};

export type MenuAction = { label: string; onSelect: () => void };

type SplitControlProps = {
  /** The main button: a ControlButton with `grouped`. */
  children: ReactNode;
  /** The name of the caret and of the menu, for example "Audio options". */
  label: string;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  groups: MenuGroup[];
  actions?: MenuAction[];
  /** Shown when the menu has no option and no action. */
  emptyText: string;
  /** False when the browser cannot list the devices. Then only the main button shows. */
  showCaret: boolean;
};

function menuItems(menu: HTMLElement | null): HTMLElement[] {
  return menu ? [...menu.querySelectorAll<HTMLElement>('[role^="menuitem"]')] : [];
}

const itemClass =
  "flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-room-text transition-colors hover:bg-room-hover focus-visible:bg-room-hover focus-visible:outline-none";

export function SplitControl({
  children,
  label,
  open,
  onToggle,
  onClose,
  groups,
  actions = [],
  emptyText,
  showCaret,
}: SplitControlProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const caretRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  useDismiss(rootRef, open, onClose);

  // Keyboard users land on the checked device (or the first item) when the menu opens.
  useEffect(() => {
    if (!open) return;
    const items = menuItems(menuRef.current);
    (items.find((item) => item.getAttribute("aria-checked") === "true") ?? items[0])?.focus();
  }, [open]);

  function closeToCaret() {
    onClose();
    caretRef.current?.focus();
  }

  function onMenuKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const items = menuItems(menuRef.current);
    const index = items.indexOf(document.activeElement as HTMLElement);
    const focusAt = (next: number) => {
      e.preventDefault();
      items[(next + items.length) % items.length]?.focus();
    };
    if (e.key === "ArrowDown") focusAt(index + 1);
    else if (e.key === "ArrowUp") focusAt(index - 1);
    else if (e.key === "Home") focusAt(0);
    else if (e.key === "End") focusAt(items.length - 1);
    else if (e.key === "Escape") {
      e.preventDefault();
      closeToCaret();
    } else if (e.key === "Tab") onClose();
  }

  function onCaretKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    if ((e.key === "ArrowUp" || e.key === "ArrowDown") && !open) {
      e.preventDefault();
      onToggle();
    }
  }

  const hasItems = actions.length > 0 || groups.some((g) => g.options.length > 0);

  return (
    <div
      ref={rootRef}
      className={cn("relative flex h-14 items-stretch rounded-md transition-colors hover:bg-room-hover", open && "bg-room-hover")}
    >
      {children}
      {showCaret ? (
        <button
          ref={caretRef}
          type="button"
          aria-label={label}
          title={label}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls={open ? menuId : undefined}
          onClick={onToggle}
          onKeyDown={onCaretKeyDown}
          className="flex w-4 items-start justify-center rounded-r-md pt-2.5 sm:w-5 text-room-muted transition-colors hover:bg-room-press hover:text-room-text focus-visible:-outline-offset-2 active:bg-room-press"
        >
          <Icon name="chevronUp" size={14} strokeWidth={2.2} />
        </button>
      ) : null}

      {open ? (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label={label}
          onKeyDown={onMenuKeyDown}
          className="absolute bottom-full left-0 z-40 mb-2 w-72 max-w-[calc(100vw-16px)] rounded-lg border border-room-line bg-room-popover p-1.5 shadow-popover"
        >
          {groups.map((group) =>
            group.options.length > 0 ? (
              <div key={group.label} role="group" aria-label={group.label} className="pb-1">
                <p aria-hidden="true" className="px-3 pt-1.5 pb-1 text-2xs font-bold text-room-muted">
                  {group.label}
                </p>
                {group.options.map((option) => {
                  const checked = option.id === group.selectedId;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      role="menuitemradio"
                      aria-checked={checked}
                      tabIndex={-1}
                      onClick={() => {
                        group.onSelect(option.id);
                        closeToCaret();
                      }}
                      className={itemClass}
                    >
                      <span className="flex w-4 shrink-0 justify-center">
                        {checked ? <Icon name="check" size={14} strokeWidth={2.4} /> : null}
                      </span>
                      <span className="truncate">{option.label}</span>
                    </button>
                  );
                })}
              </div>
            ) : null,
          )}
          {actions.length > 0 ? (
            <div className={cn(groups.some((g) => g.options.length > 0) && "border-t border-room-line pt-1")}>
              {actions.map((action) => (
                <button
                  key={action.label}
                  type="button"
                  role="menuitem"
                  tabIndex={-1}
                  onClick={() => {
                    closeToCaret();
                    action.onSelect();
                  }}
                  className={cn(itemClass, "text-room-link")}
                >
                  <span className="w-4 shrink-0" />
                  {action.label}
                </button>
              ))}
            </div>
          ) : null}
          {hasItems ? null : <p className="px-3 py-2 text-sm text-room-muted">{emptyText}</p>}
        </div>
      ) : null}
    </div>
  );
}
