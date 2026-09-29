"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "@/components/ui/Icon";

// Content for the room popovers. Each one is small and has no own trigger.

export const REACTIONS = ["👏", "👍", "❤️", "😂", "😮", "🎉"] as const;

const menuItem =
  "flex h-9 w-full items-center gap-2.5 rounded-sm px-2.5 text-left text-sm text-room-ink transition-colors hover:bg-room-hover";

/** Mock device list with one selected item per group. */
export function DeviceMenu({ groups }: { groups: { title: string; options: string[] }[] }) {
  const [selected, setSelected] = useState<Record<string, string>>(() =>
    Object.fromEntries(groups.map((g) => [g.title, g.options[0]])),
  );

  return (
    <div className="grid w-72 gap-1 p-2">
      {groups.map((g, i) => (
        <div key={g.title} className={cn("grid gap-0.5", i > 0 && "mt-1 border-t border-room-line pt-2")}>
          <p className="px-2.5 pb-1 text-xs font-semibold text-room-ink-faint">{g.title}</p>
          {g.options.map((opt) => {
            const isOn = selected[g.title] === opt;
            return (
              <button
                key={opt}
                type="button"
                aria-pressed={isOn}
                onClick={() => setSelected((s) => ({ ...s, [g.title]: opt }))}
                className={menuItem}
              >
                <Icon name="check" size={16} className={isOn ? "text-brand" : "invisible"} />
                <span className="truncate">{opt}</span>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

export const micGroups = [
  { title: "Microphone", options: ["MacBook Pro Microphone", "AirPods Pro", "Same as system"] },
  { title: "Speaker", options: ["MacBook Pro Speakers", "AirPods Pro"] },
];

export const cameraGroups = [
  { title: "Camera", options: ["FaceTime HD Camera", "iPhone Camera (Continuity)"] },
  { title: "Background", options: ["None", "Blur", "Office"] },
];

export function ReactionsMenu({
  onReact,
  handRaised,
  onToggleHand,
}: {
  onReact: (emoji: string) => void;
  handRaised: boolean;
  onToggleHand: () => void;
}) {
  return (
    <div className="grid gap-2 p-2">
      <div className="flex gap-1">
        {REACTIONS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            aria-label={`React ${emoji}`}
            onClick={() => onReact(emoji)}
            className="flex size-10 items-center justify-center rounded-md text-2xl transition-transform hover:scale-110 hover:bg-room-hover"
          >
            {emoji}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={onToggleHand}
        aria-pressed={handRaised}
        className={cn(
          "flex h-9 items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors",
          handRaised
            ? "bg-warning text-white hover:opacity-90"
            : "bg-room-raised text-room-ink hover:bg-room-hover",
        )}
      >
        <Icon name="hand" size={16} />
        {handRaised ? "Lower hand" : "Raise hand"}
      </button>
    </div>
  );
}

export function LeaveMenu({
  isHost,
  onEndForAll,
  onLeave,
}: {
  isHost: boolean;
  onEndForAll: () => void;
  onLeave: () => void;
}) {
  return (
    <div className="grid w-64 gap-2 p-3">
      {isHost && (
        <>
          <p className="px-1 text-xs text-room-ink-muted">
            You are the host. You can end the meeting for everyone or leave it running.
          </p>
          <button
            type="button"
            onClick={onEndForAll}
            className="h-10 rounded-md bg-danger text-sm font-semibold text-white transition-colors hover:bg-danger-hover"
          >
            End meeting for all
          </button>
        </>
      )}
      <button
        type="button"
        onClick={onLeave}
        className="h-10 rounded-md bg-room-raised text-sm font-semibold text-room-ink transition-colors hover:bg-room-hover"
      >
        Leave meeting
      </button>
    </div>
  );
}
