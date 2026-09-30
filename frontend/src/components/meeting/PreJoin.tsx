"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { JoinAlert, describeJoinError } from "@/components/join/joinErrors";
import { Button } from "@/components/ui/Button";
import { Check, Field, Select, TextInput } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";
import { formatMeetingCode } from "@/lib/format";
import { rememberedName } from "@/lib/storage";
import { useJoinMeeting } from "@/lib/useJoinMeeting";
import { sharedAudioContext, unlockAudio } from "@/lib/webrtc/audioPlayback";
import { useDeviceChoices, type DeviceOption } from "@/lib/webrtc/devices";
import { useMicProblem } from "@/lib/webrtc/micLevel";
import type { MediaKind } from "@/lib/webrtc/peerManager";
import { useTrackToggles, type LocalMedia } from "@/lib/webrtc/useMedia";
import { MediaAccess } from "./MediaAccess";
import { MicLevelMeter } from "./MicLevelMeter";
import { LiveVideo } from "./VideoFeed";

type PreJoinProps = {
  code: string;
  title: string;
  defaultName: string;
  /** The passcode that worked on the join page, if any. */
  savedPasscode?: string;
  /** The camera and microphone. The room uses the same stream after Join. */
  media: LocalMedia;
  /** What the user wants. The device must also be open for it to be on. */
  micOn: boolean;
  camOn: boolean;
  onMicChange: (on: boolean) => void;
  onCamChange: (on: boolean) => void;
  speakerId: string;
  onSpeakerChange: (id: string) => void;
  onJoined: () => void;
};

const pillButton =
  "relative flex min-w-16 flex-col items-center gap-0.5 rounded-md px-2 py-1 text-2xs text-room-text transition-colors hover:bg-room-hover disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent";

/** The "Video Preview" page of the Zoom web client. Join calls the API, then opens the room. */
export function PreJoin(props: PreJoinProps) {
  const { code, title, media, onMicChange, onCamChange, onJoined } = props;
  // A missing device counts as "off": the others then see the right icons.
  const micOn = props.micOn && media.hasAudio;
  const camOn = props.camOn && media.hasVideo;
  // While the browser opens the devices, the buttons show the user's choice, not the device.
  // So the label does not flip under the pointer when the devices open.
  const micShown = media.asking ? props.micOn : micOn;
  const camShown = media.asking ? props.camOn : camOn;
  useTrackToggles(media.stream, micOn, camOn);
  const micProblem = useMicProblem(media.stream, micOn);
  const choices = useDeviceChoices(media.stream);
  const [name, setName] = useState(props.defaultName);
  const [remember, setRemember] = useState(true);
  const [nameError, setNameError] = useState<string | undefined>();
  const [deviceError, setDeviceError] = useState<string | null>(null);
  // The passcode field shows only after the server asks for a passcode. The host never needs one.
  const [passcode, setPasscode] = useState(props.savedPasscode ?? "");
  const [askPasscode, setAskPasscode] = useState(false);
  const joiner = useJoinMeeting();

  const joinError = joiner.error ? describeJoinError(joiner.error, passcode.trim() !== "") : null;
  const neverAsked = media.status.audio === "idle" && media.status.video === "idle";

  /**
   * A tap on Mute or Stop Video. The click sets the state opposite to the one that the button
   * shows, never a blind toggle, so a click while the devices open cannot flip it the wrong
   * way. With no device, the tap asks the browser for it (inside the tap, for mobile
   * browsers) and turns it on when allowed.
   */
  async function setDevice(kind: MediaKind, on: boolean) {
    const set = kind === "audio" ? onMicChange : onCamChange;
    const available = kind === "audio" ? media.hasAudio : media.hasVideo;
    if (available || media.asking || !on) {
      set(on);
      return;
    }
    const status = await media.request([kind]);
    if (status[kind] === "ok") set(true);
  }

  async function chooseDevice(kind: MediaKind, id: string) {
    setDeviceError(null);
    if (!(await media.selectDevice(kind, id)))
      setDeviceError(`Could not open that ${kind === "audio" ? "microphone" : "camera"}. It may be in use by another app.`);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    // The Join tap may start sound later in the room (Safari counts the tap for its audio).
    sharedAudioContext();
    unlockAudio();
    if (!name.trim()) {
      setNameError("Enter your name.");
      return;
    }
    // Join is a second way in: when the user never answered, ask now, inside this tap.
    let status = media.status;
    if (neverAsked) status = await media.request(["audio", "video"]);
    const { error } = await joiner.join(code, {
      displayName: name,
      passcode,
      micOn: props.micOn && status.audio === "ok",
      camOn: props.camOn && status.video === "ok",
    });
    if (error) {
      if (error.code === "bad_passcode") setAskPasscode(true);
      return;
    }
    if (remember) rememberedName.write(name);
    onJoined();
  }

  const busy = joiner.pending || media.asking;

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
            {name.trim() || "Your name"}
          </p>
        )}

        <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-lg bg-room-bar/90 p-1">
          <button
            type="button"
            onClick={() => void setDevice("audio", !micShown)}
            aria-pressed={!micShown}
            title={media.hasAudio || media.asking ? undefined : "Microphone not allowed. Click to allow it."}
            className={pillButton}
          >
            <Icon name={micShown ? "mic" : "micOff"} size={22} className={micShown ? "text-success" : "text-danger"} />
            {micShown ? "Mute" : "Unmute"}
            {media.hasAudio || media.asking ? null : <Badge />}
          </button>
          <button
            type="button"
            onClick={() => void setDevice("video", !camShown)}
            aria-pressed={!camShown}
            title={media.hasVideo || media.asking ? undefined : "Camera not allowed. Click to allow it."}
            className={pillButton}
          >
            <Icon name={camShown ? "video" : "videoOff"} size={22} className={cn(!camShown && "text-danger")} />
            {camShown ? "Stop Video" : "Start Video"}
            {media.hasVideo || media.asking ? null : <Badge />}
          </button>
        </div>
      </div>

      {media.stream ? (
        <DevicePickers
          choices={choices}
          speakerId={props.speakerId}
          onSpeakerChange={props.onSpeakerChange}
          onChoose={chooseDevice}
          meter={<MicLevelMeter stream={media.stream} on={micOn} className="mt-1" />}
          note={
            deviceError ??
            (micProblem
              ? "Your microphone does not seem to pick up sound. Choose another microphone."
              : micOn
                ? "Speak: the green bar moves when the microphone hears you."
                : null)
          }
        />
      ) : null}

      <div className="flex w-full max-w-sm flex-col gap-4">
        <MediaAccess media={media} />

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
        <Button type="submit" size="lg" block disabled={busy}>
          {joiner.pending ? "Joining..." : media.asking ? "Waiting for permission..." : "Join"}
        </Button>
        <p className="text-center text-xs text-ink-muted">
          {neverAsked
            ? "Join asks for the camera and microphone first."
            : `${micOn ? "You will join with your microphone on." : "You will join muted."} ${camOn ? "Your video is on." : "Your video is off."}`}
        </p>
      </div>
    </form>
  );
}

/** The small "!" on a device button when the device is not open. */
function Badge() {
  return (
    <span
      aria-hidden="true"
      className="absolute top-0.5 right-3 min-w-4 rounded-full bg-danger px-1 text-center text-2xs leading-4 font-bold text-white"
    >
      !
    </span>
  );
}

type DevicePickersProps = {
  choices: ReturnType<typeof useDeviceChoices>;
  speakerId: string;
  onSpeakerChange: (id: string) => void;
  onChoose: (kind: MediaKind, id: string) => void;
  meter: ReactNode;
  note: string | null;
};

/** Microphone, speaker and camera lists. A list with no entry is left out. */
function DevicePickers({ choices, speakerId, onSpeakerChange, onChoose, meter, note }: DevicePickersProps) {
  const { mics, speakers, cams, micId, camId } = choices;
  return (
    <div className="grid w-full gap-3 sm:grid-cols-3">
      {mics.length > 0 ? (
        <Field id="pick-mic" label="Microphone" hint={note ?? undefined}>
          <DeviceSelect id="pick-mic" options={mics} value={micId} onChange={(id) => onChoose("audio", id)} />
          {meter}
        </Field>
      ) : null}
      {speakers.length > 0 ? (
        <Field id="pick-speaker" label="Speaker">
          <DeviceSelect id="pick-speaker" options={speakers} value={speakerId || "default"} onChange={onSpeakerChange} />
        </Field>
      ) : null}
      {cams.length > 0 ? (
        <Field id="pick-cam" label="Camera">
          <DeviceSelect id="pick-cam" options={cams} value={camId} onChange={(id) => onChoose("video", id)} />
        </Field>
      ) : null}
    </div>
  );
}

function DeviceSelect({
  id,
  options,
  value,
  onChange,
}: {
  id: string;
  options: DeviceOption[];
  value: string | null;
  onChange: (id: string) => void;
}) {
  // The track may use a device that the list names only as "default". Then no option matches.
  const selected = options.some((o) => o.id === value) ? (value ?? "") : "";
  return (
    <Select id={id} value={selected} onChange={(e) => onChange(e.target.value)} aria-describedby={`${id}-msg`}>
      {selected === "" ? <option value="">Choose a device</option> : null}
      {options.map((option) => (
        <option key={option.id} value={option.id}>
          {option.label}
        </option>
      ))}
    </Select>
  );
}
