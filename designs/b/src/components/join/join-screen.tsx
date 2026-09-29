import Link from "next/link";
import { SimpleHeader } from "@/components/layout/simple-header";
import { JoinForm } from "./join-form";

export function JoinScreen({ initialCode }: { initialCode?: string }) {
  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <SimpleHeader />
      <main className="flex flex-1 items-start justify-center px-4 py-8 md:items-center md:py-12">
        <div className="w-full max-w-md rounded-3xl border border-line bg-surface p-6 shadow-raised md:p-8">
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Join a meeting</h1>
          <p className="mt-1 mb-6 text-sm text-ink-3">Enter the meeting ID from your invite, or paste the link.</p>
          <JoinForm initialCode={initialCode} />
          <p className="mt-6 text-center text-xs text-ink-3">
            Not signed in? Guests can join meetings that allow guests.{" "}
            <Link href="/signin" className="focus-ring rounded font-medium text-brand hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
