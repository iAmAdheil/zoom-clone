"use client";

import { useState, type FormEvent } from "react";
import { JoinAlert, describeJoinError } from "@/components/join/joinErrors";
import { Button } from "@/components/ui/Button";
import { Check, Field, TextInput } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";
import { formatMeetingCode } from "@/lib/format";
import { rememberedName } from "@/lib/storage";
import { useJoinMeeting } from "@/lib/useJoinMeeting";
import { useLocalCamera } from "./useLocalMedia";
import { FeedPlaceholder, LiveVideo } from "./VideoFeed";

type PreJoinProps = {
  code: string;
  title: string;
  defaultName: string;
  /** The passcode that worked on the join page, if any. */
  savedPasscode?: string;
  micOn: boolean;
  camOn: boolean;
  onToggleMic: () => void;
  onToggleCam: () => void;
  onJoined: () => void;
};

const pillButton =
  "flex min-w-16 flex-col items-center gap-0.5 rounded-md px-2 py-1 text-2xs text-room-text transition-colors hover:bg-room-hover";

/** The "Video Preview" page of the Zoom web client. Join calls the API, then opens the room. */
export function PreJoin(props: PreJoinProps) {
  const { code, title, micOn, camOn, onToggleMic, onToggleCam, onJoined } = props;
  const camera = useLocalCamera(camOn);
  const [name, setName] = useState(props.defaultName);
  const [remember, setRemember] = useState(true);
  const [nameError, setNameError] = useState<string | undefined>();
  // The passcode field shows only after the server asks for a passcode. The host never needs one.
  const [passcode, setPasscode] = useState(props.savedPasscode ?? "");
  const [askPasscode, setAskPasscode] = useState(false);
  const joiner = useJoinMeeting();

  const joinError = joiner.error ? describeJoinError(joiner.error, passcode.trim() !== "") : null;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setNameError("Enter your name.");
      return;
    }
    const { error } = await joiner.join(code, { displayName: name, passcode, micOn, camOn });
    if (error) {
      if (error.code === "bad_passcode") setAskPasscode(true);
      return;
    }
    if (remember) rememberedName.write(name);
    onJoined();
  }

  return (
    <form onSubmit={onSubmit} noValidate className="mx-auto flex w-full max-w-2xl flex-col items-center gap-6 px-4 py-8 sm:py-12">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-ink">Video Preview</h1>
        <p className="mt-1 text-sm text-ink-muted">
          {title} · ID {formatMeetingCode(code)}
        </p>
      </div>

      <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-room-tile shadow-card">
        {camOn ? (
          camera.stream ? (
            <LiveVideo stream={camera.stream} />
          ) : (
            <>
              <FeedPlaceholder seed={0} />
              {camera.error ? (
                <p role="status" className="absolute top-3 left-3 right-3 w-fit rounded-sm bg-room-overlay px-2 py-1 text-xs text-room-text">
                  {camera.error} Showing a sample picture.
                </p>
              ) : null}
            </>
          )
        ) : (
          <p className="absolute inset-0 flex items-center justify-center px-4 text-center text-3xl font-bold text-room-text sm:text-4xl">
            {name.trim() || "Your name"}
          </p>
        )}

        <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-lg bg-room-bar/90 p-1">
          <button type="button" onClick={onToggleMic} aria-pressed={!micOn} className={pillButton}>
            <Icon name={micOn ? "mic" : "micOff"} size={22} className={micOn ? "text-success" : "text-danger"} />
            {micOn ? "Mute" : "Unmute"}
          </button>
          <button type="button" onClick={onToggleCam} aria-pressed={!camOn} className={pillButton}>
            <Icon name={camOn ? "video" : "videoOff"} size={22} className={cn(!camOn && "text-danger")} />
            {camOn ? "Stop Video" : "Start Video"}
          </button>
        </div>
      </div>

      <div className="flex w-full max-w-sm flex-col gap-4">
        <Field id="display-name" label="Your name" error={nameError}>
          <TextInput
            id="display-name"
            value={name}
            maxLength={64}
            onChange={(e) => {
              setName(e.target.value);
              setNameError(undefined);
            }}
            aria-invalid={nameError ? true : undefined}
            aria-describedby={nameError ? "display-name-msg" : undefined}
          />
        </Field>
        {askPasscode ? (
          <Field
            id="prejoin-passcode"
            label="Meeting passcode"
            error={joinError?.field === "passcode" ? joinError.message : undefined}
          >
            <TextInput
              id="prejoin-passcode"
              type="password"
              autoComplete="off"
              value={passcode}
              onChange={(e) => {
                setPasscode(e.target.value);
                joiner.clearError();
              }}
              aria-invalid={joinError?.field === "passcode" ? true : undefined}
              aria-describedby="prejoin-passcode-msg"
            />
          </Field>
        ) : null}
        <Check
          id="remember-name"
          label="Remember my name for future meetings"
          checked={remember}
          onChange={(e) => setRemember(e.target.checked)}
        />
        {joinError && joinError.field !== "passcode" ? (
          <JoinAlert message={joinError.message} signInNext={joinError.needsSignIn ? `/meeting/${code}` : undefined} />
        ) : null}
        <Button type="submit" size="lg" block disabled={joiner.pending}>
          {joiner.pending ? "Joining..." : "Join"}
        </Button>
        <p className="text-center text-xs text-ink-muted">
          {micOn ? "You will join with your microphone on." : "You will join muted."}{" "}
          {camOn ? "Your video is on." : "Your video is off."}
        </p>
      </div>
    </form>
  );
}
