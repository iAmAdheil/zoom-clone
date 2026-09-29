"use client";

import { useState } from "react";
import { SimpleShell } from "@/components/layout/SimpleShell";
import { ButtonLink, Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import type { Meeting } from "@/lib/types";
import type { Panel } from "./ControlBar";
import { MeetingRoom } from "./MeetingRoom";
import { PreJoin } from "./PreJoin";

export type Stage = "preview" | "room" | "left";

type MeetingExperienceProps = {
  meeting: Meeting;
  initialName: string;
  initialStage: Stage;
  initialPanel: Panel;
};

/** /meeting/[code]: pre-join preview, then the room, then the "you left" page. */
export function MeetingExperience({ meeting, initialName, initialStage, initialPanel }: MeetingExperienceProps) {
  const [stage, setStage] = useState<Stage>(initialStage);
  const [name, setName] = useState(initialName);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [endedForAll, setEndedForAll] = useState(false);

  if (stage === "room") {
    return (
      <MeetingRoom
        meeting={meeting}
        selfName={name.trim()}
        micOn={micOn}
        camOn={camOn}
        initialPanel={initialPanel}
        onToggleMic={() => setMicOn((v) => !v)}
        onToggleCam={() => setCamOn((v) => !v)}
        onLeave={(forAll) => {
          setEndedForAll(forAll);
          setStage("left");
        }}
      />
    );
  }

  if (stage === "left") {
    return (
      <SimpleShell>
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
          <span className="rounded-full bg-primary-soft p-3 text-primary">
            <Icon name="video" size={28} />
          </span>
          <h1 className="text-2xl font-bold text-ink">
            {endedForAll ? "You ended the meeting for everyone" : "You left the meeting"}
          </h1>
          <p className="text-sm text-ink-muted">{meeting.title}</p>
          <div className="mt-2 flex gap-3">
            {endedForAll ? null : (
              <Button variant="secondary" onClick={() => setStage("preview")}>
                Rejoin
              </Button>
            )}
            <ButtonLink href="/">Back to Home</ButtonLink>
          </div>
        </div>
      </SimpleShell>
    );
  }

  return (
    <SimpleShell>
      <PreJoin
        meeting={meeting}
        name={name}
        micOn={micOn}
        camOn={camOn}
        onNameChange={setName}
        onToggleMic={() => setMicOn((v) => !v)}
        onToggleCam={() => setCamOn((v) => !v)}
        onJoin={() => setStage("room")}
      />
    </SimpleShell>
  );
}
