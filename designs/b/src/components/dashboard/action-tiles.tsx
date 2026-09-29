import Link from "next/link";
import { CalendarPlus, MonitorUp, Plus, Video, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/format";
import { liveMeeting } from "@/lib/mock";

type Tile = {
  label: string;
  hint: string;
  href: string;
  icon: LucideIcon;
  accent?: boolean;
};

const tiles: Tile[] = [
  {
    label: "New meeting",
    hint: "Start an instant meeting",
    href: `/meeting/${liveMeeting.meeting_code}`,
    icon: Video,
    accent: true,
  },
  { label: "Join", hint: "Join with an ID or link", href: "/join", icon: Plus },
  { label: "Schedule", hint: "Plan a meeting", href: "/schedule", icon: CalendarPlus },
  { label: "Share screen", hint: "Share to a Zoom Room", href: "/join", icon: MonitorUp },
];

/**
 * The four home actions. Zoom Workplace shows them as squircle icons
 * with a label under each. "New meeting" is orange, the rest are blue.
 */
export function ActionTiles() {
  return (
    <ul className="grid grid-cols-4 gap-2 sm:gap-4 lg:grid-cols-2 lg:gap-x-6 lg:gap-y-8">
      {tiles.map((tile) => {
        const Icon = tile.icon;
        return (
          <li key={tile.label}>
            <Link
              href={tile.href}
              className="group focus-ring flex flex-col items-center gap-2 rounded-2xl p-1 text-center sm:p-2"
            >
              <span
                className={cn(
                  "flex size-14 items-center justify-center rounded-2xl text-white transition-transform duration-150 group-hover:-translate-y-0.5 group-active:translate-y-0 sm:size-tile-icon lg:size-20 lg:rounded-3xl",
                  tile.accent
                    ? "bg-accent shadow-tile-icon-accent group-hover:bg-accent-hover"
                    : "bg-brand shadow-tile-icon group-hover:bg-brand-hover",
                )}
              >
                <Icon className="size-6 sm:size-7 lg:size-8" strokeWidth={2} />
              </span>
              <span className="text-xs font-semibold text-ink sm:text-sm">{tile.label}</span>
              <span className="hidden text-xs text-ink-3 lg:block">{tile.hint}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
