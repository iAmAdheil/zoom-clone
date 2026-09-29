"use client";

import Link from "next/link";
import { type ReactNode } from "react";
import { Mic, MicOff, Settings2, Speaker, Video, VideoOff, Webcam } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";
import { cn, formatMeetingCode } from "@/lib/format";
import type { Meeting, RoomParticipant } from "@/lib/types";
import { CameraFeed } from "./camera-feed";

type PreJoinProps = {
  meeting: Meeting;
  others: RoomParticipant[];
  name: string;
  micOn: boolean;
  camOn: boolean;
  isHost: boolean;
  onNameChange: (v: string) => void;
  onToggleMic: () => void;
  onToggleCam: () => void;
  onJoin: () => void;
};

export function PreJoin(props: PreJoinProps) {
  const { meeting, others, name, micOn, camOn, isHost } = props;
  const nameMissing = name.trim().length === 0;

  return (
    <div className="flex min-h-dvh flex-col bg-room text-room-ink">
      <header className="flex h-topbar items-center justify-between px-4 md:px-6">
        <Link href="/" aria-label="Back to home" className="focus-ring-room rounded-md">
          <Logo tone="light" />
        </Link>
        <Link href="/" className="focus-ring-room rounded-lg px-2 py-1.5 text-sm text-room-ink-2 hover:bg-room-hover hover:text-room-ink">
          Cancel
        </Link>
      </header>

      <main className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-6 px-4 pb-8 md:px-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-12">
        <section aria-label="Camera preview" className="flex flex-col gap-3">
          <div className="relative aspect-video overflow-hidden rounded-2xl bg-tile ring-1 ring-room-line">
            {camOn ? (
              <>
                <CameraFeed tone={1} />
                <span className="absolute top-3 left-3 rounded-md bg-black/50 px-2 py-1 text-xs text-room-ink-2">
                  Camera preview (mock)
                </span>
              </>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                <Avatar name={name || "You"} tone={1} size="xl" />
                <p className="text-sm text-room-ink-2">Your camera is off</p>
              </div>
            )}

            <span className="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-md bg-black/55 px-2 py-1 text-xs max-sm:hidden">
              {micOn ? <MicLevel /> : <MicOff className="size-3.5 text-danger" />}
              {name || "Your name"}
            </span>

            <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-3">
              <RoundToggle on={micOn} onClick={props.onToggleMic} labelOn="Mute" labelOff="Unmute">
                {micOn ? <Mic className="size-5" /> : <MicOff className="size-5" />}
              </RoundToggle>
              <RoundToggle on={camOn} onClick={props.onToggleCam} labelOn="Stop video" labelOff="Start video">
                {camOn ? <Video className="size-5" /> : <VideoOff className="size-5" />}
              </RoundToggle>
            </div>

            <button
              type="button"
              aria-label="Background and effects (placeholder)"
              title="Background and effects (placeholder)"
              className="focus-ring-room absolute top-3 right-3 flex size-9 items-center justify-center rounded-full bg-black/40 text-white hover:bg-black/60"
            >
              <Settings2 className="size-4" />
            </button>
          </div>

          <div className="hidden gap-2 sm:grid sm:grid-cols-3">
            <DeviceSelect icon={<Mic className="size-4" />} label="Microphone" value="MacBook Pro Microphone" />
            <DeviceSelect icon={<Speaker className="size-4" />} label="Speaker" value="MacBook Pro Speakers" />
            <DeviceSelect icon={<Webcam className="size-4" />} label="Camera" value="FaceTime HD Camera" />
          </div>
        </section>

        <section aria-labelledby="ready-title" className="flex flex-col gap-5 lg:py-8">
          <div>
            <p className="text-xs font-medium tracking-wide text-room-ink-3 uppercase">
              Meeting ID {formatMeetingCode(meeting.meeting_code)}
            </p>
            <h1 id="ready-title" className="mt-1 text-2xl font-semibold tracking-tight">
              Ready to join?
            </h1>
            <p className="mt-1 text-sm text-room-ink-2">{meeting.title}</p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex -space-x-1.5">
              {others.slice(0, 4).map((p) => (
                <Avatar key={p.id} name={p.display_name} tone={p.tone} size="sm" className="ring-2 ring-room" />
              ))}
            </div>
            <p className="text-sm text-room-ink-2">
              {others[0]?.display_name.split(" ")[0]} and {others.length - 1} others are in this meeting
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="prejoin-name" className="text-sm font-medium">
              Your name
            </label>
            <input
              id="prejoin-name"
              value={name}
              onChange={(e) => props.onNameChange(e.target.value)}
              aria-invalid={nameMissing || undefined}
              className={cn(
                "h-11 rounded-lg border bg-room-3 px-3 text-sm text-room-ink placeholder:text-room-ink-3 focus:outline-none focus:ring-3 focus:ring-brand/40",
                nameMissing ? "border-danger" : "border-room-line focus:border-brand",
              )}
              placeholder="Enter your name"
            />
            {nameMissing ? <p className="text-xs text-danger">Enter a name to join.</p> : null}
          </div>

          <Button size="lg" onClick={props.onJoin} disabled={nameMissing} className="w-full">
            {isHost ? "Start meeting" : "Join"}
          </Button>
          <p className="text-xs text-room-ink-3">
            {micOn ? "Your mic is on." : "You join muted."} {camOn ? "Your video is on." : "Your video is off."}{" "}
            {isHost ? "You are the host of this meeting." : null}
          </p>
        </section>
      </main>
    </div>
  );
}

function RoundToggle({
  on,
  onClick,
  labelOn,
  labelOff,
  children,
}: {
  on: boolean;
  onClick: () => void;
  labelOn: string;
  labelOff: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={!on}
      aria-label={on ? labelOn : labelOff}
      title={on ? labelOn : labelOff}
      className={cn(
        "focus-ring-room flex size-12 items-center justify-center rounded-full transition-colors",
        on ? "border border-white/40 bg-black/30 text-white hover:bg-black/50" : "bg-danger text-white hover:bg-danger-hover",
      )}
    >
      {children}
    </button>
  );
}

function DeviceSelect({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <button
      type="button"
      title={`${label} (placeholder)`}
      className="focus-ring-room flex min-w-0 items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs text-room-ink-2 hover:bg-room-hover hover:text-room-ink"
    >
      <span className="shrink-0">{icon}</span>
      <span className="sr-only">{label}: </span>
      <span className="truncate">{value}</span>
      <svg viewBox="0 0 12 12" className="ml-auto size-3 shrink-0" aria-hidden>
        <path d="M3 4.5l3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </button>
  );
}

function MicLevel() {
  return (
    <span aria-hidden className="flex h-3.5 items-center gap-px">
      {[0, 200, 400].map((delay) => (
        <span
          key={delay}
          className="h-full w-[3px] animate-speak rounded-full bg-speaker"
          style={{ animationDelay: `${delay}ms` }}
        />
      ))}
    </span>
  );
}
