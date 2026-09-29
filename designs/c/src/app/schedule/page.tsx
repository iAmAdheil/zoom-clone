import type { Metadata } from "next";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { Icon } from "@/components/ui/Icon";
import { ScheduleForm } from "@/components/schedule/ScheduleForm";

export const metadata: Metadata = { title: "Schedule a meeting" };

export default function SchedulePage() {
  return (
    <AppShell>
      <div className="mx-auto w-full max-w-form px-4 py-6 md:py-10">
        <Link
          href="/"
          className="inline-flex items-center gap-1 rounded-sm text-sm font-medium text-brand hover:text-brand-hover"
        >
          <Icon name="chevronLeft" size={16} />
          Back to home
        </Link>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">Schedule a meeting</h1>
        <p className="mt-1 mb-6 text-sm text-ink-muted">
          Pick a time, set who can join, then share the link.
        </p>
        <ScheduleForm />
      </div>
    </AppShell>
  );
}
