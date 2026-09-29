"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/cn";

const tones = ["bg-feed-1", "bg-feed-2", "bg-feed-3", "bg-feed-4", "bg-feed-5", "bg-feed-6"];

/** Mock "camera on" picture: a toned backdrop with a head-and-shoulders shape. */
export function FeedPlaceholder({ seed, className }: { seed: number; className?: string }) {
  return (
    <div className={cn("absolute inset-0 overflow-hidden", tones[seed % tones.length], className)}>
      <div className="absolute inset-0 bg-linear-to-b from-white/10 to-black/30" />
      <svg
        viewBox="0 0 160 90"
        preserveAspectRatio="xMidYMax meet"
        className="absolute inset-x-0 bottom-0 h-[82%] w-full text-white/25"
        aria-hidden="true"
      >
        <circle cx="80" cy="36" r="17" fill="currentColor" />
        <path d="M44 90c2-20 17-31 36-31s34 11 36 31z" fill="currentColor" />
      </svg>
    </div>
  );
}

/** Live local camera, mirrored like a self view. */
export function LiveVideo({ stream, className }: { stream: MediaStream; className?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream;
  }, [stream]);
  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      muted
      className={cn("absolute inset-0 size-full -scale-x-100 object-cover", className)}
    />
  );
}
