import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { Logo } from "@/components/ui/Logo";
import { ProfileMenu } from "./ProfileMenu";

const iconButton =
  "inline-flex size-9 items-center justify-center rounded-full text-ink-2 transition-colors hover:bg-surface-hover hover:text-ink";

export function TopNav() {
  return (
    <header className="sticky top-0 z-30 flex h-topnav shrink-0 items-center gap-3 border-b border-line bg-surface px-4 md:px-5">
      <Link href="/" aria-label="Home" className="flex items-center gap-2 rounded-sm">
        <Logo size="md" />
        <span className="hidden text-lg font-semibold text-ink sm:inline">Workplace</span>
      </Link>

      <div className="mx-auto hidden w-full max-w-md md:block">
        <label htmlFor="global-search" className="sr-only">
          Search
        </label>
        <div className="relative">
          <Icon
            name="search"
            size={16}
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-muted"
          />
          <input
            id="global-search"
            type="search"
            placeholder="Search meetings, people"
            className="h-9 w-full rounded-full border border-transparent bg-surface-sunken pr-4 pl-9 text-sm text-ink placeholder:text-ink-muted transition-colors hover:border-line-strong focus:border-brand focus:bg-surface focus:outline-none"
          />
        </div>
      </div>

      <div className="ml-auto flex items-center gap-1 md:ml-0">
        <button type="button" aria-label="Search" className={`${iconButton} md:hidden`}>
          <Icon name="search" size={20} />
        </button>
        <button type="button" aria-label="Notifications" className={`${iconButton} relative`}>
          <Icon name="bell" size={20} />
          <span className="absolute top-2 right-2 size-2 rounded-full bg-danger ring-2 ring-surface" />
        </button>
        <button type="button" aria-label="Settings" className={iconButton}>
          <Icon name="settings" size={20} />
        </button>
        <ProfileMenu />
      </div>
    </header>
  );
}
