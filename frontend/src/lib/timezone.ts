// Time zone math for the schedule form. It uses only the Intl API (no date library).

/** The browser time zone, for example "Asia/Kolkata". */
export function browserTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

const offsetFormatters = new Map<string, Intl.DateTimeFormat>();

/** How far `timeZone` is ahead of UTC at the moment `at`, in ms. India gives +5.5 h. */
function zoneOffsetMs(timeZone: string, at: Date): number {
  let fmt = offsetFormatters.get(timeZone);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    offsetFormatters.set(timeZone, fmt);
  }
  const parts = fmt.formatToParts(at);
  const get = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === type)?.value);
  // The wall clock time in `timeZone`, read as if it were UTC.
  const wallAsUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return wallAsUtc - Math.floor(at.getTime() / 1000) * 1000;
}

/**
 * Converts a wall clock time in `timeZone` to a UTC Date.
 * Example: ("2026-10-02", 15, 0, "Asia/Kolkata") gives 2026-10-02T09:30:00Z.
 */
export function zonedTimeToUtc(date: string, hour: number, minute: number, timeZone: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  const wallAsUtc = Date.UTC(y, m - 1, d, hour, minute);
  const guess = wallAsUtc - zoneOffsetMs(timeZone, new Date(wallAsUtc));
  // A second pass uses the offset at the guess. This fixes times near a daylight saving change.
  return new Date(wallAsUtc - zoneOffsetMs(timeZone, new Date(guess)));
}

/** "GMT+5:30" for a time zone at a given moment (the offset changes with daylight saving). */
export function gmtOffsetLabel(timeZone: string, at: Date = new Date()): string {
  const part = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "shortOffset" })
    .formatToParts(at)
    .find((p) => p.type === "timeZoneName");
  const label = part?.value ?? "GMT";
  if (label === "GMT") return "GMT+0:00";
  return label.includes(":") ? label : `${label}:00`;
}
