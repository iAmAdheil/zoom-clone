import { Hand, MicOff } from "lucide-react";
import { cn } from "@/lib/format";
import type { RoomParticipant } from "@/lib/types";
import { CameraFeed } from "./camera-feed";

export type FloatingReaction = { id: number; emoji: string };

type VideoTileProps = {
  participant: RoomParticipant;
  reactions?: FloatingReaction[];
};

export function VideoTile({ participant: p, reactions = [] }: VideoTileProps) {
  const speaking = p.is_speaking && !p.is_muted;
  const shortName = p.display_name.replace(/^Guest:\s*/, "");

  return (
    <figure
      aria-label={`${p.display_name}${p.is_self ? " (you)" : ""}${p.is_muted ? ", muted" : ""}${p.is_video_off ? ", video off" : ""}`}
      className="relative aspect-video overflow-hidden rounded-xl bg-tile max-sm:aspect-[4/5]"
    >
      {p.is_video_off ? (
        <div className="absolute inset-0 flex items-center justify-center px-4">
          <span className="truncate text-2xl font-semibold text-room-ink sm:text-3xl">{shortName}</span>
        </div>
      ) : (
        <CameraFeed tone={p.tone} portraitOnPhone />
      )}

      {p.hand_raised ? (
        <span className="absolute top-2 left-2 flex items-center gap-1 rounded-md bg-warning px-1.5 py-1 text-xs font-semibold text-black">
          <Hand className="size-3.5" />
          <span className="hidden sm:inline">Hand raised</span>
        </span>
      ) : null}

      <figcaption className="absolute bottom-2 left-2 flex max-w-[calc(100%-1rem)] items-center gap-1.5 rounded-md bg-black/55 px-1.5 py-1 text-xs text-white backdrop-blur-sm">
        {p.is_muted ? (
          <MicOff className="size-3.5 shrink-0 text-danger" aria-hidden />
        ) : speaking ? (
          <SpeakingBars />
        ) : null}
        <span className="truncate">
          {p.display_name}
          {p.is_self ? " (You)" : ""}
        </span>
      </figcaption>

      {reactions.map((r) => (
        <span
          key={r.id}
          aria-hidden
          className="pointer-events-none absolute right-4 bottom-4 animate-float-up text-4xl"
        >
          {r.emoji}
        </span>
      ))}

      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0 rounded-xl ring-inset transition-shadow",
          speaking ? "ring-3 ring-speaker" : "ring-1 ring-room-line",
        )}
      />
    </figure>
  );
}

function SpeakingBars() {
  return (
    <span aria-hidden className="flex h-3.5 items-center gap-px">
      {[0, 150, 300].map((delay) => (
        <span
          key={delay}
          className="h-full w-[3px] origin-center animate-speak rounded-full bg-speaker"
          style={{ animationDelay: `${delay}ms` }}
        />
      ))}
    </span>
  );
}
