"use client";

import { useEffect, useState } from "react";
import { canChooseSpeaker } from "./audioPlayback";

// The lists of microphones, speakers and cameras for the device pickers.

export type DeviceKind = "audioinput" | "audiooutput" | "videoinput";

export type DeviceOption = { id: string; label: string };

const FALLBACK: Record<DeviceKind, string> = {
  audioinput: "Microphone",
  audiooutput: "Speaker",
  videoinput: "Camera",
};

/**
 * The options of one kind. Before the user allows the devices, browsers hide the labels (and
 * Safari and Firefox also the ids), so the option gets a numbered name. An entry with no id
 * cannot be chosen, so it is left out.
 */
export function deviceOptions(devices: readonly MediaDeviceInfo[], kind: DeviceKind): DeviceOption[] {
  const options: DeviceOption[] = [];
  for (const device of devices) {
    if (device.kind !== kind || !device.deviceId) continue;
    if (options.some((o) => o.id === device.deviceId)) continue;
    options.push({ id: device.deviceId, label: device.label || `${FALLBACK[kind]} ${options.length + 1}` });
  }
  return options;
}

/** The id of the device that the track of `kind` uses now. */
export function currentDeviceId(stream: MediaStream | null, kind: "audio" | "video"): string | null {
  const track = stream?.getTracks().find((t) => t.kind === kind && t.readyState === "live");
  return track?.getSettings().deviceId ?? null;
}

/** True when the browser can list the devices. */
export function canListDevices(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.mediaDevices?.enumerateDevices === "function";
}

/**
 * The devices of this computer or phone. The list loads again when a device comes or goes,
 * and when `refreshKey` changes (pass the stream: labels show after the user allows it).
 */
export function useMediaDevices(refreshKey: unknown): MediaDeviceInfo[] {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  useEffect(() => {
    if (!canListDevices()) return;
    const media = navigator.mediaDevices;
    let alive = true;
    const load = () => {
      media
        .enumerateDevices()
        .then((list) => {
          if (alive) setDevices(list);
        })
        .catch(() => {});
    };
    load();
    media.addEventListener("devicechange", load);
    return () => {
      alive = false;
      media.removeEventListener("devicechange", load);
    };
  }, [refreshKey]);
  return devices;
}

export type DeviceChoices = {
  mics: DeviceOption[];
  /** Empty when the browser cannot choose a speaker (no setSinkId, for example iOS Safari). */
  speakers: DeviceOption[];
  cams: DeviceOption[];
  micId: string | null;
  camId: string | null;
};

/** The data of the device pickers for the local `stream`. */
export function useDeviceChoices(stream: MediaStream | null): DeviceChoices {
  const devices = useMediaDevices(stream);
  return {
    mics: deviceOptions(devices, "audioinput"),
    speakers: canChooseSpeaker() ? deviceOptions(devices, "audiooutput") : [],
    cams: deviceOptions(devices, "videoinput"),
    micId: currentDeviceId(stream, "audio"),
    camId: currentDeviceId(stream, "video"),
  };
}
