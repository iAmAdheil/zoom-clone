"use client";

import { useState } from "react";
import type { Meeting } from "@/lib/types";
import type { PanelName } from "./ControlBar";
import { MeetingRoom } from "./MeetingRoom";
import { PreJoin } from "./PreJoin";

type Stage = "prejoin" | "room";

/**
 * /meeting/{code}: pre-join preview first, then the room.
 * Mic and camera choices carry over from the preview into the room.
 */
export function MeetingExperience({
  meeting,
  initialStage,
  initialPanel,
}: {
  meeting: Meeting;
  initialStage: Stage;
  initialPanel: PanelName | null;
}) {
  const [stage, setStage] = useState<Stage>(initialStage);
  const [muted, setMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(false);

  if (stage === "room") {
    return (
      <MeetingRoom
        meeting={meeting}
        startMuted={muted}
        startVideoOff={videoOff}
        initialPanel={initialPanel}
      />
    );
  }

  return (
    <PreJoin
      meeting={meeting}
      muted={muted}
      videoOff={videoOff}
      onToggleMute={() => setMuted((m) => !m)}
      onToggleVideo={() => setVideoOff((v) => !v)}
      onJoin={() => setStage("room")}
    />
  );
}
