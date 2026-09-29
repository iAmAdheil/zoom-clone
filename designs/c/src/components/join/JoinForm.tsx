"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { formatMeetingCode, parseMeetingInput } from "@/lib/format";
import { demoUser, lookupMeeting } from "@/lib/mock";
import { Button } from "@/components/ui/Button";
import { Checkbox, Field, TextInput } from "@/components/ui/Field";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { AccessBadge } from "@/components/dashboard/AccessBadge";

type Errors = Partial<Record<"code" | "name" | "passcode", string>>;

/**
 * Join form: meeting ID or link, display name, passcode.
 * The lookup card copies GET /api/meetings/{code} with mock data.
 */
export function JoinForm({ initialCode = "" }: { initialCode?: string }) {
  const router = useRouter();
  const [raw, setRaw] = useState(initialCode ? formatMeetingCode(initialCode) : "");
  const [name, setName] = useState(demoUser.name);
  const [passcode, setPasscode] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);

  const code = parseMeetingInput(raw);
  const meeting = code ? lookupMeeting(code) : null;
  const needsPasscode = meeting?.requires_passcode ?? false;

  function validate(): Errors {
    const next: Errors = {};
    if (!code) next.code = "Enter a 10-digit meeting ID or an invite link.";
    else if (!meeting) next.code = "We can't find this meeting. Check the ID.";
    else if (meeting.status === "ended") next.code = "This meeting has ended.";
    if (!name.trim()) next.name = "Enter the name others will see.";
    if (needsPasscode && !passcode.trim()) next.passcode = "This meeting needs a passcode.";
    return next;
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const next = validate();
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    setSubmitting(true);
    setTimeout(() => router.push(`/meeting/${code}`), 500);
  }

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-5">
      <Field
        id="meeting-code"
        label="Meeting ID or invite link"
        error={errors.code}
        hint="Example: 812 345 6789"
      >
        <TextInput
          id="meeting-code"
          leadingIcon="link"
          inputMode="text"
          autoComplete="off"
          placeholder="Meeting ID or link"
          value={raw}
          invalid={!!errors.code}
          aria-describedby={errors.code ? "meeting-code-error" : "meeting-code-hint"}
          onChange={(e) => {
            setRaw(e.target.value);
            if (errors.code) setErrors((prev) => ({ ...prev, code: undefined }));
          }}
        />
      </Field>

      {meeting && (
        <div
          className="flex items-start gap-3 rounded-lg border border-line bg-canvas p-4 animate-pop-in"
          aria-live="polite"
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-brand text-on-brand">
            <Icon name="video" size={20} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-ink">{meeting.title}</p>
            <p className="text-xs text-ink-muted">Host: {meeting.host_name}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <AccessBadge access={meeting.access} />
              {meeting.status === "live" && (
                <Badge tone="danger">
                  <span className="size-1.5 rounded-full bg-danger" aria-hidden="true" /> Live now
                </Badge>
              )}
              {meeting.requires_passcode && (
                <Badge tone="warning" icon="lock">
                  Passcode needed
                </Badge>
              )}
            </div>
          </div>
        </div>
      )}

      <Field
        id="display-name"
        label="Your name"
        error={errors.name}
        hint="Others in the meeting see this name."
      >
        <TextInput
          id="display-name"
          autoComplete="name"
          value={name}
          invalid={!!errors.name}
          aria-describedby={errors.name ? "display-name-error" : "display-name-hint"}
          onChange={(e) => setName(e.target.value)}
        />
      </Field>

      <Field
        id="passcode"
        label="Passcode"
        optional={!needsPasscode}
        error={errors.passcode}
        hint={needsPasscode ? "The host shared it with the invite." : "Only if the host set one."}
      >
        <TextInput
          id="passcode"
          type="password"
          leadingIcon="lock"
          autoComplete="off"
          value={passcode}
          invalid={!!errors.passcode}
          aria-describedby={errors.passcode ? "passcode-error" : "passcode-hint"}
          onChange={(e) => setPasscode(e.target.value)}
        />
      </Field>

      <fieldset className="grid gap-3 border-t border-line pt-5">
        <legend className="sr-only">Join options</legend>
        <Checkbox id="no-audio" label="Don't connect to audio" />
        <Checkbox id="video-off" label="Turn off my video" />
      </fieldset>

      <div className="flex flex-col-reverse gap-3 pt-1 sm:flex-row sm:justify-end">
        <Button href="/" variant="secondary">
          Cancel
        </Button>
        <Button type="submit" disabled={submitting} className="sm:min-w-32">
          {submitting ? "Joining…" : "Join"}
        </Button>
      </div>
    </form>
  );
}
