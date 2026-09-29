"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type RefObject } from "react";

/** Call `onDismiss` on a click outside `ref`, or on the Escape key. */
export function useDismiss(
  ref: RefObject<HTMLElement | null>,
  open: boolean,
  onDismiss: () => void,
) {
  useEffect(() => {
    if (!open) return;
    function onPointer(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onDismiss();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onDismiss();
    }
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [ref, open, onDismiss]);
}

/** Copy text to the clipboard. `copied` is true for 2 seconds after. */
export function useCopy() {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const copy = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Clipboard can be blocked. The mock still shows the copied state.
    }
    setCopied(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 2000);
  }, []);

  return { copied, copy };
}

function subscribeMinute(callback: () => void) {
  const id = setInterval(callback, 15_000);
  return () => clearInterval(id);
}

function minuteSnapshot() {
  return Math.floor(Date.now() / 60_000) * 60_000;
}

/** Current time, rounded to the minute. `null` on the server. */
export function useNow(): Date | null {
  const ms = useSyncExternalStore(subscribeMinute, minuteSnapshot, () => null);
  return ms === null ? null : new Date(ms);
}

function subscribeSecond(callback: () => void) {
  const id = setInterval(callback, 1000);
  return () => clearInterval(id);
}

function secondSnapshot() {
  return Math.floor(Date.now() / 1000);
}

/** Seconds since the component first rendered on the client. */
export function useElapsedSeconds(): number {
  const [start] = useState(() => Math.floor(Date.now() / 1000));
  const now = useSyncExternalStore(subscribeSecond, secondSnapshot, () => start);
  return Math.max(0, now - start);
}
