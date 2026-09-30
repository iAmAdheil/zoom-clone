"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Check, Select, TextArea, TextInput } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { ApiError, api } from "@/lib/api";
import { useUser } from "@/lib/auth";
import { dayKey } from "@/lib/format";
import { refreshMeetingLists } from "@/lib/queries";
import { browserTimeZone, gmtOffsetLabel, zonedTimeToUtc } from "@/lib/timezone";
import type { Meeting, MeetingAccess, ScheduleMeetingInput } from "@/lib/types";
import { FormRow } from "./FormRow";
import { ScheduledSummary } from "./ScheduledSummary";

// Time zones in the picker. The browser time zone is added first when it is not in the list.
const ZONES = [
  { value: "Asia/Kolkata", name: "India" },
  { value: "Europe/London", name: "London" },
  { value: "America/New_York", name: "Eastern Time (US and Canada)" },
  { value: "America/Los_Angeles", name: "Pacific Time (US and Canada)" },
  { value: "UTC", name: "Coordinated Universal Time" },
];

type ZoneOption = { value: string; label: string };

/** The browser zone goes first. Aliases count as the same zone ("Asia/Calcutta" is "Asia/Kolkata"). */
function zoneOptions(browserZone: string): ZoneOption[] {
  const canonical = (zone: string) => new Intl.DateTimeFormat("en-US", { timeZone: zone }).resolvedOptions().timeZone;
  const own = canonical(browserZone);
  const match = ZONES.find((z) => canonical(z.value) === own);
  const zones = match
    ? [match, ...ZONES.filter((z) => z !== match)]
    : [{ value: browserZone, name: browserZone.replace(/_/g, " ") }, ...ZONES];
  return zones.map((z) => ({ value: z.value, label: `(${gmtOffsetLabel(z.value)}) ${z.name}` }));
}

// 12:00, 12:30, 1:00 ... 11:30 (the Zoom time picker uses 30 minute steps).
const TIMES = Array.from({ length: 24 }, (_, i) => {
  const hour = Math.floor(i / 2) === 0 ? 12 : Math.floor(i / 2);
  return `${hour}:${i % 2 === 0 ? "00" : "30"}`;
});

type Meridiem = "AM" | "PM";
type ErrorKey = "topic" | "when" | "duration" | "timezone" | "passcode" | "form";
type Errors = Partial<Record<ErrorKey, string>>;

/** The next half-hour slot from now, in the browser time zone. */
function nextSlot(): { date: string; time: string; meridiem: Meridiem } {
  const d = new Date();
  d.setSeconds(0, 0);
  d.setMinutes(d.getMinutes() < 30 ? 30 : 60);
  const h12 = d.getHours() % 12 === 0 ? 12 : d.getHours() % 12;
  return {
    date: dayKey(d),
    time: `${h12}:${d.getMinutes() === 0 ? "00" : "30"}`,
    meridiem: d.getHours() < 12 ? "AM" : "PM",
  };
}

function to24h(time: string, meridiem: Meridiem): { hour: number; minute: number } {
  const [h, m] = time.split(":").map(Number);
  return { hour: (h % 12) + (meridiem === "PM" ? 12 : 0), minute: m };
}

/** A random 6-character passcode, like Zoom makes for a new meeting. */
function randomPasscode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

// The API accepts a duration from 1 minute to 24 hours (backend: 1 <= duration_min <= 1440).
// The pickers step by 15 minutes, so 24 h allows only 0 min.
const MAX_HOURS = 24;
const MINUTE_STEPS = [0, 15, 30, 45];

// Field names in the backend "validation_error" detail -> the form row and a friendly message.
// The backend text is Pydantic text ("Input should be less than or equal to 1440"). We do not show it.
const FIELD_ERRORS: Record<string, { row: ErrorKey; message: string }> = {
  title: { row: "topic", message: "Enter a topic of 1 to 255 characters." },
  description: { row: "topic", message: "The description is too long. Use up to 5000 characters." },
  scheduled_start: { row: "when", message: "Pick a valid date and time." },
  duration_min: { row: "duration", message: "The duration must be from 15 minutes to 24 hours." },
  timezone: { row: "timezone", message: "Pick a time zone from the list." },
  passcode: { row: "passcode", message: "Use 1 to 10 letters, numbers or @ * _ -." },
};

const GENERIC_SAVE_ERROR = "The meeting could not be saved. Try again.";

/** Puts a server error next to the field it is about, in plain words. Other errors go to the top of the form. */
function serverErrors(error: unknown): Errors {
  if (!(error instanceof ApiError)) return { form: GENERIC_SAVE_ERROR };
  switch (error.code) {
    case "start_in_past":
      return { when: "Pick a time in the future." };
    case "network_error":
      return { form: error.message };
    case "not_authenticated":
      return { form: "Your session has ended. Sign in again to save the meeting." };
    case "meeting_not_editable":
      return { form: "This meeting can no longer be changed." };
    case "meeting_not_found":
      return { form: "This meeting no longer exists." };
    case "validation_error": {
      // The detail looks like "title: String should have at least 1 character; duration_min: ...".
      const out: Errors = {};
      for (const part of error.message.split("; ")) {
        const field = FIELD_ERRORS[part.split(": ")[0]];
        if (field) out[field.row] = field.message;
        else out.form = "Some details are not valid. Check the form and try again.";
      }
      return out;
    }
    default:
      return { form: GENERIC_SAVE_ERROR };
  }
}

/** The "Schedule Meeting" page of the Zoom web portal, with the access setting from the brief. */
export function ScheduleForm() {
  const user = useUser();
  const [slot] = useState(nextSlot);
  const [zones] = useState(() => zoneOptions(browserTimeZone()));

  const [topic, setTopic] = useState(`${user.name}'s Zoom Meeting`);
  const [showDescription, setShowDescription] = useState(false);
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(slot.date);
  const [time, setTime] = useState(slot.time);
  const [meridiem, setMeridiem] = useState<Meridiem>(slot.meridiem);
  const [hours, setHours] = useState(1);
  const [minutes, setMinutes] = useState(0);
  const [timezone, setTimezone] = useState(zones[0].value);
  const [usePasscode, setUsePasscode] = useState(true);
  const [passcode, setPasscode] = useState(randomPasscode);
  const [access, setAccess] = useState<MeetingAccess>("allow_guests");
  const [errors, setErrors] = useState<Errors>({});
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState<Meeting | null>(null);
  const [editing, setEditing] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const { hour, minute } = to24h(time, meridiem);
    const start = date ? zonedTimeToUtc(date, hour, minute, timezone) : null;
    const next: Errors = {};
    if (!topic.trim()) next.topic = "Enter a topic.";
    if (!start || Number.isNaN(start.getTime())) next.when = "Pick a date.";
    else if (start.getTime() <= Date.now()) next.when = "Pick a time in the future.";
    const total = hours * 60 + minutes;
    if (total < 15) next.duration = "The meeting must be at least 15 minutes.";
    else if (total > MAX_HOURS * 60) next.duration = "The meeting can be up to 24 hours long.";
    if (usePasscode && !/^[A-Za-z0-9@*_-]{1,10}$/.test(passcode))
      next.passcode = "Use 1 to 10 letters, numbers or @ * _ -.";
    setErrors(next);
    if (Object.keys(next).length > 0 || !start) return;

    const input: ScheduleMeetingInput = {
      title: topic.trim(),
      description: description.trim() || null,
      scheduled_start: start.toISOString(),
      duration_min: hours * 60 + minutes,
      timezone,
      access,
      passcode: usePasscode ? passcode : null,
    };

    setPending(true);
    try {
      const meeting =
        editing && saved ? await api.updateMeeting(saved.id, input) : await api.scheduleMeeting(input);
      void refreshMeetingLists();
      setSaved(meeting);
      setEditing(false);
      window.scrollTo({ top: 0 });
    } catch (caught) {
      setErrors(serverErrors(caught));
    } finally {
      setPending(false);
    }
  }

  if (saved && !editing) {
    const zoneLabel = zones.find((z) => z.value === saved.timezone)?.label ?? saved.timezone;
    return <ScheduledSummary meeting={saved} timezoneLabel={zoneLabel} onEdit={() => setEditing(true)} />;
  }

  return (
    <form onSubmit={onSubmit} noValidate className="max-w-form">
      {errors.form ? (
        <p role="alert" className="mt-4 flex items-center gap-1.5 rounded-md bg-danger-soft px-4 py-3 text-sm text-danger">
          <Icon name="alert" size={16} />
          {errors.form}
        </p>
      ) : null}

      <FormRow label="Topic" htmlFor="topic" error={errors.topic} errorId="topic-msg">
        <TextInput
          id="topic"
          value={topic}
          maxLength={200}
          onChange={(e) => setTopic(e.target.value)}
          aria-invalid={errors.topic ? true : undefined}
          aria-describedby={errors.topic ? "topic-msg" : undefined}
        />
        {showDescription ? (
          <TextArea
            id="description"
            aria-label="Description (optional)"
            placeholder="Description (optional)"
            value={description}
            maxLength={2000}
            onChange={(e) => setDescription(e.target.value)}
          />
        ) : (
          <button
            type="button"
            onClick={() => setShowDescription(true)}
            className="inline-flex w-fit items-center gap-1 rounded-sm text-sm font-bold text-primary hover:underline max-sm:min-h-10"
          >
            <Icon name="plus" size={16} /> Add Description
          </button>
        )}
      </FormRow>

      <FormRow label="When" htmlFor="date" error={errors.when} errorId="when-msg">
        <div className="flex flex-wrap gap-2">
          <div className="relative w-full sm:w-44">
            <TextInput
              id="date"
              type="date"
              value={date}
              min={slot.date}
              onChange={(e) => setDate(e.target.value)}
              aria-invalid={errors.when ? true : undefined}
              aria-describedby={errors.when ? "when-msg" : undefined}
            />
          </div>
          <Select aria-label="Start time" value={time} onChange={(e) => setTime(e.target.value)} className="w-28">
            {TIMES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
          <Select
            aria-label="AM or PM"
            value={meridiem}
            onChange={(e) => setMeridiem(e.target.value as Meridiem)}
            className="w-24"
          >
            <option value="AM">AM</option>
            <option value="PM">PM</option>
          </Select>
        </div>
      </FormRow>

      <FormRow label="Duration" htmlFor="duration-hr" error={errors.duration} errorId="duration-msg">
        <div className="flex items-center gap-2 text-sm text-ink-2">
          <Select
            id="duration-hr"
            aria-label="Hours"
            value={hours}
            onChange={(e) => {
              const value = Number(e.target.value);
              setHours(value);
              // 24 hr is the limit, so it cannot have extra minutes.
              if (value === MAX_HOURS) setMinutes(0);
            }}
            className="w-24"
          >
            {Array.from({ length: MAX_HOURS + 1 }, (_, h) => (
              <option key={h} value={h}>
                {h}
              </option>
            ))}
          </Select>
          hr
          <Select
            aria-label="Minutes"
            value={minutes}
            onChange={(e) => setMinutes(Number(e.target.value))}
            className="ml-2 w-24"
          >
            {MINUTE_STEPS.filter((m) => hours < MAX_HOURS || m === 0).map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </Select>
          min
        </div>
      </FormRow>

      <FormRow label="Time Zone" htmlFor="timezone" error={errors.timezone} errorId="timezone-msg">
        <Select id="timezone" value={timezone} onChange={(e) => setTimezone(e.target.value)} className="sm:max-w-sm">
          {zones.map((z) => (
            <option key={z.value} value={z.value}>
              {z.label}
            </option>
          ))}
        </Select>
      </FormRow>

      <FormRow label="Security" error={errors.passcode} errorId="passcode-msg">
        <div className="flex flex-wrap items-center gap-3">
          <Check
            id="use-passcode"
            label="Passcode"
            checked={usePasscode}
            onChange={(e) => setUsePasscode(e.target.checked)}
          />
          <div className="w-36">
            <TextInput
              aria-label="Passcode"
              value={passcode}
              disabled={!usePasscode}
              maxLength={10}
              onChange={(e) => setPasscode(e.target.value)}
              aria-invalid={errors.passcode ? true : undefined}
              aria-describedby={errors.passcode ? "passcode-msg" : undefined}
            />
          </div>
        </div>
        <p className="-mt-1 pl-6.5 text-xs text-ink-muted">
          Only users who have the invite link or passcode can join the meeting.
        </p>
        <Check
          id="waiting-room"
          label="Waiting Room"
          description="Only users admitted by the host can join the meeting. Not available yet."
          disabled
        />
      </FormRow>

      <FormRow label="Meeting access">
        <fieldset className="flex flex-col gap-3">
          <legend className="sr-only">Who can join</legend>
          <Check
            type="radio"
            id="access-guests"
            name="access"
            label="Allow guests"
            description="Anyone with the invite link can join. Guests only enter a display name."
            checked={access === "allow_guests"}
            onChange={() => setAccess("allow_guests")}
          />
          <Check
            type="radio"
            id="access-verified"
            name="access"
            label="Verified users only"
            description="Participants must sign in (Google or demo user) to join."
            checked={access === "verified_only"}
            onChange={() => setAccess("verified_only")}
          />
        </fieldset>
      </FormRow>

      <div className="flex gap-3 pt-6 sm:pl-46">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving..." : "Save"}
        </Button>
        {editing ? (
          <Button variant="secondary" onClick={() => setEditing(false)}>
            Cancel
          </Button>
        ) : (
          <ButtonLink href="/" variant="secondary">
            Cancel
          </ButtonLink>
        )}
      </div>
      <p className="mt-6 text-xs text-ink-muted sm:pl-46">
        Times show in the selected time zone.{" "}
        <Link href="/" className="inline-flex items-center rounded-sm text-primary underline max-sm:min-h-10">
          Back to Home
        </Link>
      </p>
    </form>
  );
}
