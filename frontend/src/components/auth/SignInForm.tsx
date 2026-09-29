"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { mutate } from "swr";
import { Button } from "@/components/ui/Button";
import { Check, Field, TextInput } from "@/components/ui/Field";
import { GoogleMark, Icon } from "@/components/ui/Icon";
import { ApiError, api, errorMessage } from "@/lib/api";
import { keys } from "@/lib/queries";

type Pending = "google" | "demo" | null;

/** Sign in card: email step (not available), Google, and the demo user button. */
export function SignInForm({ next }: { next: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | undefined>();
  const [pending, setPending] = useState<Pending>(null);
  const [error, setError] = useState<string | null>(null);

  async function continueWithGoogle() {
    setPending("google");
    setError(null);
    const url = api.googleLoginUrl(next);
    // Check first that Google sign-in is set up. A working route answers with a redirect
    // (opaque here), a missing setup answers 503 with a JSON error.
    try {
      const check = await fetch(url, { redirect: "manual", credentials: "include" });
      if (check.type !== "opaqueredirect" && !check.ok) {
        const body = await check.json().catch(() => null);
        setError(body?.detail ?? "Google sign-in is not available now.");
        setPending(null);
        return;
      }
    } catch {
      // The check failed (for example, offline). Let the browser try the real redirect.
    }
    window.location.assign(url);
  }

  async function continueAsDemo() {
    setPending("demo");
    setError(null);
    try {
      const user = await api.demoLogin();
      await mutate(keys.me, user, { revalidate: false });
      router.replace(next);
    } catch (caught) {
      setError(
        caught instanceof ApiError && caught.code === "demo_disabled"
          ? "The demo user is turned off on this server."
          : errorMessage(caught),
      );
      setPending(null);
    }
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

      {error ? (
        <p role="alert" className="mb-4 flex items-center gap-1.5 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
          <Icon name="alert" size={16} />
          {error}
        </p>
      ) : null}

      <div className="flex flex-col gap-3">
        <Button variant="secondary" size="lg" block disabled={pending !== null} onClick={continueWithGoogle}>
          <GoogleMark />
          {pending === "google" ? "Redirecting to Google..." : "Continue with Google"}
        </Button>
        <Button
          variant="ghost"
          size="lg"
          block
          disabled={pending !== null}
          onClick={continueAsDemo}
          className="border border-dashed border-line-strong"
        >
          <Icon name="user" size={18} />
          {pending === "demo" ? "Signing in..." : "Continue as demo user"}
        </Button>
      </div>

      <p className="mt-8 text-center text-xs leading-5 text-ink-muted">
        By signing in, I agree to the Privacy Statement and Terms of Service.
        <br />
        The demo user needs no Google account.
      </p>
    </div>
  );
}
