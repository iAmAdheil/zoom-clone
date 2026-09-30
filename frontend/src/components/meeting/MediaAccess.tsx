"use client";

import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { unblockHint } from "@/lib/webrtc/mediaAccess";
import type { MediaKind } from "@/lib/webrtc/peerManager";
import type { LocalMedia } from "@/lib/webrtc/useMedia";

const KINDS: MediaKind[] = ["audio", "video"];

function allowLabel(kinds: readonly MediaKind[]): string {
  if (kinds.length === 2) return "Allow camera and microphone";
  return kinds[0] === "audio" ? "Allow microphone" : "Allow camera";
}

/**
 * The permission step of the pre-join page. The prompt opens only from the tap on the button:
 * mobile browsers (iOS Safari first) may show no prompt without a tap. States: not asked yet,
 * asking, allowed (nothing shows), blocked (with steps for this browser), no device.
 */
export function MediaAccess({ media }: { media: LocalMedia }) {
  const needed = KINDS.filter((kind) => media.status[kind] !== "ok");
  if (needed.length === 0) return null;
  const ask = () => void media.request(needed);
  const hasProblem = needed.some((kind) => media.status[kind] !== "idle");

  if (!hasProblem || media.asking) {
    return (
      <div className="flex flex-col gap-2 text-center">
        <Button size="lg" block onClick={ask} disabled={media.asking}>
          <Icon name={needed.includes("video") ? "video" : "mic"} size={20} />
          {media.asking ? "Waiting for your answer..." : allowLabel(needed)}
        </Button>
        <p role="status" className="text-xs text-ink-muted">
          {media.asking
            ? "Choose Allow in the browser prompt."
            : "The browser asks you first. Others can then see and hear you."}
        </p>
      </div>
    );
  }

  const blocked = needed.some((kind) => media.status[kind] === "blocked");
  return (
    <div role="alert" className="flex flex-col gap-2 rounded-md bg-warning-soft px-4 py-3 text-sm text-warning-ink">
      <p className="flex items-start gap-1.5 font-bold">
        <Icon name="alert" size={16} className="mt-0.5 shrink-0" />
        {media.error}
      </p>
      {blocked ? <p>{unblockHint(navigator.userAgent, navigator.maxTouchPoints)}</p> : null}
      <Button variant="secondary" size="sm" className="w-fit" onClick={ask}>
        Try again
      </Button>
    </div>
  );
}
