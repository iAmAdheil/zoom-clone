import type { CSSProperties } from "react";
import type { Participant } from "@/lib/types";
import styles from "./VideoGrid.module.css";
import { VideoTile } from "./VideoTile";

/** Columns and rows for a landscape stage and for a portrait stage. */
function layoutFor(count: number) {
  const landscapeCols = count <= 1 ? 1 : count <= 4 ? 2 : count <= 9 ? 3 : 4;
  const portraitCols = count <= 2 ? 1 : 2;
  return {
    "--cols-l": landscapeCols,
    "--rows-l": Math.ceil(count / landscapeCols),
    "--cols-p": portraitCols,
    "--rows-p": Math.ceil(count / portraitCols),
  } as CSSProperties;
}

type VideoGridProps = {
  participants: Participant[];
  selfId: number;
  speakerId: number;
  reactions: Record<number, string | undefined>;
  raisedHands: Set<number>;
};

export function VideoGrid({ participants, selfId, speakerId, reactions, raisedHands }: VideoGridProps) {
  return (
    <div className={`${styles.stage} flex-1 p-2 sm:p-4`}>
      <ul className={styles.grid} style={layoutFor(participants.length)} aria-label="Video gallery">
        {participants.map((p) => (
          <li key={p.id} className={styles.tile}>
            <VideoTile
              participant={p}
              isSelf={p.id === selfId}
              speaking={p.id === speakerId}
              reaction={reactions[p.id]}
              handRaised={raisedHands.has(p.id)}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
