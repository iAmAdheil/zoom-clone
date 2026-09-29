"use client";

import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import { demoUser } from "@/lib/mock";
import { useDismiss } from "@/lib/useDismiss";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";

/** Avatar button with a small account menu. Menu items are placeholders. */
export function ProfileMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(ref, open, close);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 rounded-full p-0.5 transition-colors hover:bg-surface-hover"
      >
        <Avatar name={demoUser.name} size="sm" />
        <Icon name="chevronDown" size={14} className="hidden text-ink-muted sm:block" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute top-full right-0 z-40 mt-2 w-72 animate-pop-in rounded-lg border border-line bg-surface p-2 shadow-pop"
        >
          <div className="flex items-center gap-3 px-3 py-3">
            <Avatar name={demoUser.name} size="md" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{demoUser.name}</p>
              <p className="truncate text-xs text-ink-muted">{demoUser.email}</p>
            </div>
            <Badge tone="brand" className="ml-auto">
              Demo
            </Badge>
          </div>
          <div className="my-1 border-t border-line" />
          <button
            type="button"
            role="menuitem"
            aria-disabled="true"
            className="flex h-10 w-full items-center gap-3 rounded-md px-3 text-sm text-ink-faint"
          >
            <Icon name="contacts" size={18} /> Profile
          </button>
          <button
            type="button"
            role="menuitem"
            aria-disabled="true"
            className="flex h-10 w-full items-center gap-3 rounded-md px-3 text-sm text-ink-faint"
          >
            <Icon name="settings" size={18} /> Settings
          </button>
          <Link
            role="menuitem"
            href="/signin"
            className="flex h-10 w-full items-center gap-3 rounded-md px-3 text-sm text-ink-2 hover:bg-surface-hover"
          >
            <Icon name="signOut" size={18} /> Sign out
          </Link>
        </div>
      )}
    </div>
  );
}
