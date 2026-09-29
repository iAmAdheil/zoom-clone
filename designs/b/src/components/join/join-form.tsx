"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { CheckCircle2, Globe, Lock, SearchX, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, TextInput } from "@/components/ui/field";
import { extractMeetingCode, formatMeetingCode } from "@/lib/format";
import { demoUser, findMeetingByCode } from "@/lib/mock";

const CODE_LENGTH = 10;

type Touched = { code?: boolean; name?: boolean; passcode?: boolean };

export function JoinForm({ initialCode = "" }: { initialCode?: string }) {
  const router = useRouter();
  const [codeInput, setCodeInput] = useState(initialCode ? formatMeetingCode(initialCode) : "");
  const [name, setName] = useState(demoUser.name);
  const [passcode, setPasscode] = useState("");
  const [noAudio, setNoAudio] = useState(false);
  const [noVideo, setNoVideo] = useState(false);
  const [touched, setTouched] = useState<Touched>({});
  const [submitting, setSubmitting] = useState(false);

  const digits = extractMeetingCode(codeInput);
  const complete = digits.length === CODE_LENGTH;
  const meeting = complete ? findMeetingByCode(digits) : undefined;
  const needsPasscode = Boolean(meeting?.passcode);

  const codeError = !touched.code
    ? null
    : digits.length === 0
      ? "Enter a meeting ID or an invite link."
      : !complete
        ? "A meeting ID has 10 digits."
        : null;
  const nameError = touched.name && name.trim().length === 0 ? "Enter the name others will see." : null;
  const passcodeError =
    touched.passcode && needsPasscode && passcode.trim().length === 0 ? "This meeting needs a passcode." : null;

  const canSubmit = Boolean(meeting) && name.trim().length > 0 && (!needsPasscode || passcode.trim().length > 0);

  function onCodeChange(value: string) {
    // Keep links as typed. Group plain digits like Zoom does.
    setCodeInput(/[a-z/]/i.test(value) ? value : formatMeetingCode(value));
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setTouched({ code: true, name: true, passcode: true });
    if (!canSubmit || !meeting) return;
    setSubmitting(true);
    const params = new URLSearchParams();
    if (noAudio) params.set("mic", "off");
    if (noVideo) params.set("cam", "off");
    const query = params.toString();
    router.push(`/meeting/${meeting.meeting_code}${query ? `?${query}` : ""}`);
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      <Field
        label="Meeting ID or invite link"
        htmlFor="code"
        error={codeError}
        hint="Example: 841 209 3375 or https://zoomclone.dev/j/8412093375"
      >
        <TextInput
          id="code"
          name="code"
          inputMode="text"
          autoComplete="off"
          autoFocus={!initialCode}
          placeholder="Enter meeting ID or link"
          value={codeInput}
          invalid={Boolean(codeError)}
          aria-describedby={codeError ? "code-error" : "code-hint"}
          onChange={(e) => onCodeChange(e.target.value)}
          onBlur={() => setTouched((t) => ({ ...t, code: true }))}
          className="h-12 text-base tracking-wide"
        />
      </Field>

      {meeting ? (
        <div className="flex animate-pop-in items-start gap-3 rounded-xl border border-success/30 bg-success-soft px-4 py-3">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" />
          <div className="min-w-0 text-sm">
            <p className="truncate font-semibold text-ink">{meeting.title}</p>
            <p className="text-ink-2">Hosted by {meeting.host.name}</p>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-2">
              <span className="inline-flex items-center gap-1">
                {meeting.access === "verified_only" ? (
                  <>
                    <ShieldCheck className="size-3.5" /> Signed-in users only
                  </>
                ) : (
                  <>
                    <Globe className="size-3.5" /> Guests can join
                  </>
                )}
              </span>
              {meeting.passcode ? (
                <span className="inline-flex items-center gap-1">
                  <Lock className="size-3.5" /> Passcode required
                </span>
              ) : null}
            </p>
          </div>
        </div>
      ) : complete ? (
        <div className="flex items-center gap-3 rounded-xl border border-line bg-surface-2 px-4 py-3 text-sm text-ink-2">
          <SearchX className="size-5 shrink-0 text-ink-3" />
          No meeting uses this ID. Try the demo ID 841 209 3375.
        </div>
      ) : null}

      <Field label="Your name" htmlFor="name" error={nameError} hint="Others see this name in the meeting.">
        <TextInput
          id="name"
          name="name"
          autoComplete="name"
          value={name}
          invalid={Boolean(nameError)}
          aria-describedby={nameError ? "name-error" : "name-hint"}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => setTouched((t) => ({ ...t, name: true }))}
        />
      </Field>

      <Field
        label="Meeting passcode"
        htmlFor="passcode"
        optional={!needsPasscode}
        error={passcodeError}
        hint={needsPasscode ? "The host shared the passcode with the invite." : "Only if the host set one."}
      >
        <TextInput
          id="passcode"
          name="passcode"
          type="password"
          autoComplete="off"
          placeholder={needsPasscode ? "Enter passcode" : "No passcode needed"}
          value={passcode}
          invalid={Boolean(passcodeError)}
          aria-describedby={passcodeError ? "passcode-error" : "passcode-hint"}
          onChange={(e) => setPasscode(e.target.value)}
          onBlur={() => setTouched((t) => ({ ...t, passcode: true }))}
        />
      </Field>

      <fieldset className="flex flex-col gap-3 rounded-xl bg-surface-2 p-4">
        <legend className="sr-only">Join options</legend>
        <Checkbox
          id="no-audio"
          label="Don't connect to audio"
          checked={noAudio}
          onChange={(e) => setNoAudio(e.target.checked)}
        />
        <Checkbox
          id="no-video"
          label="Turn off my video"
          checked={noVideo}
          onChange={(e) => setNoVideo(e.target.checked)}
        />
      </fieldset>

      <Button type="submit" size="lg" disabled={submitting} className="w-full">
        {submitting ? "Joining…" : "Join"}
      </Button>
    </form>
  );
}
