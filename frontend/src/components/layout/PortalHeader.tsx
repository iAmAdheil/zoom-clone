"use client";

import Link from "next/link";
import { useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Icon } from "@/components/ui/Icon";
import { Logo } from "@/components/ui/Logo";
import { MenuItem, Popover } from "@/components/ui/Popover";
import { useRouter } from "next/navigation";
import { demoUser, instantMeeting } from "@/lib/mock";

const navLink =
  "rounded-md px-3 py-2 text-sm font-bold text-ink-2 transition-colors hover:bg-surface-hover hover:text-primary";

type PortalHeaderProps = { onMenu: () => void };

/** White top bar of the Zoom web portal: logo, quick links, settings and profile. */
export function PortalHeader({ onMenu }: PortalHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const router = useRouter();

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
        <Link href={`/meeting/${instantMeeting.meeting_code}`} className={`${navLink} hidden md:inline-flex`}>
          Host
        </Link>
        <span aria-hidden="true" className="mx-2 hidden h-6 w-px bg-line md:block" />
        <button
          type="button"
          aria-label="Settings (not in mockup)"
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
              aria-label={`Profile: ${demoUser.name}`}
              onClick={() => setMenuOpen((v) => !v)}
              className="ml-1 rounded-full"
            >
              <Avatar name={demoUser.name} size="sm" />
            </button>
          }
        >
          <div className="flex items-center gap-3 border-b border-line px-3 pt-2 pb-3">
            <Avatar name={demoUser.name} size="md" />
            <div className="min-w-0">
              <p className="truncate text-sm font-bold">{demoUser.name}</p>
              <p className="truncate text-xs text-ink-muted">{demoUser.email}</p>
              <span className="mt-1 inline-block rounded-sm bg-primary-soft px-1.5 text-2xs font-bold text-primary">
                DEMO
              </span>
            </div>
          </div>
          <div className="pt-1">
            <MenuItem onSelect={() => setMenuOpen(false)}>
              <Icon name="user" size={18} /> Profile
            </MenuItem>
            <MenuItem onSelect={() => setMenuOpen(false)}>
              <Icon name="settings" size={18} /> Settings
            </MenuItem>
            <MenuItem onSelect={() => router.push("/signin")}>
              <Icon name="signOut" size={18} /> Sign out
            </MenuItem>
          </div>
        </Popover>
      </nav>
    </header>
  );
}
