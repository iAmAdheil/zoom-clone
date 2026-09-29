import { cn } from "@/lib/format";
import type { Tone } from "@/lib/types";

const feedBg: Record<Tone, string> = {
  1: "from-tone-1/55 via-room-3 to-room-2",
  2: "from-tone-2/55 via-room-3 to-room-2",
  3: "from-tone-3/50 via-room-3 to-room-2",
  4: "from-tone-4/50 via-room-3 to-room-2",
  5: "from-tone-5/55 via-room-3 to-room-2",
  6: "from-tone-6/55 via-room-3 to-room-2",
};

/**
 * Mock camera image: a soft colored backdrop with a person silhouette.
 * The mockup has no real media, so this stands in for a video feed.
 */
export function CameraFeed({
  tone,
  portraitOnPhone = false,
  className,
}: {
  tone: Tone;
  /** Grid tiles are portrait on phones. Scale the silhouette to match. */
  portraitOnPhone?: boolean;
  className?: string;
}) {
  return (
    <div aria-hidden className={cn("absolute inset-0 overflow-hidden bg-linear-to-b", feedBg[tone], className)}>
      <div
        className={cn(
          "absolute top-[20%] left-1/2 aspect-square w-[20%] -translate-x-1/2 rounded-full bg-white/25",
          portraitOnPhone && "max-sm:top-[26%] max-sm:w-[36%]",
        )}
      />
      <div
        className={cn(
          "absolute -bottom-[14%] left-1/2 aspect-[1.7] w-[46%] -translate-x-1/2 rounded-t-full bg-white/20",
          portraitOnPhone && "max-sm:-bottom-[6%] max-sm:w-[86%]",
        )}
      />
      <div className="absolute inset-0 bg-linear-to-t from-black/35 via-transparent to-transparent" />
    </div>
  );
}
