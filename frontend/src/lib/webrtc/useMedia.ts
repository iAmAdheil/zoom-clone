"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  constraintsFor,
  mediaMessage,
  openDevices,
  permissionState,
  type DeviceStatuses,
  type GetUserMedia,
} from "./mediaAccess";
import type { MediaKind } from "./peerManager";

// The local camera and microphone. MeetingExperience owns the stream, so the pre-join preview
// and the room use the same one. Mute and video off change `track.enabled` (useTrackToggles)
// and the WebRTC senders (PeerManager.setSending).
//
// The devices open at once only when the user allowed them before (no prompt shows then).
// Else they wait for a tap on "Allow camera and microphone", or on Join: mobile browsers may
// not show a prompt without a tap. The tracks stop when `active` turns false, when the
// component unmounts, and when the page unloads.

export type LocalMedia = {
  /** Null before the devices open, and for "no media". A new object after each change. */
  stream: MediaStream | null;
  /** True while the browser asks the user. */
  asking: boolean;
  status: DeviceStatuses;
  hasAudio: boolean;
  hasVideo: boolean;
  /** A short message when a device is missing or blocked. The user can still join. */
  error: string | null;
  /** Opens the devices in `kinds` that are not open. Call it in a click or tap handler. */
  request: (kinds: readonly MediaKind[]) => Promise<DeviceStatuses>;
  /** Uses another microphone or camera. Resolves to false when the device does not open. */
  selectDevice: (kind: MediaKind, deviceId: string) => Promise<boolean>;
};

type State = { stream: MediaStream | null; status: DeviceStatuses; asking: boolean };

const IDLE: State = { stream: null, status: { audio: "idle", video: "idle" }, asking: false };
const KINDS: MediaKind[] = ["audio", "video"];

function browserGetUserMedia(): GetUserMedia | null {
  const devices = typeof navigator === "undefined" ? undefined : navigator.mediaDevices;
  return devices?.getUserMedia ? (constraints) => devices.getUserMedia(constraints) : null;
}

function stopTracks(tracks: readonly MediaStreamTrack[]) {
  tracks.forEach((track) => track.stop());
}

function liveTrack(stream: MediaStream | null, kind: MediaKind): MediaStreamTrack | null {
  return stream?.getTracks().find((t) => t.kind === kind && t.readyState === "live") ?? null;
}

/** A new stream with the live tracks of `stream` and the `added` ones. An added track replaces (and stops) the old track of its kind. */
function mergeTracks(stream: MediaStream | null, added: readonly MediaStreamTrack[]): MediaStream | null {
  const addedKinds = new Set(added.map((t) => t.kind));
  const kept: MediaStreamTrack[] = [];
  for (const track of stream?.getTracks() ?? []) {
    if (addedKinds.has(track.kind) || track.readyState !== "live") track.stop();
    else kept.push(track);
  }
  const tracks = [...kept, ...added];
  return tracks.length > 0 ? new MediaStream(tracks) : null;
}

/** The kinds that are in `kinds` and whose permission is "granted". */
async function grantedKinds(kinds: readonly MediaKind[]): Promise<MediaKind[]> {
  const states = await Promise.all(kinds.map(permissionState));
  return kinds.filter((_, i) => states[i]?.state === "granted");
}

/** The camera and microphone while `active` is true. */
export function useMedia(active: boolean): LocalMedia {
  const [state, setState] = useState<State>(IDLE);
  // The latest state for the async callbacks. React state is one render late for them.
  const latest = useRef<State>(IDLE);
  // Adds 1 when the devices close. An answer that comes after that is dropped.
  const generation = useRef(0);
  const inflight = useRef<Promise<DeviceStatuses> | null>(null);

  const commit = useCallback((next: State) => {
    latest.current = next;
    setState(next);
  }, []);

  const request = useCallback(
    async (kinds: readonly MediaKind[]): Promise<DeviceStatuses> => {
      // One prompt at a time. A second tap waits for the first answer.
      if (inflight.current) await inflight.current;
      const missing = kinds.filter((kind) => !liveTrack(latest.current.stream, kind));
      if (missing.length === 0) return latest.current.status;
      const gen = generation.current;
      commit({ ...latest.current, asking: true });
      const run = (async () => {
        const opened = await openDevices(missing, browserGetUserMedia());
        if (gen !== generation.current) {
          stopTracks(opened.tracks);
          return latest.current.status;
        }
        const status = { ...latest.current.status, ...opened.status };
        commit({ stream: mergeTracks(latest.current.stream, opened.tracks), status, asking: false });
        return status;
      })();
      inflight.current = run;
      try {
        return await run;
      } finally {
        if (inflight.current === run) inflight.current = null;
      }
    },
    [commit],
  );

  const selectDevice = useCallback(
    async (kind: MediaKind, deviceId: string) => {
      const getUserMedia = browserGetUserMedia();
      if (!getUserMedia) return false;
      const gen = generation.current;
      try {
        const tracks = (await getUserMedia(constraintsFor(kind, deviceId))).getTracks();
        if (gen !== generation.current) {
          stopTracks(tracks);
          return false;
        }
        const current = latest.current;
        commit({ ...current, stream: mergeTracks(current.stream, tracks), status: { ...current.status, [kind]: "ok" } });
        return true;
      } catch {
        return false;
      }
    },
    [commit],
  );

  // Open the devices that the user allowed before. Close everything when `active` ends.
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    void grantedKinds(KINDS).then((granted) => {
      if (!cancelled && granted.length > 0) void request(granted);
    });
    // The browser stops the devices on unload too. This makes the camera light go off at once.
    const onPageHide = () => stopTracks(latest.current.stream?.getTracks() ?? []);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      cancelled = true;
      generation.current += 1;
      window.removeEventListener("pagehide", onPageHide);
      stopTracks(latest.current.stream?.getTracks() ?? []);
      commit(IDLE);
    };
  }, [active, request, commit]);

  // The user may allow a blocked device later, in the browser or phone settings. Open it then,
  // with no reload. The Permissions API tells it with "change", or when the page shows again.
  // Safari may not support the query: then the "Try again" button does it.
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    const watched: PermissionStatus[] = [];
    const retry = async () => {
      if (cancelled || document.visibilityState !== "visible") return;
      const blocked = KINDS.filter((kind) => latest.current.status[kind] === "blocked");
      if (blocked.length === 0) return;
      const granted = await grantedKinds(blocked);
      if (!cancelled && granted.length > 0) void request(granted);
    };
    for (const kind of KINDS) {
      void permissionState(kind).then((permission) => {
        if (!permission || cancelled) return;
        permission.addEventListener("change", retry);
        watched.push(permission);
      });
    }
    document.addEventListener("visibilitychange", retry);
    return () => {
      cancelled = true;
      watched.forEach((permission) => permission.removeEventListener("change", retry));
      document.removeEventListener("visibilitychange", retry);
    };
  }, [active, request]);

  // A device that is unplugged (or taken by the system) ends its track. Drop the track, so
  // the UI shows the device as missing and the peers stop sending it.
  useEffect(() => {
    const tracks = state.stream?.getTracks() ?? [];
    if (tracks.length === 0) return;
    const onEnded = () => {
      const current = latest.current;
      const stream = mergeTracks(current.stream, []);
      const status = { ...current.status };
      for (const kind of KINDS) if (status[kind] === "ok" && !liveTrack(stream, kind)) status[kind] = "missing";
      commit({ ...current, stream, status });
    };
    tracks.forEach((track) => track.addEventListener("ended", onEnded));
    return () => tracks.forEach((track) => track.removeEventListener("ended", onEnded));
  }, [state.stream, commit]);

  const { stream, status, asking } = state;
  return {
    stream,
    asking,
    status,
    hasAudio: liveTrack(stream, "audio") !== null,
    hasVideo: liveTrack(stream, "video") !== null,
    error: mediaMessage(status),
    request,
    selectDevice,
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
