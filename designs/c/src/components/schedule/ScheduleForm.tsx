"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { formatDuration, formatMeetingCode, inviteLink } from "@/lib/format";
import type { MeetingAccess } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { CopyButton } from "@/components/ui/CopyButton";
import { Checkbox, Field, Select, TextArea, TextInput } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { RadioCard } from "@/components/ui/RadioCard";
import { AccessBadge } from "@/components/dashboard/AccessBadge";

const TIMEZONES = [
  { value: "Asia/Kolkata", label: "(GMT+5:30) India Standard Time" },
  { value: "Europe/London", label: "(GMT+1:00) London" },
  { value: "America/New_York", label: "(GMT-4:00) Eastern Time (US and Canada)" },
  { value: "America/Los_Angeles", label: "(GMT-7:00) Pacific Time (US and Canada)" },
  { value: "UTC", label: "(GMT+0:00) UTC" },
];

// Fixed values, so the mock always renders the same.
const NEW_CODE = "5068823417";
const SUGGESTED_PASSCODE = "Zm93Qk";

type Form = {
  title: string;
  description: string;
  date: string;
  time: string;
  hours: string;
  minutes: string;
  timezone: string;
  access: MeetingAccess;
  usePasscode: boolean;
  passcode: string;
};

type Errors = Partial<Record<"title" | "date" | "time" | "duration" | "passcode", string>>;

const initialForm: Form = {
  title: "",
  description: "",
  date: "2026-10-01",
  time: "15:00",
  hours: "0",
  minutes: "30",
  timezone: "Asia/Kolkata",
  access: "allow_guests",
  usePasscode: true,
  passcode: SUGGESTED_PASSCODE,
};

function validate(f: Form): Errors {
  const e: Errors = {};
  if (!f.title.trim()) e.title = "Add a topic so people know what the meeting is about.";
  if (!f.date) e.date = "Pick a date.";
  if (!f.time) e.time = "Pick a start time.";
  if (Number(f.hours) === 0 && Number(f.minutes) === 0)
    e.duration = "The meeting must be at least 15 minutes.";
  if (f.usePasscode && !/^[A-Za-z0-9]{6,10}$/.test(f.passcode))
    e.passcode = "Use 6 to 10 letters or numbers.";
  return e;
}

export function ScheduleForm() {
  const [form, setForm] = useState<Form>(initialForm);
  const [errors, setErrors] = useState<Errors>({});
  const [saved, setSaved] = useState(false);

  function set<K extends keyof Form>(key: K, value: Form[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    if (key in errors) setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const next = validate(form);
    setErrors(next);
    if (Object.values(next).some(Boolean)) return;
    setSaved(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (saved) return <Saved form={form} onEdit={() => setSaved(false)} />;

  const durationMin = Number(form.hours) * 60 + Number(form.minutes);

  return (
    <Card className="p-5 md:p-8">
      <form onSubmit={onSubmit} noValidate className="grid gap-6">
        <Field id="title" label="Topic" layout="row" error={errors.title}>
          <TextInput
            id="title"
            placeholder="My meeting"
            value={form.title}
            invalid={!!errors.title}
            aria-describedby={errors.title ? "title-error" : undefined}
            onChange={(e) => set("title", e.target.value)}
          />
        </Field>

        <Field id="description" label="Description" layout="row" optional>
          <TextArea
            id="description"
            placeholder="Agenda, links, notes"
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
          />
        </Field>

        <div className="grid gap-1.5 md:grid-cols-[var(--spacing-label)_minmax(0,1fr)] md:gap-6">
          <span className="text-sm font-medium text-ink-2 md:pt-2.5" id="when-label">
            When
          </span>
          <div className="grid gap-3" role="group" aria-labelledby="when-label">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <label htmlFor="date" className="sr-only">
                  Date
                </label>
                <TextInput
                  id="date"
                  type="date"
                  leadingIcon="calendar"
                  value={form.date}
                  invalid={!!errors.date}
                  onChange={(e) => set("date", e.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <label htmlFor="time" className="sr-only">
                  Start time
                </label>
                <TextInput
                  id="time"
                  type="time"
                  step={900}
                  leadingIcon="clock"
                  value={form.time}
                  invalid={!!errors.time}
                  onChange={(e) => set("time", e.target.value)}
                />
              </div>
            </div>
            <label htmlFor="timezone" className="sr-only">
              Time zone
            </label>
            <Select id="timezone" value={form.timezone} onChange={(e) => set("timezone", e.target.value)}>
              {TIMEZONES.map((tz) => (
                <option key={tz.value} value={tz.value}>
                  {tz.label}
                </option>
              ))}
            </Select>
            {(errors.date || errors.time) && (
              <p className="text-xs text-danger" role="alert">
                {errors.date ?? errors.time}
              </p>
            )}
          </div>
        </div>

        <div className="grid gap-1.5 md:grid-cols-[var(--spacing-label)_minmax(0,1fr)] md:gap-6">
          <span className="text-sm font-medium text-ink-2 md:pt-2.5" id="duration-label">
            Duration
          </span>
          <div className="grid gap-1.5">
            <div className="flex items-center gap-2" role="group" aria-labelledby="duration-label">
              <label htmlFor="hours" className="sr-only">
                Hours
              </label>
              <Select
                id="hours"
                value={form.hours}
                onChange={(e) => set("hours", e.target.value)}
                className="w-20"
              >
                {Array.from({ length: 9 }, (_, i) => (
                  <option key={i} value={i}>
                    {i}
                  </option>
                ))}
              </Select>
              <span className="text-sm text-ink-muted">hr</span>
              <label htmlFor="minutes" className="sr-only">
                Minutes
              </label>
              <Select
                id="minutes"
                value={form.minutes}
                onChange={(e) => set("minutes", e.target.value)}
                className="w-20"
              >
                {[0, 15, 30, 45].map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </Select>
              <span className="text-sm text-ink-muted">min</span>
            </div>
            {errors.duration ? (
              <p className="text-xs text-danger" role="alert">
                {errors.duration}
              </p>
            ) : (
              <p className="text-xs text-ink-muted">
                {durationMin > 0 && `Ends after ${formatDuration(durationMin)}.`}
              </p>
            )}
          </div>
        </div>

        <div className="border-t border-line" />

        <div className="grid gap-1.5 md:grid-cols-[var(--spacing-label)_minmax(0,1fr)] md:gap-6">
          <span id="access-label" className="text-sm font-medium text-ink-2 md:pt-2.5">
            Who can join
          </span>
          <div role="radiogroup" aria-labelledby="access-label" className="grid gap-3 sm:grid-cols-2">
            <RadioCard
              name="access"
              value="verified_only"
              checked={form.access === "verified_only"}
              onChange={(v) => set("access", v as MeetingAccess)}
              icon="lock"
              title="Signed-in users only"
              description="People must sign in before they join."
            />
            <RadioCard
              name="access"
              value="allow_guests"
              checked={form.access === "allow_guests"}
              onChange={(v) => set("access", v as MeetingAccess)}
              icon="globe"
              title="Allow guests"
              description="Anyone with the link can join with a name."
            />
          </div>
        </div>

        <div className="grid gap-1.5 md:grid-cols-[var(--spacing-label)_minmax(0,1fr)] md:gap-6">
          <span className="text-sm font-medium text-ink-2 md:pt-0.5">Security</span>
          <div className="grid gap-3">
            <Checkbox
              id="use-passcode"
              checked={form.usePasscode}
              onChange={(e) => set("usePasscode", e.target.checked)}
              label="Passcode"
              description="Only people with the invite link or passcode can join."
            />
            {form.usePasscode && (
              <div className="grid max-w-xs gap-1.5 pl-7">
                <label htmlFor="passcode" className="sr-only">
                  Passcode
                </label>
                <TextInput
                  id="passcode"
                  value={form.passcode}
                  invalid={!!errors.passcode}
                  aria-describedby={errors.passcode ? "passcode-error" : undefined}
                  onChange={(e) => set("passcode", e.target.value)}
                  className="font-mono tracking-wider"
                />
                {errors.passcode && (
                  <p id="passcode-error" className="text-xs text-danger" role="alert">
                    {errors.passcode}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-line pt-6 sm:flex-row sm:justify-end">
          <Button href="/" variant="secondary">
            Cancel
          </Button>
          <Button type="submit" className="sm:min-w-32">
            Save
          </Button>
        </div>
      </form>
    </Card>
  );
}

function Saved({ form, onEdit }: { form: Form; onEdit: () => void }) {
  const link = inviteLink(NEW_CODE);
  const when = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(new Date(`${form.date}T${form.time}:00Z`));
  const rows: [string, ReactNode][] = [
    ["Topic", form.title],
    ["When", when],
    ["Duration", formatDuration(Number(form.hours) * 60 + Number(form.minutes))],
    ["Meeting ID", formatMeetingCode(NEW_CODE)],
    ["Access", <AccessBadge key="a" access={form.access} />],
    ["Passcode", form.usePasscode ? <span className="font-mono">{form.passcode}</span> : "None"],
  ];

  return (
    <Card className="overflow-hidden animate-pop-in">
      <div className="flex items-center gap-3 border-b border-line bg-success-soft px-5 py-4 md:px-8">
        <span className="flex size-9 items-center justify-center rounded-full bg-success text-white">
          <Icon name="check" size={18} strokeWidth={2.4} />
        </span>
        <div>
          <p className="text-sm font-semibold text-ink">Meeting scheduled</p>
          <p className="text-xs text-ink-2">Share the link with the people you invite.</p>
        </div>
      </div>
      <dl className="grid gap-4 px-5 py-6 md:px-8">
        {rows.map(([k, v]) => (
          <div key={k} className="grid gap-1 sm:grid-cols-[var(--spacing-label)_minmax(0,1fr)] sm:gap-6">
            <dt className="text-sm text-ink-muted">{k}</dt>
            <dd className="text-sm font-medium text-ink">{v}</dd>
          </div>
        ))}
        <div className="grid gap-1 sm:grid-cols-[var(--spacing-label)_minmax(0,1fr)] sm:gap-6">
          <dt className="text-sm text-ink-muted">Invite link</dt>
          <dd className="flex min-w-0 flex-wrap items-center gap-2">
            <code className="min-w-0 truncate rounded-sm bg-surface-sunken px-2 py-1 text-xs text-ink-2">
              {link}
            </code>
            <CopyButton text={link} />
          </dd>
        </div>
      </dl>
      <div className="flex flex-col-reverse gap-3 border-t border-line px-5 py-4 sm:flex-row sm:justify-end md:px-8">
        <Button variant="ghost" onClick={onEdit}>
          Edit
        </Button>
        <Button href="/" variant="secondary">
          Back to home
        </Button>
        <Button href={`/meeting/${NEW_CODE}`}>Start now</Button>
      </div>
    </Card>
  );
}
