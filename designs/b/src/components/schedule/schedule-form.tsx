"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { CalendarClock, CalendarPlus, CheckCircle2, Globe, Lock, RefreshCw, ShieldCheck } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CopyButton } from "@/components/ui/copy-button";
import { Field, Select, TextArea, TextInput } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { formatDuration, formatMeetingCode } from "@/lib/format";
import { demoUser } from "@/lib/mock";
import type { MeetingAccess } from "@/lib/types";
import { AccessOptions } from "./access-options";

const TIMEZONES = [
  { value: "Asia/Kolkata", label: "(GMT+5:30) India Standard Time" },
  { value: "UTC", label: "(GMT+0:00) Coordinated Universal Time" },
  { value: "Europe/London", label: "(GMT+1:00) London" },
  { value: "America/New_York", label: "(GMT-4:00) Eastern Time" },
  { value: "America/Los_Angeles", label: "(GMT-7:00) Pacific Time" },
];

const HOURS = [0, 1, 2, 3, 4, 5, 6, 7, 8];
const MINUTES = [0, 15, 30, 45];
const SCHEDULED_CODE = "6204518837";

type Errors = Partial<Record<"title" | "date" | "time" | "duration" | "passcode", string>>;

function makePasscode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

function whenLabel(date: string, time: string) {
  if (!date || !time) return "Pick a date and time";
  const d = new Date(`${date}T${time}`);
  if (Number.isNaN(d.getTime())) return "Pick a date and time";
  const day = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
  const t = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${day} · ${t}`;
}

export function ScheduleForm() {
  const [title, setTitle] = useState(`${demoUser.name}'s Zoom Meeting`);
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("2026-10-05");
  const [time, setTime] = useState("15:00");
  const [hours, setHours] = useState(1);
  const [minutes, setMinutes] = useState(0);
  const [timezone, setTimezone] = useState("Asia/Kolkata");
  const [access, setAccess] = useState<MeetingAccess>("allow_guests");
  const [usePasscode, setUsePasscode] = useState(true);
  const [passcode, setPasscode] = useState("Zq7mK2");
  const [errors, setErrors] = useState<Errors>({});
  const [saved, setSaved] = useState(false);

  const duration = hours * 60 + minutes;

  function validate(): Errors {
    const next: Errors = {};
    if (!title.trim()) next.title = "Add a topic for the meeting.";
    if (!date) next.date = "Pick a date.";
    if (!time) next.time = "Pick a start time.";
    if (date && time && new Date(`${date}T${time}`).getTime() < Date.now()) {
      next.date = "The start time is in the past.";
    }
    if (duration === 0) next.duration = "The meeting must be at least 15 minutes.";
    if (usePasscode && !/^[A-Za-z0-9]{6,10}$/.test(passcode)) {
      next.passcode = "Use 6 to 10 letters or numbers.";
    }
    return next;
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const next = validate();
    setErrors(next);
    const firstInvalid = (["title", "date", "time", "duration", "passcode"] as const).find((k) => next[k]);
    if (!firstInvalid) {
      setSaved(true);
      return;
    }
    // Move focus to the first field with an error.
    const id = firstInvalid === "duration" ? "duration-h" : firstInvalid;
    document.getElementById(id)?.focus();
  }

  if (saved) {
    return (
      <ScheduledSuccess
        title={title}
        when={whenLabel(date, time)}
        duration={duration}
        access={access}
        passcode={usePasscode ? passcode : null}
        onEdit={() => setSaved(false)}
      />
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <Card className="p-5 md:p-8">
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
          <Field label="Topic" htmlFor="title" error={errors.title}>
            <TextInput
              id="title"
              value={title}
              invalid={Boolean(errors.title)}
              onChange={(e) => setTitle(e.target.value)}
              aria-describedby={errors.title ? "title-error" : undefined}
            />
          </Field>

          <Field label="Description" htmlFor="description" optional hint="Shown in the invite.">
            <TextArea
              id="description"
              value={description}
              placeholder="Add an agenda or notes for attendees"
              onChange={(e) => setDescription(e.target.value)}
            />
          </Field>

          <fieldset className="flex flex-col gap-4">
            <legend className="mb-3 text-sm font-semibold text-ink">When</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Date" htmlFor="date" error={errors.date}>
                <TextInput
                  id="date"
                  type="date"
                  value={date}
                  invalid={Boolean(errors.date)}
                  onChange={(e) => setDate(e.target.value)}
                />
              </Field>
              <Field label="Start time" htmlFor="time" error={errors.time}>
                <TextInput
                  id="time"
                  type="time"
                  step={900}
                  value={time}
                  invalid={Boolean(errors.time)}
                  onChange={(e) => setTime(e.target.value)}
                />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Duration" htmlFor="duration-h" error={errors.duration}>
                <div className="grid grid-cols-2 gap-2">
                  <Select
                    id="duration-h"
                    aria-label="Hours"
                    value={hours}
                    invalid={Boolean(errors.duration)}
                    onChange={(e) => setHours(Number(e.target.value))}
                  >
                    {HOURS.map((h) => (
                      <option key={h} value={h}>
                        {h} hr
                      </option>
                    ))}
                  </Select>
                  <Select
                    aria-label="Minutes"
                    value={minutes}
                    invalid={Boolean(errors.duration)}
                    onChange={(e) => setMinutes(Number(e.target.value))}
                  >
                    {MINUTES.map((m) => (
                      <option key={m} value={m}>
                        {m} min
                      </option>
                    ))}
                  </Select>
                </div>
              </Field>
              <Field label="Time zone" htmlFor="timezone">
                <Select id="timezone" value={timezone} onChange={(e) => setTimezone(e.target.value)}>
                  {TIMEZONES.map((tz) => (
                    <option key={tz.value} value={tz.value}>
                      {tz.label}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          </fieldset>

          <div className="h-px bg-line" />

          <fieldset className="flex flex-col gap-3">
            <legend className="mb-3 text-sm font-semibold text-ink">Who can join</legend>
            <AccessOptions value={access} onChange={setAccess} />
          </fieldset>

          <fieldset className="flex flex-col gap-3">
            <legend className="mb-3 text-sm font-semibold text-ink">Security</legend>
            <div className="flex items-start justify-between gap-4 rounded-xl border border-line p-4">
              <div>
                <label htmlFor="use-passcode" className="text-sm font-medium text-ink">
                  Passcode
                </label>
                <p className="text-xs text-ink-3">Only people with the invite link or passcode can join.</p>
              </div>
              <Switch id="use-passcode" checked={usePasscode} onChange={setUsePasscode} label="Require a passcode" />
            </div>
            {usePasscode ? (
              <Field label="Meeting passcode" htmlFor="passcode" error={errors.passcode} hint="6 to 10 letters or numbers.">
                <div className="flex gap-2">
                  <TextInput
                    id="passcode"
                    value={passcode}
                    maxLength={10}
                    invalid={Boolean(errors.passcode)}
                    onChange={(e) => setPasscode(e.target.value)}
                    className="font-mono tracking-wider"
                  />
                  <Button variant="secondary" onClick={() => setPasscode(makePasscode())} aria-label="Make a new passcode">
                    <RefreshCw className="size-4" />
                    <span className="hidden sm:inline">New</span>
                  </Button>
                </div>
              </Field>
            ) : null}
          </fieldset>

          <div className="flex flex-col-reverse gap-3 border-t border-line pt-6 sm:flex-row sm:justify-end">
            <ButtonLink href="/" variant="secondary">
              Cancel
            </ButtonLink>
            <Button type="submit">Save</Button>
          </div>
        </form>
      </Card>

      <aside className="hidden lg:block">
        <div className="sticky top-[calc(var(--spacing-topbar)+1.75rem)]">
          <SummaryCard
            title={title}
            when={whenLabel(date, time)}
            duration={duration}
            access={access}
            passcode={usePasscode ? passcode : null}
          />
        </div>
      </aside>
    </div>
  );
}

type SummaryProps = {
  title: string;
  when: string;
  duration: number;
  access: MeetingAccess;
  passcode: string | null;
};

function SummaryCard({ title, when, duration, access, passcode }: SummaryProps) {
  return (
    <Card className="overflow-hidden">
      <div className="bg-linear-to-br from-navy to-brand px-5 py-4 text-white">
        <p className="text-xs font-medium text-white/70">Preview</p>
        <p className="mt-1 line-clamp-2 font-semibold">{title || "Untitled meeting"}</p>
      </div>
      <dl className="flex flex-col gap-3 px-5 py-4 text-sm">
        <SummaryRow icon={<CalendarClock className="size-4" />} label="When" value={when} />
        <SummaryRow
          icon={<CalendarPlus className="size-4" />}
          label="Duration"
          value={duration ? formatDuration(duration) : "Not set"}
        />
        <SummaryRow
          icon={access === "verified_only" ? <ShieldCheck className="size-4" /> : <Globe className="size-4" />}
          label="Access"
          value={access === "verified_only" ? "Verified users only" : "Guests allowed"}
        />
        <SummaryRow icon={<Lock className="size-4" />} label="Passcode" value={passcode ? "On" : "Off"} />
      </dl>
    </Card>
  );
}

function SummaryRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 text-ink-3">{icon}</span>
      <div>
        <dt className="text-xs text-ink-3">{label}</dt>
        <dd className="font-medium text-ink">{value}</dd>
      </div>
    </div>
  );
}

function ScheduledSuccess({
  onEdit,
  ...summary
}: SummaryProps & { onEdit: () => void }) {
  const link = `https://zoomclone.dev/j/${SCHEDULED_CODE}`;
  return (
    <Card className="mx-auto max-w-xl animate-pop-in p-6 md:p-8">
      <div className="flex items-center gap-3">
        <CheckCircle2 className="size-8 text-success" />
        <div>
          <h2 className="text-lg font-semibold text-ink">Meeting scheduled</h2>
          <p className="text-sm text-ink-3">We added it to your upcoming meetings.</p>
        </div>
      </div>
      <div className="mt-6 rounded-xl border border-line">
        <div className="border-b border-line px-4 py-3">
          <p className="font-semibold text-ink">{summary.title}</p>
          <p className="text-sm text-ink-3">
            {summary.when} · {formatDuration(summary.duration)}
          </p>
        </div>
        <dl className="grid grid-cols-[7rem_minmax(0,1fr)] gap-y-2 px-4 py-3 text-sm">
          <dt className="text-ink-3">Meeting ID</dt>
          <dd className="font-medium text-ink tabular-nums">{formatMeetingCode(SCHEDULED_CODE)}</dd>
          <dt className="text-ink-3">Passcode</dt>
          <dd className="font-mono text-ink">{summary.passcode ?? "None"}</dd>
          <dt className="text-ink-3">Access</dt>
          <dd className="text-ink">{summary.access === "verified_only" ? "Verified users only" : "Guests allowed"}</dd>
          <dt className="text-ink-3">Invite link</dt>
          <dd className="truncate text-brand">{link}</dd>
        </dl>
      </div>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <CopyButton text={link} label="Copy invite link" display="text" className="sm:flex-1" />
        <Button variant="secondary" onClick={onEdit}>
          Edit
        </Button>
        <ButtonLink href="/" variant="primary">
          Done
        </ButtonLink>
      </div>
      <p className="mt-4 text-center text-xs text-ink-3">
        Mock only. Nothing was saved.{" "}
        <Link href="/" className="focus-ring rounded font-medium text-brand hover:underline">
          Back to home
        </Link>
      </p>
    </Card>
  );
}
