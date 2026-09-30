"use client";

import { useState } from "react";
import { SimpleShell } from "@/components/layout/SimpleShell";
import { Button, ButtonLink } from "@/components/ui/Button";
import { ApiError, errorMessage } from "@/lib/api";
import { useMeetingSession } from "@/lib/meetingStore";
import { useMe, useMeetingLookup } from "@/lib/queries";
import { rememberedName } from "@/lib/storage";
import { useMedia } from "@/lib/webrtc/useMedia";
import { MeetingNotice as Notice } from "./MeetingNotice";
import { MeetingRoom } from "./MeetingRoom";
import { PreJoin } from "./PreJoin";

type Stage = "preview" | "room" | "ended";

/**
 * /meeting/[code]: pre-join preview, then the room.
 * "Leave" goes to another page (see useRoom). "End for all" shows the "ended" page here.
 * This component owns the camera and microphone, so the preview and the room share one stream.
 */
export function MeetingExperience({ code }: { code: string }) {
  const lookup = useMeetingLookup(code.length === 10 ? code : null);
  const me = useMe();
  const session = useMeetingSession(code);
  const [stage, setStage] = useState<Stage>("preview");
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [roomActive, setRoomActive] = useState(true);

  // Open the devices while the meeting loads (no waterfall), but not for an unknown or ended meeting.
  const canPreview = code.length === 10 && lookup.data !== undefined && lookup.data.status !== "ended";
  const inRoom = stage === "room" && session !== null;
  const media = useMedia(inRoom ? roomActive : stage === "preview" && canPreview);

  if (inRoom) {
    return (
      <MeetingRoom
        // A new join (new ticket) starts a fresh room state.
        key={session.ws_ticket}
        code={code}
        meeting={session.meeting}
        media={media}
        onEndedForAll={() => setStage("ended")}
        onActiveChange={setRoomActive}
      />
    );
  }

  const title = session?.meeting.title ?? lookup.data?.title ?? "";

  if (stage === "ended") {
    return <Notice icon="clock" title="You ended the meeting for everyone" detail={title} />;
  }

  if (code.length !== 10 || (lookup.error instanceof ApiError && lookup.error.status === 404)) {
    return (
      <Notice icon="alert" title="Meeting not found" detail="This meeting ID is not valid. Check the link and try again.">
        <ButtonLink href="/join" variant="secondary">
          Join another meeting
        </ButtonLink>
        <ButtonLink href="/">Back to Home</ButtonLink>
      </Notice>
    );
  }

  if (lookup.error) {
    return (
      <Notice icon="alert" title="Could not load the meeting" detail={errorMessage(lookup.error)}>
        <Button onClick={() => lookup.mutate()}>Try again</Button>
      </Notice>
    );
  }

  // Wait for the meeting and for /api/me (it gives the default name of a signed-in user).
  if (!lookup.data || me.isLoading) {
    return (
      <SimpleShell>
        <p role="status" className="flex flex-1 items-center justify-center text-sm text-ink-muted">
          Loading meeting...
        </p>
      </SimpleShell>
    );
  }

  if (lookup.data.status === "ended") {
    return <Notice icon="clock" title="This meeting has ended" detail={title} />;
  }

  return (
    <SimpleShell>
      <PreJoin
        code={code}
        title={title}
        defaultName={session?.participant.display_name || me.data?.name || rememberedName.read()}
        savedPasscode={session?.passcode}
        media={media}
        micOn={micOn}
        camOn={camOn}
        onToggleMic={() => setMicOn((v) => !v)}
        onToggleCam={() => setCamOn((v) => !v)}
        onJoined={() => setStage("room")}
      />
    </SimpleShell>
  );
}
