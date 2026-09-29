import Link from "next/link";
import { Bell, Search, Settings } from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { demoUser } from "@/lib/mock";
import { ProfileMenu } from "./profile-menu";

const iconButton =
  "focus-ring inline-flex size-9 items-center justify-center rounded-lg text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink";

export function TopBar() {
  return (
    <header className="sticky top-0 z-30 flex h-topbar items-center gap-3 border-b border-line bg-surface px-4 md:px-5">
      <Link href="/" aria-label="Zoom Workplace home" className="focus-ring shrink-0 rounded-md">
        <Logo />
      </Link>

      <div className="mx-auto hidden w-full max-w-md md:block">
        <label className="relative block">
          <span className="sr-only">Search</span>
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-3" />
          <input
            type="search"
            placeholder="Search meetings, people, chats"
            className="h-9 w-full rounded-lg border border-transparent bg-surface-2 pr-14 pl-9 text-sm text-ink placeholder:text-ink-3 transition-colors hover:border-line-strong focus:border-brand focus:bg-surface focus:outline-none focus:ring-3 focus:ring-brand-soft-2"
          />
          <kbd className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 rounded border border-line bg-surface px-1.5 font-sans text-[10px] text-ink-3">
            ⌘F
          </kbd>
        </label>
      </div>

      <div className="ml-auto flex items-center gap-1 md:ml-0">
        <button type="button" aria-label="Search" className={`${iconButton} md:hidden`}>
          <Search className="size-5" />
        </button>
        <button type="button" aria-label="Notifications (placeholder)" className={`${iconButton} relative`}>
          <Bell className="size-5" />
          <span className="absolute top-2 right-2 size-2 rounded-full bg-danger" />
        </button>
        <button type="button" aria-label="Settings (placeholder)" className={iconButton}>
          <Settings className="size-5" />
        </button>
        <div className="ml-1">
          <ProfileMenu user={demoUser} />
        </div>
      </div>
    </header>
  );
}
