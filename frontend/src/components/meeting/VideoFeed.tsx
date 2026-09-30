"use client";

import { useEffect, useRef } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { cn } from "@/lib/cn";

/**
 * The picture of a stream. It never plays sound: the self view must not echo my own voice,
 * and the sound of a remote stream plays in RemoteAudio, which stays on when the video is off.
 * `mirror` flips the self view, like a mirror.
 */
export function LiveVideo({ stream, mirror = false, className }: { stream: MediaStream; mirror?: boolean; className?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    video.muted = true;
    video.srcObject = stream;
  }, [stream]);
  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      muted
      className={cn("absolute inset-0 size-full object-cover", mirror && "-scale-x-100", className)}
    />
  );
}

/** Plays the sound of one remote participant. Hidden. */
export function RemoteAudio({ stream, participantId }: { stream: MediaStream; participantId: number }) {
  const ref = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    const audio = ref.current;
    if (!audio) return;
    audio.srcObject = stream;
    // The user clicked Join on this page, so the browser allows sound. Ignore a refusal.
    audio.play().catch(() => {});
  }, [stream]);
  return <audio ref={ref} autoPlay data-participant-id={participantId} className="hidden" />;
}

/** The tile content when there is no picture: the avatar and the name. */
export function TileAvatar({ name, className }: { name: string; className?: string }) {
  return (
    <div className={cn("absolute inset-0 flex flex-col items-center justify-center gap-2 px-3", className)}>
      <Avatar name={name} size="tile" />
      <p className="max-w-full truncate text-center text-[clamp(12px,5cqw,20px)] font-bold text-room-text">{name}</p>
    </div>
  );
}
