"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import type { Participant } from "@/lib/types";
import type { PeerSnapshot } from "@/lib/webrtc/peerManager";
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
  selfStream: MediaStream | null;
  /** My microphone seems to give only silence. */
  selfMicProblem: boolean;
  /** Remote streams and connection state, by participant id. */
  peers: PeerSnapshot;
  reaction: { emoji: string; key: number } | null;
  /** Square tiles on phones, 16:9 elsewhere. */
  aspect: number;
};

export function VideoGrid({ participants, selfId, selfStream, selfMicProblem, peers, reaction, aspect }: VideoGridProps) {
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
  // On a phone the room shows me as a floating tile (96 x 128 px, 12 px from the corner) and
  // leaves me out of this list. Keep the bottom band free, so the tile never covers a name tag.
  const selfFloats = aspect === 1 && !participants.some((p) => p.id === selfId);

  return (
    <div ref={boxRef} className={cn("absolute inset-2 sm:inset-3", selfFloats && "pb-33")}>
      <div className="flex size-full flex-wrap content-center items-center justify-center" style={{ gap: GAP }}>
        {participants.map((p) => (
          <ParticipantTile
            key={p.id}
            participant={p}
            isSelf={p.id === selfId}
            // The frame follows the real audio level of each remote peer (getStats).
            speaking={peers.info.get(p.id)?.speaking ?? false}
            stream={p.id === selfId ? selfStream : (peers.streams.get(p.id) ?? null)}
            peer={p.id === selfId ? undefined : peers.info.get(p.id)}
            reaction={p.id === selfId ? reaction : null}
            micProblem={p.id === selfId && selfMicProblem}
            style={{ width: tile.width, height: tile.height }}
          />
        ))}
      </div>
    </div>
  );
}
