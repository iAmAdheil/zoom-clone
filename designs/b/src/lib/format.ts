import { DISPLAY_TIMEZONE } from "./mock";

/** Join class names. Falsy values are skipped. */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

/** "8412093375" -> "841 209 3375" (Zoom groups meeting IDs this way). */
export function formatMeetingCode(code: string): string {
  const d = code.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)} ${d.slice(3)}`;
  return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`;
}

/** Accept a code or an invite link. Return the digits only. */
export function extractMeetingCode(input: string): string {
  const fromLink = input.match(/\/j\/(\d[\d\s]*)/);
  const raw = fromLink ? fromLink[1] : input;
  return raw.replace(/\D/g, "");
}

export function initials(name: string): string {
  const words = name.replace(/^Guest:\s*/, "").trim().split(/\s+/);
  const first = words[0]?.[0] ?? "";
  const last = words.length > 1 ? words[words.length - 1][0] : "";
  return (first + last).toUpperCase();
}

const timeFmt = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
  timeZone: DISPLAY_TIMEZONE,
});

const dayFmt = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  timeZone: DISPLAY_TIMEZONE,
});

const longDayFmt = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
  timeZone: DISPLAY_TIMEZONE,
});

export function formatTime(iso: string): string {
  return timeFmt.format(new Date(iso));
}

export function formatDay(iso: string): string {
  return dayFmt.format(new Date(iso));
}

export function formatLongDay(iso: string): string {
  return longDayFmt.format(new Date(iso));
}

export function formatTimeRange(startIso: string, minutes: number): string {
  const end = new Date(new Date(startIso).getTime() + minutes * 60_000);
  return `${formatTime(startIso)} – ${formatTime(end.toISOString())}`;
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} hr`;
  return `${h} hr ${m} min`;
}

export function minutesBetween(startIso: string, endIso: string): number {
  return Math.round((new Date(endIso).getTime() - new Date(startIso).getTime()) / 60_000);
}

/** Group key for a date, in the display time zone. */
export function dayKey(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: DISPLAY_TIMEZONE }).format(new Date(iso));
}
