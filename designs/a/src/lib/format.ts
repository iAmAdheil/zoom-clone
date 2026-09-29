import { MOCK_TIMEZONE } from "./mock";

// Formatters use a fixed time zone, so the server and the browser print the same text.

/** "8123456790" -> "812 345 6790" (the Zoom meeting ID layout). */
export function formatMeetingCode(code: string): string {
  const d = code.replace(/\D/g, "");
  if (d.length !== 10) return d;
  return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`;
}

const timeFmt = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
  timeZone: MOCK_TIMEZONE,
});

const dayFmt = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
  timeZone: MOCK_TIMEZONE,
});

const shortDateFmt = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  timeZone: MOCK_TIMEZONE,
});

const dayKeyFmt = new Intl.DateTimeFormat("en-CA", { timeZone: MOCK_TIMEZONE });

export function formatTime(iso: string): string {
  return timeFmt.format(new Date(iso));
}

export function formatDay(iso: string): string {
  return dayFmt.format(new Date(iso));
}

export function formatShortDate(iso: string): string {
  return shortDateFmt.format(new Date(iso));
}

/** "YYYY-MM-DD" of the date in the mock time zone. */
export function dayKey(iso: string): string {
  return dayKeyFmt.format(new Date(iso));
}

export function addMinutes(iso: string, minutes: number): string {
  return new Date(new Date(iso).getTime() + minutes * 60_000).toISOString();
}

export function formatTimeRange(startIso: string, minutes: number): string {
  return `${formatTime(startIso)} - ${formatTime(addMinutes(startIso, minutes))}`;
}

export function minutesBetween(startIso: string, endIso: string): number {
  return Math.round((new Date(endIso).getTime() - new Date(startIso).getTime()) / 60_000);
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}
