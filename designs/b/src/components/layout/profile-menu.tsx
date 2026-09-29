"use client";

import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import { LogOut, Settings, UserRound } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useDismiss } from "@/lib/hooks";
import type { User } from "@/lib/types";

export function ProfileMenu({ user }: { user: User }) {
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
        aria-label="Open profile menu"
        onClick={() => setOpen((v) => !v)}
        className="focus-ring relative rounded-full"
      >
        <Avatar name={user.name} tone={1} size="sm" />
        <span className="absolute -right-0.5 -bottom-0.5 size-3 rounded-full border-2 border-surface bg-success" />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute top-11 right-0 z-40 w-72 animate-pop-in rounded-xl border border-line bg-surface p-2 shadow-pop"
        >
          <div className="flex items-center gap-3 px-2 py-2">
            <Avatar name={user.name} tone={1} size="md" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-ink">{user.name}</p>
              <p className="truncate text-xs text-ink-3">{user.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 px-2 pb-2">
            <Badge tone="success">Available</Badge>
            {user.is_demo ? <Badge tone="brand">Demo account</Badge> : null}
          </div>
          <div className="my-1 h-px bg-line" />
          <MenuRow icon={<UserRound className="size-4" />} label="Profile (placeholder)" />
          <MenuRow icon={<Settings className="size-4" />} label="Settings (placeholder)" />
          <div className="my-1 h-px bg-line" />
          <Link
            role="menuitem"
            href="/signin"
            className="focus-ring flex items-center gap-3 rounded-lg px-2 py-2 text-sm text-ink hover:bg-surface-2"
          >
            <LogOut className="size-4 text-ink-3" />
            Sign out
          </Link>
        </div>
      ) : null}
    </div>
  );
}

function MenuRow({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <button
      type="button"
      role="menuitem"
      className="focus-ring flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-sm text-ink hover:bg-surface-2"
    >
      <span className="text-ink-3">{icon}</span>
      {label}
    </button>
  );
}
