"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type RefObject } from "react";

/** Calls onDismiss on Escape or on a pointer press outside `ref`. */
export function useDismiss(
  ref: RefObject<HTMLElement | null>,
  open: boolean,
  onDismiss: () => void,
) {
  const onDismissRef = useRef(onDismiss);
  useEffect(() => {
    onDismissRef.current = onDismiss;
  });

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onDismissRef.current();
    }
    function onPointer(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onDismissRef.current();
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [ref, open]);
}

/** Matches a CSS media query. Returns `fallback` during the server render. */
export function useMediaQuery(query: string, fallback = false): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => fallback,
  );
}

/** Short status message that hides itself after `ms`. */
export function useToast(ms = 2500) {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(
    (text: string) => {
      if (timer.current) clearTimeout(timer.current);
      setMessage(text);
      timer.current = setTimeout(() => setMessage(null), ms);
    },
    [ms],
  );

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  return { message, show };
}

/** True when `flag` has stayed true for `ms`. A short blip never shows. */
export function useHeldFor(flag: boolean, ms: number): boolean {
  const [held, setHeld] = useState(false);
  useEffect(() => {
    if (!flag) return;
    const timer = setTimeout(() => setHeld(true), ms);
    return () => {
      clearTimeout(timer);
      setHeld(false);
    };
  }, [flag, ms]);
  return flag && held;
}

function subscribeToClock(onTick: () => void) {
  const id = setInterval(onTick, 1000);
  return () => clearInterval(id);
}

/**
 * The current time, rounded down to the minute, in ms.
 * It is null during the server render, because the server does not know the browser time zone.
 * The component renders again only when the minute changes.
 */
export function useNowMinute(): number | null {
  return useSyncExternalStore(
    subscribeToClock,
    () => Math.floor(Date.now() / 60_000) * 60_000,
    () => null,
  );
}

/** Copies text. Returns false when the browser blocks the clipboard. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
