"use client";

import { useRouter } from "next/navigation";
import { useLayoutEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Check, Field, TextInput } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { ApiError, api } from "@/lib/api";
import { formatMeetingCode } from "@/lib/format";
import { parseJoinInput } from "@/lib/inviteLink";
import { useMe, useMeetingLookup } from "@/lib/queries";
import { rememberedName } from "@/lib/storage";
import type { MeetingLookup } from "@/lib/types";
import { useJoinMeeting } from "@/lib/useJoinMeeting";
import { JoinAlert, describeJoinError } from "./joinErrors";

type Errors = { code?: string; name?: string; passcode?: string; form?: string };

type JoinFormProps = { initialCode?: string; initialPasscode?: string };

export function JoinForm({ initialCode = "", initialPasscode = "" }: JoinFormProps) {
  const router = useRouter();
  const { data: me, isLoading: meLoading } = useMe();
  const [codeInput, setCodeInput] = useState(initialCode ? formatMeetingCode(initialCode) : "");
  // The name field state is the one source of truth: the field shows it, and Join reads it.
  const [name, setName] = useState("");
  const nameTouched = useRef(false);
  const [passcode, setPasscode] = useState(initialPasscode);
  const [remember, setRemember] = useState(true);
  const [errors, setErrors] = useState<Errors>({});
  const [navigating, setNavigating] = useState(false);
  const joiner = useJoinMeeting();


  // Prefill before the browser paints: the signed-in user first, then the remembered name.
  // The server render has no user and no localStorage, so the first render has "". A layout
  // effect runs before the first paint, so the field never shows empty and then filled.
  // Once the user types, we do not replace the text.
  useLayoutEffect(() => {
    if (nameTouched.current) return;
    const prefill = me?.name || rememberedName.read();
    setName(prefill);
  }, [me?.name]);

  const code = parseJoinInput(codeInput).code;
  // GET /api/meetings/{code} runs as soon as the ID has 10 digits.
  const lookup = useMeetingLookup(code.length === 10 ? code : null);
  const meeting = lookup.data;
  const notFound = lookup.error instanceof ApiError && lookup.error.status === 404;
  const busy = joiner.pending || navigating;

  async function validate(): Promise<MeetingLookup | null> {
    try {
      return meeting ?? (await api.lookup(code));
    } catch (caught) {
      const notFoundNow = caught instanceof ApiError && caught.status === 404;
      setErrors({
        code: notFoundNow ? "This meeting ID is not valid. Check it and try again." : undefined,
        form: notFoundNow ? undefined : caught instanceof ApiError ? caught.message : "Try again.",
      });
      return null;
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const next: Errors = {};
    if (code.length !== 10) next.code = "Enter a valid 10-digit meeting ID or an invite link.";
    if (!name.trim()) next.name = "Enter your name.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    // 1. Check that the meeting exists and is not over.
    const info = await validate();
    if (!info) return;
    if (info.status === "ended") {
      setErrors({ form: "This meeting has ended." });
      return;
    }

    // 2. Join. The server checks access, passcode and removal.
    const { error } = await joiner.join(code, { displayName: name, passcode });
    if (error) return;
    if (remember) rememberedName.write(name);
    setNavigating(true);
    router.push(`/meeting/${code}`);
  }

  // Errors from the join call, shown next to the field they are about.
  const joinError = joiner.error ? describeJoinError(joiner.error, passcode.trim() !== "") : null;
  const codeError = errors.code ?? (joinError?.field === "code" ? joinError.message : undefined);
  const passcodeError = errors.passcode ?? (joinError?.field === "passcode" ? joinError.message : undefined);
  const formError = errors.form ?? (joinError?.field === "form" ? joinError.message : undefined);
  const needsPasscode = meeting?.requires_passcode ?? true;

  return (
    <form onSubmit={onSubmit} noValidate className="flex w-full max-w-md flex-col gap-5">
      <h1 className="text-center text-2xl font-bold text-ink">Join Meeting</h1>

      <Field
        id="code"
        label="Meeting ID or invite link"
        error={codeError ?? (notFound ? "No meeting has this ID. Check it and try again." : undefined)}
        hint="Example: 812 345 6790 or an invite link that ends in /j/8123456790"
      >
        <TextInput
          id="code"
          inputMode="text"
          autoComplete="off"
          placeholder="Meeting ID or invite link"
          value={codeInput}
          onChange={(e) => {
            // A pasted invite link gives the code and the passcode. Show only the code.
            const parsed = parseJoinInput(e.target.value);
            if (parsed.isLink) {
              setCodeInput(formatMeetingCode(parsed.code));
              if (parsed.passcode) setPasscode(parsed.passcode);
            } else {
              setCodeInput(e.target.value);
            }
            setErrors({});
            joiner.clearError();
          }}
          aria-invalid={codeError || notFound ? true : undefined}
          aria-describedby="code-msg"
          className="h-12 text-base"
        />
      </Field>

      {meeting ? (
        <div className="flex items-start gap-3 rounded-lg border border-line bg-surface-muted p-3">
          <span className="mt-0.5 rounded-md bg-primary-soft p-1.5 text-primary">
            <Icon name={meeting.access === "verified_only" ? "lock" : "video"} size={18} />
          </span>
          <div className="min-w-0 text-sm">
            <p className="truncate font-bold text-ink">{meeting.title}</p>
            <p className="text-xs text-ink-muted">
              Host: {meeting.host_name} ·{" "}
              {meeting.access === "allow_guests" ? "Guests can join" : "Signed-in users only"}
              {meeting.status === "live" ? " · In progress" : meeting.status === "ended" ? " · Ended" : null}
            </p>
          </div>
        </div>
      ) : null}

      <Field id="name" label="Your name" error={errors.name}>
        <TextInput
          id="name"
          autoComplete="name"
          maxLength={64}
          value={name}
          onChange={(e) => {
            nameTouched.current = true;
            setName(e.target.value);
            setErrors((prev) => ({ ...prev, name: undefined }));
          }}
          aria-invalid={errors.name ? true : undefined}
          aria-describedby={errors.name ? "name-msg" : undefined}
        />
      </Field>

      <Field
        id="passcode"
        label="Meeting passcode"
        error={passcodeError}
        hint={
          meeting
            ? needsPasscode
              ? "The host set a passcode for this meeting."
              : "No passcode needed."
            : "Leave empty if the meeting has none."
        }
      >
        <TextInput
          id="passcode"
          type="password"
          autoComplete="off"
          value={passcode}
          disabled={!needsPasscode}
          onChange={(e) => {
            setPasscode(e.target.value);
            joiner.clearError();
          }}
          aria-invalid={passcodeError ? true : undefined}
          aria-describedby="passcode-msg"
        />
      </Field>

      <Check
        id="remember"
        label="Remember my name for future meetings"
        checked={remember}
        onChange={(e) => setRemember(e.target.checked)}
      />

      {formError ? (
        <JoinAlert message={formError} signInNext={joinError?.needsSignIn ? `/j/${code}` : undefined} />
      ) : null}

      <Button type="submit" size="lg" block disabled={!codeInput.trim() || busy || meLoading}>
        {busy ? "Joining..." : "Join"}
      </Button>

      <p className="text-center text-xs text-ink-muted">
        By clicking Join, you agree to the Terms of Service and Privacy Statement.
      </p>
    </form>
  );
}
