import { DISPLAY_TIMEZONE, INVITE_ORIGIN, MOCK_NOW } from "./mock";

/** "8123456789" -> "812 345 6789", the way Zoom prints meeting IDs. */
export function formatMeetingCode(code: string): string {
  const d = code.replace(/\D/g, "");
  if (d.length !== 10) return d;
  return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`;
}

/** Pulls a 10-digit code out of a raw ID or an invite link. */
export function parseMeetingInput(input: string): string | null {
  const fromLink = input.match(/\/j\/(\d{10})/);
  if (fromLink) return fromLink[1];
  const digits = input.replace(/[\s-]/g, "");
  return /^\d{10}$/.test(digits) ? digits : null;
}

export function inviteLink(code: string): string {
  return `${INVITE_ORIGIN}/j/${code}`;
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

const dayKeyFmt = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
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

export function formatTimeRange(startIso: string, durationMin: number): string {
  const end = new Date(new Date(startIso).getTime() + durationMin * 60_000);
  return `${formatTime(startIso)} – ${formatTime(end.toISOString())}`;
}

/** "Today", "Tomorrow" or a short date, relative to MOCK_NOW. */
export function relativeDay(iso: string): string {
  const key = dayKeyFmt.format(new Date(iso));
  const today = new Date(MOCK_NOW);
  const tomorrow = new Date(today.getTime() + 86_400_000);
  if (key === dayKeyFmt.format(today)) return "Today";
  if (key === dayKeyFmt.format(tomorrow)) return "Tomorrow";
  return formatDay(iso);
}

/** Minutes from MOCK_NOW to the start time. Negative means it started. */
export function minutesUntil(iso: string): number {
  return Math.round((new Date(iso).getTime() - new Date(MOCK_NOW).getTime()) / 60_000);
}

export function formatDuration(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} hr ${m} min` : `${h} hr`;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

/** "0:07", "12:34" or "1:02:09" for the room timer. */
export function formatElapsed(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const mm = h ? String(m).padStart(2, "0") : String(m);
  const ss = String(s).padStart(2, "0");
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}
