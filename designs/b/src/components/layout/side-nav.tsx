"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/format";
import { navItems, type NavItem } from "./nav-items";

function isActive(item: NavItem, pathname: string) {
  if (item.placeholder) return false;
  return item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
}

/** Left rail (tablet and desktop). Workplace style: icon over label. */
export function SideNav() {
  const pathname = usePathname();
  return (
    <div className="hidden w-rail shrink-0 border-r border-line bg-surface md:block">
    <nav
      aria-label="Main"
      className="sticky top-topbar flex max-h-[calc(100dvh-var(--spacing-topbar))] flex-col items-center gap-1 overflow-y-auto py-3"
    >
      {navItems.map((item) => {
        const active = isActive(item, pathname);
        const Icon = item.icon;
        return (
          <Link
            key={item.label}
            href={item.href}
            aria-current={active ? "page" : undefined}
            aria-disabled={item.placeholder || undefined}
            title={item.placeholder ? `${item.label} (placeholder)` : item.label}
            className={cn(
              "group focus-ring flex w-18 flex-col items-center gap-1 rounded-xl py-1.5 text-[11px] font-medium transition-colors",
              active ? "text-brand" : "text-ink-3 hover:text-ink",
            )}
          >
            <span
              className={cn(
                "flex size-10 items-center justify-center rounded-xl transition-colors",
                active ? "bg-brand-soft" : "group-hover:bg-surface-2",
              )}
            >
              <Icon className="size-5" strokeWidth={active ? 2.2 : 1.8} />
            </span>
            {item.label}
          </Link>
        );
      })}
      <button
        type="button"
        title="More apps (placeholder)"
        className="group focus-ring mt-1 flex w-18 flex-col items-center gap-1 rounded-xl py-1.5 text-[11px] font-medium text-ink-3 hover:text-ink"
      >
        <span className="flex size-10 items-center justify-center rounded-xl group-hover:bg-surface-2">
          <MoreHorizontal className="size-5" />
        </span>
        More
      </button>
    </nav>
    </div>
  );
}

/** Bottom tab bar (phone only). */
export function MobileTabBar() {
  const pathname = usePathname();
  const items = navItems.slice(0, 4);
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      {items.map((item) => {
        const active = isActive(item, pathname);
        const Icon = item.icon;
        return (
          <Link
            key={item.label}
            href={item.href}
            aria-current={active ? "page" : undefined}
            aria-disabled={item.placeholder || undefined}
            className={cn(
              "focus-ring flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium",
              active ? "text-brand" : "text-ink-3",
            )}
          >
            <Icon className="size-5" strokeWidth={active ? 2.2 : 1.8} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
