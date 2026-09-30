"use client";

import { useEffect, useSyncExternalStore } from "react";

// Remote sound and the autoplay rules of the browsers.
//
// Each remote participant plays through one <audio> element (RemoteAudio). A browser can
// refuse `audio.play()` until the user clicks or taps the page: Safari on Mac and iPhone,
// every iOS browser, and any browser after a reload straight into the room. This module
// remembers the refused elements, shows the "Sound is blocked" banner, and plays them again
// on the next click, key press or tap, and when the page shows again.
//
// Why an <audio> element and not Web Audio: Chrome gives no remote WebRTC sound to Web Audio
// unless a media element also plays the stream, and an AudioContext has the same autoplay
// gate. So Web Audio adds no path that works more often. It only measures levels here.

const elements = new Set<HTMLAudioElement>();
const refused = new Set<HTMLAudioElement>();
const listeners = new Set<() => void>();
let context: AudioContext | null = null;

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const isBlocked = () => refused.size > 0;
const serverBlocked = () => false;

/** Plays one element. A refusal of the autoplay rules marks it as blocked. */
export async function playAudio(element: HTMLAudioElement): Promise<boolean> {
  try {
    await element.play();
    if (refused.delete(element)) emit();
    return true;
  } catch (error) {
    // AbortError only means a newer stream replaced the old one. That is not a block.
    if (error instanceof DOMException && error.name === "NotAllowedError" && elements.has(element)) {
      refused.add(element);
      emit();
    }
    return false;
  }
}

/** Adds an element to the list that `unlockAudio` plays. Returns the remove function. */
export function registerAudio(element: HTMLAudioElement): () => void {
  elements.add(element);
  return () => {
    elements.delete(element);
    if (refused.delete(element)) emit();
  };
}

/** The one AudioContext of the page (for level meters). Null when the browser has none. */
export function sharedAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!context) {
    const Context = window.AudioContext ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Context) return null;
    context = new Context();
  }
  return context;
}

/**
 * Call it in a click, key or tap handler (Join, the banner). It starts the AudioContext (if the
 * page made one) and plays each paused remote element. The play() calls start in the handler, so the browser
 * counts them as started by the user.
 */
export function unlockAudio() {
  if (context && context.state === "suspended") void context.resume().catch(() => {});
  for (const element of elements) if (element.paused && element.srcObject) void playAudio(element);
}

/** Sets the speaker of one element. Browsers without setSinkId use the system speaker. */
export function setAudioOutput(element: HTMLAudioElement, deviceId: string) {
  if (typeof element.setSinkId !== "function" || element.sinkId === deviceId) return;
  element.setSinkId(deviceId).catch((error: unknown) => console.warn("Audio output:", error));
}

/** True when the browser can send the sound to a chosen speaker. */
export function canChooseSpeaker(): boolean {
  return typeof HTMLMediaElement !== "undefined" && "setSinkId" in HTMLMediaElement.prototype;
}

const GESTURES = ["click", "keydown", "touchstart", "touchend"] as const;

/** True while the browser blocks the remote sound (the room shows a banner). */
export function useAudioBlocked(): boolean {
  return useSyncExternalStore(subscribe, isBlocked, serverBlocked);
}

/**
 * Call once for the meeting page. The next click, key press or tap plays the blocked sound
 * and starts the AudioContext of the level meters. So does the page when it shows again
 * (a phone may pause the sound when the user switches apps).
 */
export function useUnlockAudioOnGesture() {
  useEffect(() => {
    const onGesture = () => unlockAudio();
    const onVisible = () => {
      if (document.visibilityState === "visible") unlockAudio();
    };
    for (const type of GESTURES) document.addEventListener(type, onGesture, { capture: true, passive: true });
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      for (const type of GESTURES) document.removeEventListener(type, onGesture, { capture: true });
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
}
