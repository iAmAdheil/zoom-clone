"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { cn } from "@/lib/cn";
import { formatMeetingCode } from "@/lib/format";
import { demoUser, roomParticipants, SELF_ID } from "@/lib/mock";
import type { Meeting } from "@/lib/types";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Checkbox, Select, TextInput } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { Logo } from "@/components/ui/Logo";
import { AccessBadge } from "@/components/dashboard/AccessBadge";
import { CameraFeed } from "./CameraFeed";

type PreJoinProps = {
  meeting: Meeting;
  muted: boolean;
  videoOff: boolean;
  onToggleMute: () => void;
  onToggleVideo: () => void;
  onJoin: (name: string) => void;
};

/** Round toggle on the preview, like Google Meet's green room. Red when off. */
function PreviewToggle({
  on,
  onIcon,
  offIcon,
  label,
  onClick,
}: {
  on: boolean;
  onIcon: "mic" | "video";
  offIcon: "micOff" | "videoOff";
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={!on}
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        "flex size-12 items-center justify-center rounded-full border transition-colors",
        on
          ? "border-white/40 bg-black/30 text-white backdrop-blur hover:bg-black/50"
          : "border-danger bg-danger text-white hover:bg-danger-hover",
      )}
    >
      <Icon name={on ? onIcon : offIcon} size={22} />
    </button>
  );
}

/** Animated bars that show the mic picks up sound. Decorative only. */
function MicLevel({ active }: { active: boolean }) {
  return (
    <span aria-hidden="true" className="flex h-4 items-end gap-0.5">
      {[0, 1, 2, 3].map((i) => (
        <span
          key={i}
          className={cn("w-1 rounded-full bg-speaking", active ? "animate-pulse" : "opacity-30")}
          style={{ height: `${[40, 90, 60, 75][i]}%`, animationDelay: `${i * 120}ms` }}
        />
      ))}
    </span>
  );
}

export function PreJoin({ meeting, muted, videoOff, onToggleMute, onToggleVideo, onJoin }: PreJoinProps) {
  const [name, setName] = useState(demoUser.name);
  const [error, setError] = useState<string | null>(null);
  const others = roomParticipants.filter((p) => p.id !== SELF_ID);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Enter the name others will see.");
      return;
    }
    onJoin(name.trim());
  }

  return (
    <div data-theme="dark" className="flex min-h-dvh flex-col bg-room text-room-ink">
      <header className="flex h-topnav items-center justify-between px-4 md:px-6">
        <Link href="/" className="flex items-baseline gap-1.5 rounded-sm" aria-label="Back to home">
          <Logo tone="white" size="md" />
          <span className="text-base font-semibold">Workplace</span>
        </Link>
        <span className="flex items-center gap-2 text-sm text-room-ink-muted">
          <Avatar name={demoUser.name} size="sm" />
          <span className="hidden sm:inline">{demoUser.email}</span>
        </span>
      </header>

      <main
        id="main"
        className="mx-auto grid w-full max-w-6xl flex-1 content-center items-center gap-6 px-4 pb-8 lg:grid-cols-[minmax(0,1fr)_var(--spacing-panel)] lg:gap-10 lg:px-8"
      >
        {/* Preview */}
        <section aria-label="Camera preview" className="grid gap-4">
          <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-room-tile ring-1 ring-room-line">
            {videoOff ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                <Avatar name={name || demoUser.name} size="xl" />
                <p className="text-sm text-room-ink-muted">Your camera is off</p>
              </div>
            ) : (
              <CameraFeed seed={SELF_ID} mirrored />
            )}

            <span className="absolute top-3 left-3 flex items-center gap-2 rounded-sm bg-black/60 px-2 py-1 text-xs font-medium">
              {muted ? <Icon name="micOff" size={14} className="text-danger" /> : <MicLevel active />}
              {name || "You"}
            </span>

            <div className="absolute inset-x-0 bottom-4 flex justify-center gap-3">
              <PreviewToggle
                on={!muted}
                onIcon="mic"
                offIcon="micOff"
                label={muted ? "Turn on microphone" : "Turn off microphone"}
                onClick={onToggleMute}
              />
              <PreviewToggle
                on={!videoOff}
                onIcon="video"
                offIcon="videoOff"
                label={videoOff ? "Turn on camera" : "Turn off camera"}
                onClick={onToggleVideo}
              />
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            <label className="sr-only" htmlFor="pj-mic">
              Microphone
            </label>
            <Select id="pj-mic" tone="dark" leadingIcon="mic" defaultValue="mbp">
              <option value="mbp">MacBook Pro Microphone</option>
              <option value="airpods">AirPods Pro</option>
            </Select>
            <label className="sr-only" htmlFor="pj-speaker">
              Speaker
            </label>
            <Select id="pj-speaker" tone="dark" leadingIcon="speaker" defaultValue="mbp">
              <option value="mbp">MacBook Pro Speakers</option>
              <option value="airpods">AirPods Pro</option>
            </Select>
            <label className="sr-only" htmlFor="pj-camera">
              Camera
            </label>
            <Select id="pj-camera" tone="dark" leadingIcon="video" defaultValue="facetime">
              <option value="facetime">FaceTime HD Camera</option>
              <option value="iphone">iPhone Camera</option>
            </Select>
          </div>
        </section>

        {/* Join panel */}
        <section aria-labelledby="pj-title" className="grid gap-5 lg:py-6">
          <div>
            <p className="text-sm text-room-ink-muted">Ready to join?</p>
            <h1 id="pj-title" className="mt-1 text-2xl font-semibold tracking-tight">
              {meeting.title}
            </h1>
            <p className="mt-2 text-sm text-room-ink-muted">
              Meeting ID {formatMeetingCode(meeting.meeting_code)} · Host: {meeting.host.name}
            </p>
            <div className="mt-3">
              <AccessBadge access={meeting.access} tone="dark" />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex -space-x-1.5">
              {others.slice(0, 3).map((p) => (
                <Avatar key={p.id} name={p.display_name} seed={p.id} size="sm" className="ring-2 ring-room" />
              ))}
            </div>
            <p className="text-sm text-room-ink-muted">
              {others[0].display_name.split(" ")[0]}, {others[1].display_name.split(" ")[0]} and{" "}
              {others.length - 2} others are here
            </p>
          </div>

          <form onSubmit={submit} noValidate className="grid gap-4">
            <div className="grid gap-1.5">
              <label htmlFor="pj-name" className="text-sm font-medium text-room-ink-muted">
                Your name
              </label>
              <TextInput
                id="pj-name"
                tone="dark"
                value={name}
                invalid={!!error}
                aria-describedby={error ? "pj-name-error" : undefined}
                onChange={(e) => {
                  setName(e.target.value);
                  setError(null);
                }}
              />
              {error && (
                <p id="pj-name-error" role="alert" className="text-xs text-danger">
                  {error}
                </p>
              )}
            </div>
            <Checkbox
              id="pj-remember"
              tone="dark"
              defaultChecked
              label="Always show this preview when joining"
            />
            <Button type="submit" size="lg" fullWidth>
              Join
            </Button>
            <Button href="/" variant="darkGhost" fullWidth>
              Cancel
            </Button>
          </form>
        </section>
      </main>
    </div>
  );
}
