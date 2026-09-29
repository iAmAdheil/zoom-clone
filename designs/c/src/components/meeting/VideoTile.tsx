import { cn } from "@/lib/cn";
import type { Participant } from "@/lib/types";
import { Avatar } from "@/components/ui/Avatar";
import { Icon } from "@/components/ui/Icon";
import { CameraFeed } from "./CameraFeed";

type VideoTileProps = {
  participant: Participant;
  isSelf: boolean;
  speaking: boolean;
  reaction?: string;
  handRaised?: boolean;
};

export function VideoTile({ participant: p, isSelf, speaking, reaction, handRaised }: VideoTileProps) {
  const name = isSelf ? `${p.display_name} (You)` : p.display_name;

  return (
    <figure
      aria-label={`${name}${p.is_muted ? ", muted" : ""}${p.is_video_off ? ", video off" : ""}`}
      className={cn(
        "relative h-full w-full overflow-hidden rounded-lg bg-room-tile",
        speaking && !p.is_muted && "ring-2 ring-speaking ring-offset-2 ring-offset-room",
      )}
    >
      {p.is_video_off ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-room-tile">
          <Avatar name={p.display_name} seed={p.id} size="lg" />
          <span className="hidden text-lg font-semibold text-room-ink sm:block">{p.display_name}</span>
        </div>
      ) : (
        <CameraFeed seed={p.id} mirrored={isSelf} />
      )}

      {/* Top right: raised hand. */}
      {handRaised && (
        <span className="absolute top-2 right-2 flex size-8 items-center justify-center rounded-full bg-warning text-white shadow-pop-dark">
          <Icon name="hand" size={18} />
        </span>
      )}

      {/* Floating emoji reaction, like Zoom's tile reactions. */}
      {reaction && (
        <span
          key={reaction}
          className="absolute top-3 left-3 animate-float-up text-3xl drop-shadow"
          role="img"
          aria-label={`${p.display_name} reacted ${reaction}`}
        >
          {reaction}
        </span>
      )}

      {/* Name chip, bottom left: the Zoom tile label. */}
      <figcaption className="absolute bottom-2 left-2 flex max-w-[calc(100%-1rem)] items-center gap-1.5 rounded-sm bg-black/60 px-2 py-1 text-xs font-medium text-room-ink">
        {p.is_muted ? (
          <Icon name="micOff" size={14} className="shrink-0 text-danger" strokeWidth={2} />
        ) : (
          <Icon
            name="mic"
            size={14}
            className={cn("shrink-0", speaking ? "text-speaking" : "text-room-ink")}
            strokeWidth={2}
          />
        )}
        <span className="truncate">{name}</span>
      </figcaption>
    </figure>
  );
}
