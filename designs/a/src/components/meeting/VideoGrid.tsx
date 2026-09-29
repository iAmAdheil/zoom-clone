"use client";

import { useEffect, useRef, useState } from "react";
import type { Participant } from "@/lib/types";
import { ParticipantTile } from "./ParticipantTile";

const GAP = 6;

type Size = { width: number; height: number };

/**
 * Finds the column count that gives the largest tile of the given aspect ratio
 * that still fits all tiles in the box. This is how gallery view fills the screen.
 */
export function bestTileSize(count: number, box: Size, aspect: number): Size {
  let best: Size = { width: 0, height: 0 };
  for (let cols = 1; cols <= Math.max(1, count); cols++) {
    const rows = Math.ceil(count / cols);
    const maxW = (box.width - GAP * (cols - 1)) / cols;
    const maxH = (box.height - GAP * (rows - 1)) / rows;
    const width = Math.floor(Math.min(maxW, maxH * aspect));
    if (width > best.width) best = { width, height: Math.floor(width / aspect) };
  }
  return best;
}

type VideoGridProps = {
  participants: Participant[];
  selfId: number;
  speakerId: number;
  selfStream: MediaStream | null;
  reaction: { emoji: string; key: number } | null;
  /** Square tiles on phones, 16:9 elsewhere. */
  aspect: number;
};

export function VideoGrid({ participants, selfId, speakerId, selfStream, reaction, aspect }: VideoGridProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  // A first guess for the server render. The observer replaces it after mount.
  const [box, setBox] = useState<Size>({ width: 1200, height: 640 });

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setBox({ width, height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const tile = bestTileSize(participants.length, box, aspect);

  return (
    <div ref={boxRef} className="absolute inset-2 sm:inset-3">
      <div className="flex size-full flex-wrap content-center items-center justify-center" style={{ gap: GAP }}>
        {participants.map((p) => (
          <ParticipantTile
            key={p.id}
            participant={p}
            isSelf={p.id === selfId}
            speaking={p.id === speakerId}
            stream={p.id === selfId ? selfStream : null}
            reaction={p.id === selfId ? reaction : null}
            style={{ width: tile.width, height: tile.height }}
          />
        ))}
      </div>
    </div>
  );
}
