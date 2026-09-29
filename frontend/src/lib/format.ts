import type { MeetingAccess } from "./types";

// Date formatters. With no `timeZone` they use the browser time zone.
// Only client components call them, after the data loads, so the server never prints a time.

/** "8123456790" -> "812 345 6790" (the Zoom meeting ID layout). */
export function formatMeetingCode(code: string): string {
  const d = code.replace(/\D/g, "");
  if (d.length !== 10) return d;
  return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`;
}

const TIME: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit" };
const DAY: Intl.DateTimeFormatOptions = { weekday: "long", month: "long", day: "numeric" };
const SHORT_DATE: Intl.DateTimeFormatOptions = { weekday: "short", month: "short", day: "numeric" };

// One formatter per (options, time zone). Building an Intl formatter is slow.
const cache = new Map<string, Intl.DateTimeFormat>();

function formatter(name: string, options: Intl.DateTimeFormatOptions, timeZone?: string) {
  const key = `${name}|${timeZone ?? ""}`;
  let fmt = cache.get(key);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat("en-US", { ...options, timeZone });
    cache.set(key, fmt);
  }
  return fmt;
}

export function formatTime(iso: string, timeZone?: string): string {
  return formatter("time", TIME, timeZone).format(new Date(iso));
}

export function formatDay(iso: string, timeZone?: string): string {
  return formatter("day", DAY, timeZone).format(new Date(iso));
}

export function formatShortDate(iso: string, timeZone?: string): string {
  return formatter("short", SHORT_DATE, timeZone).format(new Date(iso));
}

/** "YYYY-MM-DD" of the date in the browser time zone. */
export function dayKey(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** "Today", "Tomorrow", or "Thu, Oct 2" for a start time, from the browser's point of view. */
export function formatRelativeDay(iso: string, now: Date): string {
  const start = new Date(iso);
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  if (dayKey(start) === dayKey(now)) return "Today";
  if (dayKey(start) === dayKey(tomorrow)) return "Tomorrow";
  return formatShortDate(iso);
}

export function addMinutes(iso: string, minutes: number): string {
  return new Date(new Date(iso).getTime() + minutes * 60_000).toISOString();
}

export function formatTimeRange(startIso: string, minutes: number, timeZone?: string): string {
  return `${formatTime(startIso, timeZone)} - ${formatTime(addMinutes(startIso, minutes), timeZone)}`;
}

export function minutesBetween(startIso: string, endIso: string): number {
  return Math.round((new Date(endIso).getTime() - new Date(startIso).getTime()) / 60_000);
}

export function accessLabel(access: MeetingAccess): string {
  return access === "verified_only" ? "Verified only" : "Guests allowed";
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}
