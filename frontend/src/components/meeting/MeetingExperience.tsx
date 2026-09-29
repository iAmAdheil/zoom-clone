"use client";

import { useState, type ReactNode } from "react";
import { SimpleShell } from "@/components/layout/SimpleShell";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Icon, type IconName } from "@/components/ui/Icon";
import { ApiError, errorMessage } from "@/lib/api";
import { useMeetingSession } from "@/lib/meetingStore";
import { useMe, useMeetingLookup } from "@/lib/queries";
import { rememberedName } from "@/lib/storage";
import { MeetingRoom } from "./MeetingRoom";
import { PreJoin } from "./PreJoin";

type Stage = "preview" | "room" | "left";

/** Full-page message in the light shell: "meeting not found", "you left", and so on. */
function Notice({ icon = "video", title, detail, children }: { icon?: IconName; title: string; detail?: string; children?: ReactNode }) {
  return (
    <SimpleShell>
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
        <span className="rounded-full bg-primary-soft p-3 text-primary">
          <Icon name={icon} size={28} />
        </span>
        <h1 className="text-2xl font-bold text-ink">{title}</h1>
        {detail ? <p className="text-sm text-ink-muted">{detail}</p> : null}
        <div className="mt-2 flex gap-3">{children ?? <ButtonLink href="/">Back to Home</ButtonLink>}</div>
      </div>
    </SimpleShell>
  );
}

/** /meeting/[code]: pre-join preview, then the room, then the "you left" page. */
export function MeetingExperience({ code }: { code: string }) {
  const lookup = useMeetingLookup(code.length === 10 ? code : null);
  const me = useMe();
  const session = useMeetingSession(code);
  const [stage, setStage] = useState<Stage>("preview");
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [endedForAll, setEndedForAll] = useState(false);

  if (stage === "room" && session) {
    return (
      <MeetingRoom
        // A new join (new ticket) starts a fresh room state.
        key={session.ws_ticket}
        code={code}
        meeting={session.meeting}
        onLeave={(forAll) => {
          setEndedForAll(forAll);
          setStage("left");
        }}
      />
    );
  }

  const title = session?.meeting.title ?? lookup.data?.title ?? "";

  if (stage === "left") {
    return (
      <Notice title={endedForAll ? "You ended the meeting for everyone" : "You left the meeting"} detail={title}>
        {endedForAll ? null : (
          <Button variant="secondary" onClick={() => setStage("preview")}>
            Rejoin
          </Button>
        )}
        <ButtonLink href="/">Back to Home</ButtonLink>
      </Notice>
    );
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
        micOn={micOn}
        camOn={camOn}
        onToggleMic={() => setMicOn((v) => !v)}
        onToggleCam={() => setCamOn((v) => !v)}
        onJoined={() => setStage("room")}
      />
    </SimpleShell>
  );
}
