"use client";

import { useState } from "react";
import { demoUser, roomParticipants } from "@/lib/mock";
import type { Meeting } from "@/lib/types";
import type { Panel } from "./control-bar";
import { LeftScreen } from "./left-screen";
import { MeetingRoom } from "./meeting-room";
import { PreJoin } from "./pre-join";

export type Stage = "preview" | "room" | "left";

type MeetingExperienceProps = {
  meeting: Meeting;
  initialStage: Stage;
  initialMicOn: boolean;
  initialCamOn: boolean;
  initialPanel: Panel;
};

/** /meeting/{code}: pre-join preview, then the room, then the "left" screen. */
export function MeetingExperience(props: MeetingExperienceProps) {
  const { meeting } = props;
  const [stage, setStage] = useState<Stage>(props.initialStage);
  const [name, setName] = useState(demoUser.name);
  const [micOn, setMicOn] = useState(props.initialMicOn);
  const [camOn, setCamOn] = useState(props.initialCamOn);
  const [endedForAll, setEndedForAll] = useState(false);
  const isHost = meeting.host.id === demoUser.id;

  if (stage === "preview") {
    return (
      <PreJoin
        meeting={meeting}
        others={roomParticipants.filter((p) => !p.is_self)}
        name={name}
        micOn={micOn}
        camOn={camOn}
        isHost={isHost}
        onNameChange={setName}
        onToggleMic={() => setMicOn((v) => !v)}
        onToggleCam={() => setCamOn((v) => !v)}
        onJoin={() => setStage("room")}
      />
    );
  }

  if (stage === "left") {
    return <LeftScreen endedForAll={endedForAll} onRejoin={() => setStage("preview")} />;
  }

  return (
    <MeetingRoom
      meeting={meeting}
      displayName={name.trim() || demoUser.name}
      initialMicOn={micOn}
      initialCamOn={camOn}
      initialPanel={props.initialPanel}
      onLeave={(forAll) => {
        setEndedForAll(forAll);
        setStage("left");
      }}
    />
  );
}
