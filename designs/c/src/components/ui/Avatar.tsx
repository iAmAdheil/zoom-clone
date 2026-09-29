import { cn } from "@/lib/cn";
import { initials } from "@/lib/format";

const fills = [
  "bg-avatar-1",
  "bg-avatar-2",
  "bg-avatar-3",
  "bg-avatar-4",
  "bg-avatar-5",
  "bg-avatar-6",
] as const;

const sizes = {
  xs: "size-6 text-2xs",
  sm: "size-8 text-xs",
  md: "size-10 text-sm",
  lg: "size-16 text-xl",
  xl: "size-24 text-3xl",
} as const;

/** Picks the same color for the same name every time. */
function fillFor(name: string) {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return fills[hash % fills.length];
}

type AvatarProps = {
  name: string;
  /** Optional stable number (like a participant id) to pick the color. */
  seed?: number;
  size?: keyof typeof sizes;
  shape?: "circle" | "square";
  className?: string;
};

export function Avatar({ name, seed, size = "md", shape = "circle", className }: AvatarProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 items-center justify-center font-semibold text-white select-none",
        shape === "circle" ? "rounded-full" : "rounded-md",
        seed === undefined ? fillFor(name) : fills[seed % fills.length],
        sizes[size],
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}
