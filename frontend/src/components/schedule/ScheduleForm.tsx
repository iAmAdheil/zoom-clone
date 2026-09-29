"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Check, Select, TextArea, TextInput } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { MOCK_NOW, demoUser, upcomingMeetings } from "@/lib/mock";
import type { MeetingAccess } from "@/lib/types";
import { FormRow } from "./FormRow";
import { ScheduledSummary, type ScheduledMeeting } from "./ScheduledSummary";

const TIMEZONES = [
  { value: "Asia/Kolkata", label: "(GMT+5:30) India", offset: "+05:30" },
  { value: "Europe/London", label: "(GMT+1:00) London", offset: "+01:00" },
  { value: "America/New_York", label: "(GMT-4:00) Eastern Time (US and Canada)", offset: "-04:00" },
  { value: "America/Los_Angeles", label: "(GMT-7:00) Pacific Time (US and Canada)", offset: "-07:00" },
] as const;

// 12:00, 12:30, 1:00 ... 11:30 (the Zoom time picker uses 30 minute steps).
const TIMES = Array.from({ length: 24 }, (_, i) => {
  const hour = Math.floor(i / 2) === 0 ? 12 : Math.floor(i / 2);
  return `${hour}:${i % 2 === 0 ? "00" : "30"}`;
});

type Errors = Partial<Record<"topic" | "when" | "duration" | "passcode", string>>;

function toIso(date: string, time: string, meridiem: "AM" | "PM", offset: string) {
  const [h, m] = time.split(":").map(Number);
  const hour24 = (h % 12) + (meridiem === "PM" ? 12 : 0);
  return new Date(`${date}T${String(hour24).padStart(2, "0")}:${String(m).padStart(2, "0")}:00${offset}`).toISOString();
}

/** The "Schedule Meeting" page of the Zoom web portal, with the access setting from the brief. */
export function ScheduleForm() {
  const [topic, setTopic] = useState(`${demoUser.name}'s Zoom Meeting`);
  const [showDescription, setShowDescription] = useState(false);
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("2026-09-30");
  const [time, setTime] = useState("3:00");
  const [meridiem, setMeridiem] = useState<"AM" | "PM">("PM");
  const [hours, setHours] = useState(1);
  const [minutes, setMinutes] = useState(0);
  const [timezone, setTimezone] = useState<string>(TIMEZONES[0].value);
  const [usePasscode, setUsePasscode] = useState(true);
  const [passcode, setPasscode] = useState("Zm7q2X");
  const [waitingRoom, setWaitingRoom] = useState(false);
  const [access, setAccess] = useState<MeetingAccess>("allow_guests");
  const [errors, setErrors] = useState<Errors>({});
  const [saved, setSaved] = useState<ScheduledMeeting | null>(null);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const tz = TIMEZONES.find((t) => t.value === timezone) ?? TIMEZONES[0];
    const start = date ? toIso(date, time, meridiem, tz.offset) : "";
    const next: Errors = {};
    if (!topic.trim()) next.topic = "Enter a topic.";
    if (!start) next.when = "Pick a date.";
    else if (new Date(start) <= new Date(MOCK_NOW)) next.when = "Pick a time in the future.";
    if (hours * 60 + minutes <= 0) next.duration = "The meeting must be at least 15 minutes.";
    if (usePasscode && !/^[A-Za-z0-9@*_-]{1,10}$/.test(passcode))
      next.passcode = "Use 1 to 10 letters, numbers or @ * _ -.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    // Mock of POST /api/meetings. It reuses a mock meeting code.
    setSaved({
      title: topic.trim(),
      description: description.trim() || null,
      start,
      duration: hours * 60 + minutes,
      timezoneLabel: tz.label,
      access,
      passcode: usePasscode ? passcode : null,
      waitingRoom,
      code: upcomingMeetings[0].meeting_code,
    });
    window.scrollTo({ top: 0 });
  }

  if (saved) return <ScheduledSummary meeting={saved} onEdit={() => setSaved(null)} />;

  return (
    <form onSubmit={onSubmit} noValidate className="max-w-form">
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
            className="inline-flex w-fit items-center gap-1 rounded-sm text-sm font-bold text-primary hover:underline"
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
              min="2026-09-30"
              onChange={(e) => setDate(e.target.value)}
              aria-invalid={errors.when ? true : undefined}
              aria-describedby={errors.when ? "when-msg" : undefined}
            />
          </div>
          <Select
            aria-label="Start time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="w-28"
          >
            {TIMES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
          <Select
            aria-label="AM or PM"
            value={meridiem}
            onChange={(e) => setMeridiem(e.target.value as "AM" | "PM")}
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
            onChange={(e) => setHours(Number(e.target.value))}
            className="w-24"
          >
            {Array.from({ length: 25 }, (_, h) => (
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
            {[0, 15, 30, 45].map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </Select>
          min
        </div>
      </FormRow>

      <FormRow label="Time Zone" htmlFor="timezone">
        <Select id="timezone" value={timezone} onChange={(e) => setTimezone(e.target.value)} className="sm:max-w-sm">
          {TIMEZONES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
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
          description="Only users admitted by the host can join the meeting."
          checked={waitingRoom}
          onChange={(e) => setWaitingRoom(e.target.checked)}
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
        <Button type="submit">Save</Button>
        <ButtonLink href="/" variant="secondary">
          Cancel
        </ButtonLink>
      </div>
      <p className="mt-6 text-xs text-ink-muted sm:pl-46">
        Times show in the selected time zone. <Link href="/" className="rounded-sm text-primary hover:underline">Back to Home</Link>
      </p>
    </form>
  );
}
