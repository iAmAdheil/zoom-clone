import { cn } from "@/lib/cn";
import { initials } from "@/lib/format";

const tones = [
  "bg-avatar-1",
  "bg-avatar-2",
  "bg-avatar-3",
  "bg-avatar-4",
  "bg-avatar-5",
  "bg-avatar-6",
];

/** Picks the same color for the same name every time. */
function toneFor(name: string) {
  let sum = 0;
  for (const ch of name) sum += ch.charCodeAt(0);
  return tones[sum % tones.length];
}

type AvatarProps = {
  name: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  shape?: "circle" | "square";
  className?: string;
};

const sizes = {
  xs: "size-6 text-2xs",
  sm: "size-8 text-xs",
  md: "size-10 text-sm",
  lg: "size-16 text-xl",
  xl: "size-24 text-3xl",
};

export function Avatar({ name, size = "md", shape = "circle", className }: AvatarProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 items-center justify-center font-bold text-white select-none",
        shape === "circle" ? "rounded-full" : "rounded-md",
        toneFor(name),
        sizes[size],
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}
