"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Check, Field, TextInput } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";
import { formatMeetingCode } from "@/lib/format";
import type { Meeting } from "@/lib/types";
import { useLocalCamera } from "./useLocalCamera";
import { FeedPlaceholder, LiveVideo } from "./VideoFeed";

type PreJoinProps = {
  meeting: Meeting;
  name: string;
  micOn: boolean;
  camOn: boolean;
  onNameChange: (name: string) => void;
  onToggleMic: () => void;
  onToggleCam: () => void;
  onJoin: () => void;
};

const pillButton =
  "flex min-w-16 flex-col items-center gap-0.5 rounded-md px-2 py-1 text-2xs text-room-text transition-colors hover:bg-room-hover";

/** The "Video Preview" page of the Zoom web client. */
export function PreJoin(props: PreJoinProps) {
  const { meeting, name, micOn, camOn, onNameChange, onToggleMic, onToggleCam, onJoin } = props;
  const camera = useLocalCamera(camOn);
  const [error, setError] = useState<string | undefined>();

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Enter your name.");
      return;
    }
    onJoin();
  }

  return (
    <form onSubmit={onSubmit} noValidate className="mx-auto flex w-full max-w-2xl flex-col items-center gap-6 px-4 py-8 sm:py-12">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-ink">Video Preview</h1>
        <p className="mt-1 text-sm text-ink-muted">
          {meeting.title} · ID {formatMeetingCode(meeting.meeting_code)}
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
                <p className="absolute top-3 left-3 rounded-sm bg-room-overlay px-2 py-1 text-xs text-room-text">
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
          <button
            type="button"
            onClick={onToggleMic}
            aria-pressed={!micOn}
            className={pillButton}
          >
            <Icon name={micOn ? "mic" : "micOff"} size={22} className={micOn ? "text-success" : "text-danger"} />
            {micOn ? "Mute" : "Unmute"}
          </button>
          <button
            type="button"
            onClick={onToggleCam}
            aria-pressed={!camOn}
            className={pillButton}
          >
            <Icon name={camOn ? "video" : "videoOff"} size={22} className={cn(!camOn && "text-danger")} />
            {camOn ? "Stop Video" : "Start Video"}
          </button>
        </div>
      </div>

      <div className="flex w-full max-w-sm flex-col gap-4">
        <Field id="display-name" label="Your name" error={error}>
          <TextInput
            id="display-name"
            value={name}
            maxLength={64}
            onChange={(e) => {
              onNameChange(e.target.value);
              setError(undefined);
            }}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "display-name-msg" : undefined}
          />
        </Field>
        <Check id="remember-name" label="Remember my name for future meetings" defaultChecked />
        <Button type="submit" size="lg" block>
          Join
        </Button>
        <p className="text-center text-xs text-ink-muted">
          {micOn ? "You will join with your microphone on." : "You will join muted."}{" "}
          {camOn ? "Your video is on." : "Your video is off."}
        </p>
      </div>
    </form>
  );
}
