import type { MediaKind } from "./peerManager";

// Opens the camera and the microphone, and turns browser errors into short UI text.
// No React here (useMedia.ts is the hook), so the rules are unit tested.

/**
 * The state of one device:
 * - idle: not asked yet. Mobile browsers need a tap before they show the prompt.
 * - ok: the track is open.
 * - blocked: the user or the browser refused it.
 * - missing: no such device.
 * - busy: another app holds the device.
 * - unsupported: the browser has no getUserMedia (for example an old browser or plain http).
 */
export type DeviceStatus = "idle" | "ok" | "blocked" | "missing" | "busy" | "unsupported";

export type DeviceStatuses = Record<MediaKind, DeviceStatus>;

/** Browser voice processing, set on purpose. Some browsers turn a part of it off by default. */
export const AUDIO_CONSTRAINTS: MediaTrackConstraints = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
};

export const VIDEO_CONSTRAINTS: MediaTrackConstraints = { width: { ideal: 1280 }, height: { ideal: 720 } };

export function constraintsFor(kind: MediaKind, deviceId?: string): MediaStreamConstraints {
  const base = kind === "audio" ? AUDIO_CONSTRAINTS : VIDEO_CONSTRAINTS;
  const track = deviceId ? { ...base, deviceId: { exact: deviceId } } : base;
  return kind === "audio" ? { audio: track } : { video: track };
}

/** The device state for a getUserMedia error. The names come from the Media Capture spec. */
export function statusOfError(error: unknown): DeviceStatus {
  const name = error instanceof Error || error instanceof DOMException ? error.name : "";
  if (name === "NotAllowedError" || name === "SecurityError" || name === "PermissionDeniedError") return "blocked";
  if (name === "NotReadableError" || name === "AbortError" || name === "TrackStartError") return "busy";
  return "missing";
}

export type GetUserMedia = (constraints: MediaStreamConstraints) => Promise<MediaStream>;

export type Opened = { tracks: MediaStreamTrack[]; status: Partial<DeviceStatuses> };

/**
 * Asks for the devices in `kinds`. Both at once first: one prompt. When that fails, each one
 * alone, so an allowed microphone works when the camera is refused, and the other way round.
 */
export async function openDevices(kinds: readonly MediaKind[], getUserMedia: GetUserMedia | null): Promise<Opened> {
  const status: Partial<DeviceStatuses> = {};
  const tracks: MediaStreamTrack[] = [];
  if (!getUserMedia) {
    for (const kind of kinds) status[kind] = "unsupported";
    return { tracks, status };
  }
  if (kinds.length > 1) {
    try {
      const stream = await getUserMedia({ audio: AUDIO_CONSTRAINTS, video: VIDEO_CONSTRAINTS });
      for (const kind of kinds) status[kind] = "ok";
      return { tracks: stream.getTracks(), status };
    } catch {
      // Try each device alone below.
    }
  }
  for (const kind of kinds) {
    try {
      const stream = await getUserMedia(constraintsFor(kind));
      tracks.push(...stream.getTracks());
      status[kind] = "ok";
    } catch (error) {
      status[kind] = statusOfError(error);
    }
  }
  return { tracks, status };
}

const NAME: Record<MediaKind, string> = { audio: "microphone", video: "camera" };

function problem(kind: MediaKind, status: DeviceStatus): string | null {
  switch (status) {
    case "blocked":
      return `The ${NAME[kind]} is blocked.`;
    case "missing":
      return `No ${NAME[kind]} was found.`;
    case "busy":
      return `Another app is using the ${NAME[kind]}.`;
    case "unsupported":
      return `This browser cannot use a ${NAME[kind]}.`;
    default:
      return null;
  }
}

const BOTH: Partial<Record<DeviceStatus, string>> = {
  blocked: "The camera and microphone are blocked.",
  missing: "No camera or microphone was found.",
  busy: "Another app is using the camera and microphone.",
  unsupported: "This browser cannot use a camera or microphone.",
};

/** One short message about the devices. Null when there is nothing to say. */
export function mediaMessage({ audio, video }: DeviceStatuses): string | null {
  const audioProblem = problem("audio", audio);
  const videoProblem = problem("video", video);
  if (!audioProblem && !videoProblem) return null;
  if (audioProblem && videoProblem) {
    const both = (audio === video && BOTH[audio]) || `${audioProblem} ${videoProblem}`;
    return `${both} You can join and still see and hear others.`;
  }
  if (audioProblem) {
    return video === "ok" ? `${audioProblem} You join with the camera only. Others cannot hear you.` : audioProblem;
  }
  return audio === "ok" ? `${videoProblem} You join with the microphone only.` : videoProblem;
}

/** How to unblock the devices in this browser. The user agent picks the steps. */
export function unblockHint(userAgent: string, touchPoints = 0): string {
  const iOS = /iPhone|iPad|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && touchPoints > 1);
  if (iOS)
    return "On iPhone or iPad: tap aA in the address bar, then Website Settings, and set Camera and Microphone to Allow. Or open Settings > Apps > Safari > Camera and Microphone. Then tap Try again.";
  if (/Android/.test(userAgent))
    return "On Android: tap the icon to the left of the address, then Permissions, and allow Camera and Microphone. Then tap Try again.";
  if (/Firefox\//.test(userAgent))
    return "Click the crossed camera icon in the address bar and allow the camera and microphone. Then click Try again.";
  if (/Safari\//.test(userAgent) && !/Chrome|Chromium|Edg\//.test(userAgent))
    return "In Safari, open Safari > Settings for This Website, and set Camera and Microphone to Allow. Then click Try again.";
  return "Click the lock icon or the camera icon in the address bar and allow the camera and microphone. Then click Try again.";
}

/**
 * The permission state of a device, from the Permissions API. Null when the browser cannot say
 * (Safari before 16, and Firefox for some names). Then only getUserMedia gives the answer.
 */
export async function permissionState(kind: MediaKind): Promise<PermissionStatus | null> {
  try {
    return (await navigator.permissions?.query({ name: (kind === "audio" ? "microphone" : "camera") as PermissionName })) ?? null;
  } catch {
    return null;
  }
}
