"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Check, Field, TextInput } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { formatMeetingCode } from "@/lib/format";
import { findMeeting } from "@/lib/mock";

type Errors = { code?: string; name?: string; passcode?: string };

/** Pulls the 10-digit code out of a pasted ID or invite link. */
function parseCode(input: string): string {
  const fromLink = input.match(/\/j\/(\d{9,11})/);
  if (fromLink) return fromLink[1];
  return input.replace(/\D/g, "");
}

type JoinFormProps = { initialCode?: string; defaultName: string };

export function JoinForm({ initialCode = "", defaultName }: JoinFormProps) {
  const router = useRouter();
  const [codeInput, setCodeInput] = useState(initialCode ? formatMeetingCode(initialCode) : "");
  const [name, setName] = useState(defaultName);
  const [passcode, setPasscode] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [pending, setPending] = useState(false);

  const code = parseCode(codeInput);
  // Mock of GET /api/meetings/{code}: runs as soon as the ID has 10 digits.
  const meeting = code.length === 10 ? findMeeting(code) : undefined;
  const needsPasscode = Boolean(meeting?.passcode);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const next: Errors = {};
    if (code.length < 9 || code.length > 11) next.code = "Enter a valid meeting ID (9 to 11 digits) or invite link.";
    else if (!meeting) next.code = "This meeting ID is not valid. Check it and try again.";
    if (!name.trim()) next.name = "Enter your name.";
    if (meeting && needsPasscode && passcode !== meeting.passcode)
      next.passcode = passcode ? "Wrong passcode. Try again." : "This meeting needs a passcode.";
    setErrors(next);
    if (Object.keys(next).length > 0 || !meeting) return;

    setPending(true);
    router.push(`/meeting/${meeting.meeting_code}?name=${encodeURIComponent(name.trim())}`);
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex w-full max-w-md flex-col gap-5">
      <h1 className="text-center text-2xl font-bold text-ink">Join Meeting</h1>

      <Field
        id="code"
        label="Meeting ID or invite link"
        error={errors.code}
        hint="Example: 812 345 6790 or zoomclone.dev/j/8123456790"
      >
        <TextInput
          id="code"
          inputMode="text"
          autoComplete="off"
          placeholder="Meeting ID or invite link"
          value={codeInput}
          onChange={(e) => {
            setCodeInput(e.target.value);
            setErrors((prev) => ({ ...prev, code: undefined }));
          }}
          aria-invalid={errors.code ? true : undefined}
          aria-describedby="code-msg"
          className="h-12 text-base"
        />
      </Field>

      {meeting ? (
        <div className="flex items-start gap-3 rounded-lg border border-line bg-surface-muted p-3">
          <span className="mt-0.5 rounded-md bg-primary-soft p-1.5 text-primary">
            <Icon name="video" size={18} />
          </span>
          <div className="min-w-0 text-sm">
            <p className="truncate font-bold text-ink">{meeting.title}</p>
            <p className="text-xs text-ink-muted">
              Host: {meeting.host.name} · {meeting.access === "allow_guests" ? "Guests can join" : "Signed-in users only"}
            </p>
          </div>
        </div>
      ) : null}

      <Field id="name" label="Your name" error={errors.name}>
        <TextInput
          id="name"
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-invalid={errors.name ? true : undefined}
          aria-describedby={errors.name ? "name-msg" : undefined}
        />
      </Field>

      <Field
        id="passcode"
        label="Meeting passcode"
        error={errors.passcode}
        hint={meeting ? (needsPasscode ? "The host set a passcode for this meeting." : "No passcode needed.") : "Leave empty if the meeting has none."}
      >
        <TextInput
          id="passcode"
          type="password"
          autoComplete="off"
          value={passcode}
          disabled={Boolean(meeting) && !needsPasscode}
          onChange={(e) => {
            setPasscode(e.target.value);
            setErrors((prev) => ({ ...prev, passcode: undefined }));
          }}
          aria-invalid={errors.passcode ? true : undefined}
          aria-describedby="passcode-msg"
        />
      </Field>

      <Check id="remember" label="Remember my name for future meetings" defaultChecked />

      <Button type="submit" size="lg" block disabled={!codeInput.trim() || pending}>
        {pending ? "Joining..." : "Join"}
      </Button>

      <p className="text-center text-xs text-ink-muted">
        By clicking Join, you agree to the Terms of Service and Privacy Statement.
      </p>
    </form>
  );
}
