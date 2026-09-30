"use client";

import type { CSSProperties } from "react";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";
import { useHeldFor } from "@/lib/hooks";
import type { Participant } from "@/lib/types";
import type { PeerInfo } from "@/lib/webrtc/peerManager";
import { LiveVideo, TileAvatar } from "./VideoFeed";

type ParticipantTileProps = {
  participant: Participant;
  isSelf: boolean;
  speaking: boolean;
  /** My local stream for the self tile. The remote stream for the others. */
  stream?: MediaStream | null;
  /** The WebRTC connection to this participant. Not set for the self tile. */
  peer?: PeerInfo;
  reaction?: { emoji: string; key: number } | null;
  /** Self tile: my microphone seems to give only silence. */
  micProblem?: boolean;
  style?: CSSProperties;
  className?: string;
};

const qualityDot: Record<string, { className: string; label: string }> = {
  connecting: { className: "bg-room-muted", label: "Connecting" },
  good: { className: "bg-success", label: "Good connection" },
  fair: { className: "bg-accent", label: "Fair connection" },
  poor: { className: "bg-danger", label: "Poor connection" },
  problem: { className: "bg-danger", label: "Connection problem" },
};

/** The dot key: the link quality when connected, else the connection state. */
function dotKey(peer: PeerInfo): string {
  if (peer.status === "connected") return peer.quality ?? "good";
  return peer.status;
}

/** One video tile: camera feed or avatar, name tag, mute icon, active speaker frame. */
export function ParticipantTile({
  participant,
  isSelf,
  speaking,
  stream,
  peer,
  reaction,
  micProblem = false,
  style,
  className,
}: ParticipantTileProps) {
  const { display_name: name, role, is_muted, is_video_off } = participant;
  // The avatar shows when the video is off, or when there is no video track (no camera,
  // or the remote video has not arrived yet).
  const showVideo = !is_video_off && stream != null && stream.getVideoTracks().length > 0;
  const dot = peer ? qualityDot[dotKey(peer)] : null;
  // The mute event and the first audio bytes can come at slightly different times, so the
  // warning waits a moment before it shows.
  const noAudio = useHeldFor(!is_muted && peer?.noAudio === true, 1500);
  const audioWarning = micProblem
    ? "Your microphone does not seem to pick up sound"
    : noAudio
      ? `No audio from ${name}`
      : null;

  return (
    <figure
      style={style}
      aria-label={`${name}${isSelf ? " (you)" : ""}${is_muted ? ", muted" : ""}${is_video_off ? ", video off" : ""}`}
      data-participant-id={participant.id}
      className={cn("@container relative overflow-hidden rounded-md bg-room-tile", className)}
    >
      {showVideo ? <LiveVideo stream={stream} mirror={isSelf} /> : <TileAvatar name={name} />}

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

      {peer?.status === "problem" ? (
        <p
          role="status"
          className="absolute top-1 right-1 flex items-center gap-1 rounded-sm bg-room-overlay px-1.5 py-0.5 text-2xs font-bold text-room-text"
        >
          <Icon name="alert" size={12} className="shrink-0 text-danger" strokeWidth={2} />
          Connection problem
        </p>
      ) : audioWarning ? (
        <p
          role="status"
          className="absolute top-1 right-1 left-1 mx-auto flex w-fit max-w-[calc(100%-8px)] items-center gap-1 rounded-sm bg-room-overlay px-1.5 py-0.5 text-2xs font-bold text-room-text"
        >
          <Icon name="micOff" size={12} className="shrink-0 text-danger" strokeWidth={2} />
          <span className="truncate">{audioWarning}</span>
        </p>
      ) : null}

      <figcaption className="absolute bottom-1 left-1 flex max-w-[calc(100%-8px)] items-center gap-1 rounded-sm bg-room-overlay px-1.5 py-0.5 text-xs text-room-text">
        {dot ? (
          <span role="img" aria-label={dot.label} title={dot.label} className={cn("size-2 shrink-0 rounded-full", dot.className)} />
        ) : null}
        {is_muted ? <Icon name="micOff" size={13} className="shrink-0 text-danger" strokeWidth={2} /> : null}
        <span className="truncate">{name}</span>
        {role === "attendee" ? null : (
          <span className="shrink-0 rounded-sm bg-primary px-1 text-2xs font-bold">
            {role === "host" ? "Host" : "Co-host"}
          </span>
        )}
      </figcaption>
    </figure>
  );
}
