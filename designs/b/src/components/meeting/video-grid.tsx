import { cn } from "@/lib/format";
import type { RoomParticipant } from "@/lib/types";
import { VideoTile, type FloatingReaction } from "./video-tile";

type VideoGridProps = {
  participants: RoomParticipant[];
  reactions: FloatingReaction[];
  panelOpen: boolean;
};

/**
 * Gallery view. The max width keeps every tile 16:9 and lets the whole
 * grid fit the space between the top bar and the control bar.
 */
export function VideoGrid({ participants, reactions, panelOpen }: VideoGridProps) {
  const count = participants.length;
  const wide = count > 4 && !panelOpen;

  return (
    <div className="flex min-h-0 flex-1 items-start justify-center overflow-y-auto p-2 sm:items-center sm:p-4">
      <div
        className={cn(
          "grid w-full gap-2 sm:gap-3",
          count === 1 ? "max-w-4xl grid-cols-1" : "grid-cols-2",
          wide && "lg:grid-cols-3 lg:max-w-[calc((100dvh-var(--spacing-controlbar)-6rem)*2.6)]",
          !wide && count > 1 && "lg:max-w-[calc((100dvh-var(--spacing-controlbar)-6rem)*1.15)]",
        )}
      >
        {participants.map((p) => (
          <VideoTile key={p.id} participant={p} reactions={p.is_self ? reactions : undefined} />
        ))}
      </div>
    </div>
  );
}
