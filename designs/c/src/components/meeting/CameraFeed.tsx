import { cn } from "@/lib/cn";

// A drawn stand-in for a live camera. No real media in this mockup.
// The seed picks a stable scene so each person keeps the same look.

const scenes = [
  "from-scene-1 to-scene-1b",
  "from-scene-2 to-scene-2b",
  "from-scene-3 to-scene-3b",
  "from-scene-4 to-scene-4b",
] as const;
const skins = ["bg-skin-1", "bg-skin-2", "bg-skin-3"] as const;
const hairs = ["bg-hair-1", "bg-hair-2"] as const;
const shirts = ["bg-avatar-1", "bg-avatar-3", "bg-avatar-6", "bg-avatar-2", "bg-avatar-5"] as const;

export function CameraFeed({
  seed,
  mirrored = false,
  className,
}: {
  seed: number;
  mirrored?: boolean;
  className?: string;
}) {
  const scene = scenes[seed % scenes.length];
  const skin = skins[seed % skins.length];
  const hair = hairs[seed % hairs.length];
  const shirt = shirts[seed % shirts.length];

  return (
    <div
      aria-hidden="true"
      className={cn(
        "absolute inset-0 overflow-hidden bg-linear-to-b",
        scene,
        mirrored && "-scale-x-100",
        className,
      )}
    >
      {/* Window light and a shelf, so the frame reads as a room. */}
      <div className="absolute top-[8%] left-[8%] h-[46%] w-[22%] rounded-sm bg-white/10 blur-[2px]" />
      <div className="absolute top-[30%] right-[6%] h-[3%] w-[26%] rounded-xs bg-black/25" />
      <div className="absolute top-[22%] right-[10%] h-[8%] w-[5%] rounded-xs bg-white/15" />

      {/* Person: shoulders, neck, head, hair. Sizes follow the tile height. */}
      <div className="absolute inset-0 flex items-end justify-center">
        <div className="relative h-[78%] aspect-[4/5]">
          <div
            className={cn(
              "absolute bottom-0 left-1/2 h-[38%] w-[92%] -translate-x-1/2 rounded-t-[45%]",
              shirt,
            )}
          />
          <div
            className={cn(
              "absolute bottom-[32%] left-1/2 h-[14%] w-[20%] -translate-x-1/2 rounded-b-md",
              skin,
            )}
          />
          <div
            className={cn(
              "absolute bottom-[40%] left-1/2 h-[46%] w-[46%] -translate-x-1/2 rounded-[45%]",
              skin,
            )}
          />
          <div
            className={cn(
              "absolute bottom-[68%] left-1/2 h-[22%] w-[50%] -translate-x-1/2 rounded-t-full",
              hair,
            )}
          />
        </div>
      </div>

      {/* Soft vignette like a webcam. */}
      <div className="absolute inset-0 bg-radial from-transparent from-50% to-black/35" />
    </div>
  );
}
