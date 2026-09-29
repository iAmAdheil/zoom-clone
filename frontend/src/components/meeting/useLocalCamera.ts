"use client";

import { useEffect, useState } from "react";

type CameraState = { stream: MediaStream | null; error: string | null };

/** Short text for a getUserMedia failure. The names come from the Media Capture spec. */
function cameraErrorText(error: unknown): string {
  const name = error instanceof DOMException ? error.name : "";
  if (name === "NotAllowedError" || name === "SecurityError")
    return "Camera permission is blocked. Allow the camera in the browser settings.";
  if (name === "NotFoundError" || name === "OverconstrainedError") return "No camera was found.";
  if (name === "NotReadableError") return "Another app is using the camera.";
  return "The camera is not available.";
}

/**
 * Opens the local camera while `enabled` is true (getUserMedia).
 * No media leaves the browser. When the camera is blocked or missing,
 * `error` is set and the UI shows a placeholder feed instead.
 */
export function useLocalCamera(enabled: boolean): CameraState {
  const [state, setState] = useState<CameraState>({ stream: null, error: null });

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let opened: MediaStream | null = null;

    if (!navigator.mediaDevices?.getUserMedia) {
      queueMicrotask(() => setState({ stream: null, error: "Camera is not available in this browser." }));
      return;
    }

    navigator.mediaDevices
      .getUserMedia({ video: { width: 1280, height: 720 }, audio: false })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        opened = stream;
        setState({ stream, error: null });
      })
      .catch((error: unknown) => {
        if (!cancelled) setState({ stream: null, error: cameraErrorText(error) });
      });

    return () => {
      cancelled = true;
      opened?.getTracks().forEach((t) => t.stop());
      setState({ stream: null, error: null });
    };
  }, [enabled]);

  return state;
}
