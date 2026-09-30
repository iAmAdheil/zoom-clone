"use client";

import { useEffect, useState } from "react";

type MediaKind = "audio" | "video";
type MediaState = { stream: MediaStream | null; error: string | null };

const CONSTRAINTS: Record<MediaKind, MediaStreamConstraints> = {
  audio: { audio: true, video: false },
  video: { audio: false, video: { width: 1280, height: 720 } },
};

const DEVICE_NAME: Record<MediaKind, string> = { audio: "microphone", video: "camera" };

/** Short text for a getUserMedia failure. The names come from the Media Capture spec. */
function mediaErrorText(kind: MediaKind, error: unknown): string {
  const device = DEVICE_NAME[kind];
  const name = error instanceof DOMException ? error.name : "";
  if (name === "NotAllowedError" || name === "SecurityError")
    return `The ${device} permission is blocked. Allow the ${device} in the browser settings.`;
  if (name === "NotFoundError" || name === "OverconstrainedError") return `No ${device} was found.`;
  if (name === "NotReadableError") return `Another app is using the ${device}.`;
  return `The ${device} is not available.`;
}

/**
 * Opens the local microphone or camera while `enabled` is true (getUserMedia).
 * When `enabled` turns false, or the component unmounts, the tracks stop and the browser
 * releases the device (the camera light goes off). No media leaves the browser.
 */
export function useLocalMedia(kind: MediaKind, enabled: boolean): MediaState {
  const [state, setState] = useState<MediaState>({ stream: null, error: null });

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let opened: MediaStream | null = null;

    if (!navigator.mediaDevices?.getUserMedia) {
      queueMicrotask(() => setState({ stream: null, error: `The ${DEVICE_NAME[kind]} is not available in this browser.` }));
      return;
    }

    navigator.mediaDevices
      .getUserMedia(CONSTRAINTS[kind])
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        opened = stream;
        setState({ stream, error: null });
      })
      .catch((error: unknown) => {
        if (!cancelled) setState({ stream: null, error: mediaErrorText(kind, error) });
      });

    return () => {
      cancelled = true;
      opened?.getTracks().forEach((t) => t.stop());
      setState({ stream: null, error: null });
    };
  }, [kind, enabled]);

  return state;
}

/** The local camera. Used by the preview and by the self tile in the room. */
export function useLocalCamera(enabled: boolean): MediaState {
  return useLocalMedia("video", enabled);
}
