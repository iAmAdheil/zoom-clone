"use client";

import type { CSSProperties } from "react";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";
import type { Participant } from "@/lib/types";
import { FeedPlaceholder, LiveVideo } from "./VideoFeed";

type ParticipantTileProps = {
  participant: Participant;
  isSelf: boolean;
  speaking: boolean;
  stream?: MediaStream | null;
  reaction?: { emoji: string; key: number } | null;
  style?: CSSProperties;
  className?: string;
};

/** One video tile: camera feed or name, name tag, mute icon, active speaker frame. */
export function ParticipantTile({
  participant,
  isSelf,
  speaking,
  stream,
  reaction,
  style,
  className,
}: ParticipantTileProps) {
  const { display_name: name, is_muted, is_video_off } = participant;

  return (
    <figure
      style={style}
      aria-label={`${name}${isSelf ? " (you)" : ""}${is_muted ? ", muted" : ""}${is_video_off ? ", video off" : ""}`}
      className={cn("@container relative overflow-hidden rounded-md bg-room-tile", className)}
    >
      {is_video_off ? (
        <p className="absolute inset-0 flex items-center justify-center px-3 text-center text-[clamp(14px,9cqw,40px)] leading-tight font-bold text-room-text">
          {name}
        </p>
      ) : isSelf && stream ? (
        <LiveVideo stream={stream} />
      ) : (
        <FeedPlaceholder seed={participant.id} />
      )}

      {speaking && !is_muted ? (
        <span aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-md ring-2 ring-speaker ring-inset" />
      ) : null}

      {reaction ? (
        <span
          key={reaction.key}
          aria-hidden="true"
          className="animate-float-up absolute top-2 left-2 text-[clamp(20px,10cqw,40px)]"
        >
          {reaction.emoji}
        </span>
      ) : null}

      <figcaption className="absolute bottom-1 left-1 flex max-w-[calc(100%-8px)] items-center gap-1 rounded-sm bg-room-overlay px-1.5 py-0.5 text-xs text-room-text">
        {is_muted ? <Icon name="micOff" size={13} className="shrink-0 text-danger" strokeWidth={2} /> : null}
        <span className="truncate">{name}</span>
      </figcaption>
    </figure>
  );
}
