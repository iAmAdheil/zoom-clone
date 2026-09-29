"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Check, Field, TextInput } from "@/components/ui/Field";
import { GoogleMark, Icon } from "@/components/ui/Icon";

type Pending = "google" | "demo" | null;

/** Sign in card: email step (inactive in the mockup), Google, and the demo user button. */
export function SignInForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | undefined>();
  const [pending, setPending] = useState<Pending>(null);

  function goHome(kind: Exclude<Pending, null>) {
    setPending(kind);
    // Mock of GET /api/auth/google/login or POST /api/auth/demo.
    setTimeout(() => router.push("/"), 400);
  }

  function onEmailSubmit(e: FormEvent) {
    e.preventDefault();
    setEmailError(
      email.includes("@")
        ? "Email sign in is not available. Use Google or the demo user."
        : "Enter a valid email address.",
    );
  }

  return (
    <div className="w-full max-w-sm">
      <h1 className="text-center text-2xl font-bold text-ink">Sign in</h1>

      <form onSubmit={onEmailSubmit} noValidate className="mt-8 flex flex-col gap-4">
        <Field id="email" label="Email address" error={emailError}>
          <TextInput
            id="email"
            type="email"
            autoComplete="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setEmailError(undefined);
            }}
            aria-invalid={emailError ? true : undefined}
            aria-describedby={emailError ? "email-msg" : undefined}
          />
        </Field>
        <Button type="submit" size="lg" block disabled={!email}>
          Next
        </Button>
        <Check id="stay" label="Stay signed in" defaultChecked />
      </form>

      <div className="my-6 flex items-center gap-3 text-xs text-ink-muted" role="separator">
        <span className="h-px flex-1 bg-line" />
        or sign in with
        <span className="h-px flex-1 bg-line" />
      </div>

      <div className="flex flex-col gap-3">
        <Button
          variant="secondary"
          size="lg"
          block
          disabled={pending !== null}
          onClick={() => goHome("google")}
        >
          <GoogleMark />
          {pending === "google" ? "Redirecting to Google..." : "Continue with Google"}
        </Button>
        <Button
          variant="ghost"
          size="lg"
          block
          disabled={pending !== null}
          onClick={() => goHome("demo")}
          className="border border-dashed border-line-strong"
        >
          <Icon name="user" size={18} />
          {pending === "demo" ? "Signing in..." : "Continue as demo user"}
        </Button>
      </div>

      <p className="mt-8 text-center text-xs leading-5 text-ink-muted">
        By signing in, I agree to the Privacy Statement and Terms of Service.
        <br />
        The demo user sees mock meetings only.
      </p>
    </div>
  );
}
