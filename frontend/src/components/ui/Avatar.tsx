import Image from "next/image";
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
  /** Profile picture (Google). Without it the avatar shows the initials. */
  src?: string | null;
  /** "tile" grows with the video tile (a CSS container). */
  size?: "xs" | "sm" | "md" | "lg" | "xl" | "tile";
  shape?: "circle" | "square";
  className?: string;
};

const sizes = {
  xs: "size-6 text-2xs",
  sm: "size-8 text-xs",
  md: "size-10 text-sm",
  lg: "size-16 text-xl",
  xl: "size-24 text-3xl",
  tile: "size-[clamp(40px,22cqw,96px)] text-[clamp(14px,8cqw,30px)]",
};

const pixels = { xs: 24, sm: 32, md: 40, lg: 64, xl: 96, tile: 96 };

export function Avatar({ name, src, size = "md", shape = "circle", className }: AvatarProps) {
  if (src) {
    return (
      <Image
        src={src}
        alt=""
        width={pixels[size]}
        height={pixels[size]}
        // Google serves the picture already small. no-referrer stops Google from blocking it.
        unoptimized
        referrerPolicy="no-referrer"
        className={cn(
          "shrink-0 object-cover select-none",
          shape === "circle" ? "rounded-full" : "rounded-md",
          sizes[size],
          className,
        )}
      />
    );
  }
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
