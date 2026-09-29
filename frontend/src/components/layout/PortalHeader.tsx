"use client";

import Link from "next/link";
import { useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Icon } from "@/components/ui/Icon";
import { Logo } from "@/components/ui/Logo";
import { MenuItem, Popover } from "@/components/ui/Popover";
import { Toast } from "@/components/ui/Toast";
import { useSignOut, useUser } from "@/lib/auth";
import { useToast } from "@/lib/hooks";
import { useStartInstantMeeting } from "@/lib/useStartMeeting";

const navLink =
  "rounded-md px-3 py-2 text-sm font-bold text-ink-2 transition-colors hover:bg-surface-hover hover:text-primary";

type PortalHeaderProps = { onMenu: () => void };

/** White top bar of the Zoom web portal: logo, quick links, settings and profile. */
export function PortalHeader({ onMenu }: PortalHeaderProps) {
  const user = useUser();
  const [menuOpen, setMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const signOut = useSignOut();
  const host = useStartInstantMeeting();
  const toast = useToast(4000);

  async function startMeeting() {
    const error = await host.start();
    if (error) toast.show(error);
  }

  return (
    <header className="sticky top-0 z-30 flex h-header items-center gap-2 border-b border-line bg-surface px-3 sm:px-6">
      <button
        type="button"
        onClick={onMenu}
        aria-label="Open navigation"
        className="rounded-md p-2 text-ink-2 hover:bg-surface-hover lg:hidden"
      >
        <Icon name="menu" size={22} />
      </button>
      <Logo size="md" />

      <nav aria-label="Quick actions" className="ml-auto flex items-center gap-1">
        <Link href="/schedule" className={`${navLink} hidden md:inline-flex`}>
          Schedule
        </Link>
        <Link href="/join" className={`${navLink} hidden md:inline-flex`}>
          Join
        </Link>
        <button
          type="button"
          onClick={startMeeting}
          disabled={host.pending}
          className={`${navLink} hidden disabled:opacity-50 md:inline-flex`}
        >
          {host.pending ? "Starting..." : "Host"}
        </button>
        <span aria-hidden="true" className="mx-2 hidden h-6 w-px bg-line md:block" />
        <button
          type="button"
          aria-label="Settings (not available yet)"
          title="Settings"
          className="rounded-full p-2 text-ink-muted transition-colors hover:bg-surface-hover hover:text-ink"
        >
          <Icon name="settings" size={20} />
        </button>

        <Popover
          open={menuOpen}
          onClose={() => setMenuOpen(false)}
          label="Profile menu"
          placement="bottom-end"
          panelClassName="w-64 p-2"
          trigger={
            <button
              type="button"
              aria-haspopup="dialog"
              aria-expanded={menuOpen}
              aria-label={`Profile: ${user.name}`}
              onClick={() => setMenuOpen((v) => !v)}
              className="ml-1 rounded-full"
            >
              <Avatar name={user.name} src={user.avatar_url} size="sm" />
            </button>
          }
        >
          <div className="flex items-center gap-3 border-b border-line px-3 pt-2 pb-3">
            <Avatar name={user.name} src={user.avatar_url} size="md" />
            <div className="min-w-0">
              <p className="truncate text-sm font-bold">{user.name}</p>
              <p className="truncate text-xs text-ink-muted">{user.email}</p>
              {user.is_demo ? (
                <span className="mt-1 inline-block rounded-sm bg-primary-soft px-1.5 text-2xs font-bold text-primary">
                  DEMO
                </span>
              ) : null}
            </div>
          </div>
          <div className="pt-1">
            <MenuItem onSelect={() => setMenuOpen(false)}>
              <Icon name="user" size={18} /> Profile
            </MenuItem>
            <MenuItem onSelect={() => setMenuOpen(false)}>
              <Icon name="settings" size={18} /> Settings
            </MenuItem>
            <MenuItem
              onSelect={() => {
                if (signingOut) return;
                setSigningOut(true);
                void signOut();
              }}
            >
              <Icon name="signOut" size={18} /> {signingOut ? "Signing out..." : "Sign out"}
            </MenuItem>
          </div>
        </Popover>
      </nav>
      <Toast message={toast.message} tone="error" />
    </header>
  );
}
