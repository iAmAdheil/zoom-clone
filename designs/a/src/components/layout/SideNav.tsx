"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";

type NavItem = { label: string; icon: IconName; href?: string; match?: string[] };

// Same items and order as the "PERSONAL" section of the Zoom web portal.
const items: NavItem[] = [
  { label: "Home", icon: "home", href: "/", match: ["/"] },
  { label: "Profile", icon: "user" },
  { label: "Meetings", icon: "calendar", href: "/schedule", match: ["/schedule", "/join"] },
  { label: "Webinars", icon: "webinar" },
  { label: "Personal Contacts", icon: "contacts" },
  { label: "Recordings", icon: "record" },
  { label: "Settings", icon: "settings" },
  { label: "Scheduler", icon: "calendarGrid" },
  { label: "Reports", icon: "chart" },
];

const rowClass =
  "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors";

export function SideNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Personal" className="flex flex-col gap-0.5 p-3">
      <p className="px-3 pt-1 pb-2 text-2xs font-bold tracking-wider text-ink-muted">PERSONAL</p>
      {items.map((item) => {
        const active = item.match?.includes(pathname) ?? false;
        if (!item.href) {
          return (
            <span
              key={item.label}
              title="Not part of this mockup"
              className={cn(rowClass, "cursor-default text-ink-muted")}
            >
              <Icon name={item.icon} size={18} />
              {item.label}
            </span>
          );
        }
        return (
          <Link
            key={item.label}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              rowClass,
              active
                ? "bg-primary font-bold text-white"
                : "text-ink-2 hover:bg-surface-hover hover:text-primary",
            )}
          >
            <Icon name={item.icon} size={18} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
