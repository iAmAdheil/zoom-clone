"use client";

import { useEffect, useState } from "react";

// The local camera and microphone. One getUserMedia call opens both (docs/webrtc-plan.md).
// MeetingExperience owns the stream, so the pre-join preview and the room use the same one:
// the camera opens once. Mute and video off change `track.enabled` (useTrackToggles) and
// the WebRTC senders (PeerManager.setSending). The tracks stop when `active` turns false,
// when the component unmounts, and when the page unloads.

export type LocalMedia = {
  /** Null while the browser opens the devices, and for "no media". */
  stream: MediaStream | null;
  /** True until getUserMedia gives an answer. */
  pending: boolean;
  hasAudio: boolean;
  hasVideo: boolean;
  /** A short message when a device is missing or blocked. The user can still join. */
  error: string | null;
};

type Result = { stream: MediaStream | null; error: string | null };

const VIDEO: MediaTrackConstraints = { width: { ideal: 1280 }, height: { ideal: 720 } };

function isBlocked(error: unknown): boolean {
  const name = error instanceof DOMException ? error.name : "";
  return name === "NotAllowedError" || name === "SecurityError";
}

/** Short text for a getUserMedia failure. The names come from the Media Capture spec. */
function failureText(error: unknown): string {
  const name = error instanceof DOMException ? error.name : "";
  if (isBlocked(error))
    return "The camera and microphone are blocked. You can join and still see and hear others. To use them, allow them in the browser settings, then reload.";
  if (name === "NotReadableError") return "Another app is using the camera or microphone. You can join without them.";
  return "No camera or microphone was found. You can join and still see and hear others.";
}

/** Asks for both devices. When one device is missing or busy, it tries each device alone. */
async function openDevices(): Promise<Result> {
  if (!navigator.mediaDevices?.getUserMedia) {
    return { stream: null, error: "This browser cannot use a camera or microphone. You can still join." };
  }
  try {
    return { stream: await navigator.mediaDevices.getUserMedia({ audio: true, video: VIDEO }), error: null };
  } catch (error) {
    if (isBlocked(error)) return { stream: null, error: failureText(error) };
    const single: [MediaStreamConstraints, string][] = [
      [{ audio: true }, "No camera is available. You join with the microphone only."],
      [{ video: VIDEO }, "No microphone is available. You join with the camera only."],
    ];
    for (const [constraints, message] of single) {
      try {
        return { stream: await navigator.mediaDevices.getUserMedia(constraints), error: message };
      } catch {
        // Try the next device.
      }
    }
    return { stream: null, error: failureText(error) };
  }
}

function stopTracks(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop());
}

/** Opens the camera and microphone while `active` is true. */
export function useMedia(active: boolean): LocalMedia {
  const [result, setResult] = useState<Result | null>(null);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    let opened: MediaStream | null = null;

    openDevices().then((next) => {
      if (cancelled) {
        stopTracks(next.stream);
        return;
      }
      opened = next.stream;
      setResult(next);
    });

    // The browser stops the devices on unload too. This makes the camera light go off at once.
    const onPageHide = () => stopTracks(opened);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      cancelled = true;
      window.removeEventListener("pagehide", onPageHide);
      stopTracks(opened);
      setResult(null);
    };
  }, [active]);

  const stream = result?.stream ?? null;
  return {
    stream,
    pending: active && result === null,
    hasAudio: (stream?.getAudioTracks().length ?? 0) > 0,
    hasVideo: (stream?.getVideoTracks().length ?? 0) > 0,
    error: result?.error ?? null,
  };
}

/** Mute and video off for the local tracks. The self view and the peers see the change. */
export function useTrackToggles(stream: MediaStream | null, micOn: boolean, camOn: boolean) {
  useEffect(() => {
    stream?.getAudioTracks().forEach((track) => {
      track.enabled = micOn;
    });
  }, [stream, micOn]);
  useEffect(() => {
    stream?.getVideoTracks().forEach((track) => {
      track.enabled = camOn;
    });
  }, [stream, camOn]);
}
