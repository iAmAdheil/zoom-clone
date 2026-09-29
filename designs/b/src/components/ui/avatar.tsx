import { cn, initials } from "@/lib/format";
import type { Tone } from "@/lib/types";

export const toneBg: Record<Tone, string> = {
  1: "bg-tone-1",
  2: "bg-tone-2",
  3: "bg-tone-3",
  4: "bg-tone-4",
  5: "bg-tone-5",
  6: "bg-tone-6",
};

const sizes = {
  xs: "size-6 text-[10px]",
  sm: "size-8 text-xs",
  md: "size-10 text-sm",
  lg: "size-14 text-lg",
  xl: "size-24 text-3xl",
} as const;

type AvatarProps = {
  name: string;
  tone?: Tone;
  size?: keyof typeof sizes;
  className?: string;
};

/** Initials avatar. Mock data has no photos. */
export function Avatar({ name, tone = 1, size = "md", className }: AvatarProps) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white",
        toneBg[tone],
        sizes[size],
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}
