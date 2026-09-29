import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, UserRound } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { ButtonLink } from "@/components/ui/button";
import { GoogleIcon } from "@/components/ui/google-icon";
import { Logo } from "@/components/ui/logo";
import { roomParticipants } from "@/lib/mock";

export const metadata: Metadata = { title: "Sign in · Zoom Workplace clone" };

export default function SignInPage() {
  return (
    <div className="flex min-h-dvh flex-col bg-surface lg:flex-row">
      <BrandPanel />

      <main className="flex flex-1 items-center justify-center px-4 py-10 md:px-8">
        <div className="w-full max-w-sm">
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Sign in</h1>
          <p className="mt-1 text-sm text-ink-3">Use your Google account, or try the app as a demo user.</p>

          <div className="mt-8 flex flex-col gap-3">
            {/* Mock: the real app calls GET /api/auth/google/login */}
            <Link
              href="/"
              className="focus-ring flex h-12 items-center justify-center gap-3 rounded-xl border border-line-strong bg-surface text-sm font-semibold text-ink transition-colors hover:bg-surface-2 active:bg-surface-3"
            >
              <GoogleIcon className="size-5" />
              Sign in with Google
            </Link>

            <div className="my-2 flex items-center gap-3 text-xs text-ink-3">
              <span className="h-px flex-1 bg-line" />
              or
              <span className="h-px flex-1 bg-line" />
            </div>

            {/* Mock: the real app calls POST /api/auth/demo */}
            <ButtonLink href="/" size="lg" className="w-full">
              <UserRound className="size-5" />
              Continue as demo user
            </ButtonLink>
            <p className="text-center text-xs text-ink-3">
              The demo account has sample meetings. No sign-up needed.
            </p>
          </div>

          <div className="mt-10 rounded-xl bg-surface-2 p-4">
            <p className="text-sm font-medium text-ink">Only need to join a meeting?</p>
            <Link
              href="/join"
              className="focus-ring mt-1 inline-flex items-center gap-1 rounded-md text-sm font-semibold text-brand hover:underline"
            >
              Join as a guest
              <ArrowRight className="size-4" />
            </Link>
          </div>

          <p className="mt-10 text-xs leading-relaxed text-ink-3">
            By signing in, you agree to the Terms of Service and the Privacy Statement. This is a
            mockup for a class project.
          </p>
        </div>
      </main>
    </div>
  );
}

/** Left panel on desktop, top header on phone and tablet. */
function BrandPanel() {
  const people = roomParticipants.slice(0, 4);
  return (
    <aside className="relative overflow-hidden bg-linear-to-br from-navy via-navy-2 to-brand px-6 py-6 text-white lg:flex lg:w-[46%] lg:flex-col lg:justify-between lg:px-12 lg:py-10">
      <span aria-hidden className="absolute -top-24 -right-24 size-80 rounded-full bg-white/5" />
      <span aria-hidden className="absolute -bottom-32 -left-16 size-96 rounded-full bg-brand/30 blur-3xl" />

      <div className="relative">
        <Logo tone="light" />
      </div>

      <div className="relative mt-6 hidden lg:block">
        <h2 className="max-w-md text-4xl leading-tight font-semibold tracking-tight">
          Meet, chat and plan in one place.
        </h2>
        <p className="mt-3 max-w-sm text-base text-white/75">
          Start a meeting in one click. Share a link. Let guests in, or keep it to verified users.
        </p>

        <div className="mt-10 grid max-w-md grid-cols-2 gap-3" aria-hidden>
          {people.map((p, i) => (
            <div
              key={p.id}
              className="relative flex aspect-video items-center justify-center rounded-2xl border border-white/10 bg-white/10 backdrop-blur"
            >
              <Avatar name={p.display_name} tone={p.tone} size="lg" />
              <span className="absolute bottom-2 left-2 rounded-md bg-black/40 px-1.5 py-0.5 text-[11px]">
                {p.display_name}
              </span>
              {i === 1 ? <span className="absolute inset-0 rounded-2xl ring-2 ring-speaker" /> : null}
            </div>
          ))}
        </div>
      </div>

      <p className="relative hidden text-xs text-white/60 lg:block">Design B · Zoom Workplace style</p>
    </aside>
  );
}
