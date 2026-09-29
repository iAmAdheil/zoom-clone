"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { tabNav } from "@/lib/nav";
import { Icon } from "@/components/ui/Icon";

/** Bottom tab bar on phones, like the Zoom mobile app. */
export function TabBar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-30 grid h-tabbar grid-cols-4 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      {tabNav.map((item) => {
        const active =
          item.href !== null && (item.href === "/" ? pathname === "/" : pathname.startsWith(item.href));
        const classes = cn(
          "flex flex-col items-center justify-center gap-1 text-2xs font-medium",
          active ? "text-brand" : "text-ink-muted",
        );
        const content = (
          <>
            <Icon name={item.icon} size={22} strokeWidth={active ? 2.1 : 1.8} />
            {item.label}
          </>
        );
        return item.href ? (
          <Link
            key={item.label}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={classes}
          >
            {content}
          </Link>
        ) : (
          <span key={item.label} aria-disabled="true" className={cn(classes, "text-ink-faint")}>
            {content}
          </span>
        );
      })}
    </nav>
  );
}
