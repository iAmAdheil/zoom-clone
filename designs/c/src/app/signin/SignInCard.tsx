"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, buttonClass } from "@/components/ui/Button";
import { GoogleMark } from "@/components/ui/GoogleMark";
import { Icon } from "@/components/ui/Icon";

type Pending = "google" | "demo" | null;

/**
 * Both buttons fake a short request, then go to the dashboard.
 * The real app calls GET /api/auth/google/login or POST /api/auth/demo.
 */
export function SignInCard() {
  const router = useRouter();
  const [pending, setPending] = useState<Pending>(null);

  function signIn(kind: Exclude<Pending, null>) {
    setPending(kind);
    setTimeout(() => router.push("/"), 700);
  }

  return (
    <div className="w-full max-w-sm">
      <h1 className="text-2xl font-semibold tracking-tight text-ink">Sign in</h1>
      <p className="mt-1.5 text-sm text-ink-muted">Use your Google account, or try the demo.</p>

      <div className="mt-8 grid gap-3">
        <button
          type="button"
          onClick={() => signIn("google")}
          disabled={pending !== null}
          className={buttonClass({ variant: "secondary", size: "lg", fullWidth: true })}
        >
          {pending === "google" ? <Spinner /> : <GoogleMark />}
          Continue with Google
        </button>

        <div className="my-2 flex items-center gap-3 text-xs text-ink-faint">
          <span className="h-px flex-1 bg-line" />
          or
          <span className="h-px flex-1 bg-line" />
        </div>

        <Button
          size="lg"
          fullWidth
          onClick={() => signIn("demo")}
          disabled={pending !== null}
          iconRight={pending === "demo" ? undefined : "arrowRight"}
        >
          {pending === "demo" && <Spinner />}
          Continue as demo user
        </Button>
        <p className="text-center text-xs text-ink-muted">
          No account needed. The demo user has sample meetings.
        </p>
      </div>

      <div className="mt-10 flex items-center justify-between rounded-lg border border-line bg-canvas px-4 py-3">
        <div>
          <p className="text-sm font-medium text-ink">Have a meeting ID?</p>
          <p className="text-xs text-ink-muted">Join as a guest without signing in.</p>
        </div>
        <Link href="/join" className={buttonClass({ variant: "soft", size: "sm" })}>
          Join
          <Icon name="chevronRight" size={16} />
        </Link>
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <span
      role="status"
      aria-label="Signing in"
      className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
    />
  );
}
