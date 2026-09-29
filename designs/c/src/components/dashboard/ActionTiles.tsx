import Link from "next/link";
import { cn } from "@/lib/cn";
import { liveMeeting } from "@/lib/mock";
import { Icon, type IconName } from "@/components/ui/Icon";

type Tile = {
  label: string;
  hint: string;
  icon: IconName;
  href: string;
  accent?: boolean;
};

// Orange for "New meeting", blue for the rest: the Zoom home pattern.
const tiles: Tile[] = [
  {
    label: "New meeting",
    hint: "Start now with video",
    icon: "video",
    href: `/meeting/${liveMeeting.meeting_code}`,
    accent: true,
  },
  { label: "Join", hint: "With an ID or a link", icon: "plus", href: "/join" },
  { label: "Schedule", hint: "Plan a meeting", icon: "calendar", href: "/schedule" },
  { label: "Share screen", hint: "Join a meeting to share", icon: "share", href: "/join" },
];

export function ActionTiles() {
  return (
    <ul aria-label="Quick actions" className="grid grid-cols-4 gap-3 sm:gap-4 lg:grid-cols-2">
      {tiles.map((tile) => (
        <li key={tile.label}>
          <Link
            href={tile.href}
            className="group flex flex-col items-center gap-2 rounded-lg p-1 text-center lg:items-start lg:gap-3 lg:rounded-xl lg:border lg:border-line lg:bg-surface lg:p-4 lg:text-left lg:shadow-card lg:transition-shadow lg:hover:shadow-pop"
          >
            <span
              className={cn(
                "flex size-14 items-center justify-center rounded-xl text-white transition-transform duration-150 group-hover:-translate-y-0.5 sm:size-16",
                tile.accent
                  ? "bg-accent shadow-tile-accent group-hover:bg-accent-hover"
                  : "bg-brand shadow-tile group-hover:bg-brand-hover",
              )}
            >
              <Icon name={tile.icon} size={26} strokeWidth={2} />
            </span>
            <span className="grid gap-0.5">
              <span className="text-xs font-semibold text-ink sm:text-sm">{tile.label}</span>
              <span className="hidden text-xs text-ink-muted lg:block">{tile.hint}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
