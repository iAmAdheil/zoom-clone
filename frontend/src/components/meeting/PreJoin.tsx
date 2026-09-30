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
import { useTrackToggles, type LocalMedia } from "@/lib/webrtc/useMedia";
import { LiveVideo } from "./VideoFeed";

type PreJoinProps = {
  code: string;
  title: string;
  defaultName: string;
  /** The passcode that worked on the join page, if any. */
  savedPasscode?: string;
  /** The camera and microphone. The room uses the same stream after Join. */
  media: LocalMedia;
  micOn: boolean;
  camOn: boolean;
  onToggleMic: () => void;
  onToggleCam: () => void;
  onJoined: () => void;
};

const pillButton =
  "flex min-w-16 flex-col items-center gap-0.5 rounded-md px-2 py-1 text-2xs text-room-text transition-colors hover:bg-room-hover disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent";

/** The "Video Preview" page of the Zoom web client. Join calls the API, then opens the room. */
export function PreJoin(props: PreJoinProps) {
  const { code, title, media, onToggleMic, onToggleCam, onJoined } = props;
  // A missing device counts as "off": the others then see the right icons.
  const micOn = props.micOn && media.hasAudio;
  const camOn = props.camOn && media.hasVideo;
  useTrackToggles(media.stream, micOn, camOn);
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
        {camOn && media.stream ? (
          <LiveVideo stream={media.stream} mirror />
        ) : (
          <p className="absolute inset-0 flex items-center justify-center px-4 text-center text-3xl font-bold text-room-text sm:text-4xl">
            {media.pending ? "Starting camera..." : name.trim() || "Your name"}
          </p>
        )}
        {media.error ? (
          <p role="status" className="absolute top-3 right-3 left-3 w-fit rounded-sm bg-room-overlay px-2 py-1 text-xs text-room-text">
            {media.error}
          </p>
        ) : null}

        <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-lg bg-room-bar/90 p-1">
          <button type="button" onClick={onToggleMic} disabled={!media.hasAudio} aria-pressed={!micOn} className={pillButton}>
            <Icon name={micOn ? "mic" : "micOff"} size={22} className={micOn ? "text-success" : "text-danger"} />
            {micOn ? "Mute" : "Unmute"}
          </button>
          <button type="button" onClick={onToggleCam} disabled={!media.hasVideo} aria-pressed={!camOn} className={pillButton}>
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
        {/* Join waits for the devices, so every peer connection starts with the final stream. */}
        <Button type="submit" size="lg" block disabled={joiner.pending || media.pending}>
          {joiner.pending ? "Joining..." : media.pending ? "Starting camera..." : "Join"}
        </Button>
        <p className="text-center text-xs text-ink-muted">
          {media.pending
            ? "Allow the camera and microphone when the browser asks."
            : `${micOn ? "You will join with your microphone on." : "You will join muted."} ${camOn ? "Your video is on." : "Your video is off."}`}
        </p>
      </div>
    </form>
  );
}
