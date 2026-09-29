"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { primaryNav, secondaryNav, type NavItem } from "@/lib/nav";
import { Icon } from "@/components/ui/Icon";

// Wide screens: icon + label. Tablet: icon rail. Phone: hidden (TabBar takes over).
const itemClass =
  "group flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors md:max-lg:h-14 md:max-lg:flex-col md:max-lg:justify-center md:max-lg:gap-1 md:max-lg:px-1 md:max-lg:text-2xs";

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  if (!item.href) {
    return (
      <span
        aria-disabled="true"
        title="Not part of this mockup"
        className={cn(itemClass, "cursor-not-allowed text-ink-faint")}
      >
        <Icon name={item.icon} size={20} />
        <span>{item.label}</span>
        <span className="ml-auto rounded-full bg-surface-sunken px-1.5 py-0.5 text-2xs font-semibold text-ink-muted md:max-lg:hidden">
          Soon
        </span>
      </span>
    );
  }
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        itemClass,
        active ? "bg-brand-soft text-brand" : "text-ink-2 hover:bg-surface-hover hover:text-ink",
      )}
    >
      <Icon name={item.icon} size={20} strokeWidth={active ? 2.1 : 1.8} />
      <span>{item.label}</span>
    </Link>
  );
}

export function SideNav() {
  const pathname = usePathname();
  const isActive = (href: string | null) =>
    href !== null && (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    // The outer column stretches with the page. The inner nav sticks under the top bar.
    <div className="hidden shrink-0 border-r border-line bg-surface md:block md:w-rail lg:w-sidenav">
      <nav
        aria-label="Main"
        className="sticky top-topnav flex h-[calc(100dvh-var(--spacing-topnav))] flex-col justify-between px-3 py-4 md:max-lg:px-2"
      >
        <ul className="grid gap-1">
          {primaryNav.map((item) => (
            <li key={item.label}>
              <NavLink item={item} active={isActive(item.href)} />
            </li>
          ))}
        </ul>
        <ul className="grid gap-1 border-t border-line pt-3">
          {secondaryNav.map((item) => (
            <li key={item.label}>
              <NavLink item={item} active={isActive(item.href)} />
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
