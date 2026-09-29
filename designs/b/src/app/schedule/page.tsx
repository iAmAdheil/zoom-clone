import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { ScheduleForm } from "@/components/schedule/schedule-form";

export const metadata: Metadata = { title: "Schedule meeting · Zoom Workplace clone" };

export default function SchedulePage() {
  return (
    <AppShell>
      <Link
        href="/"
        className="focus-ring inline-flex items-center gap-1 rounded-md text-sm font-medium text-brand hover:underline"
      >
        <ChevronLeft className="size-4" />
        Back to home
      </Link>
      <h1 className="mt-2 mb-5 text-xl font-semibold tracking-tight text-ink md:text-2xl">Schedule meeting</h1>
      <ScheduleForm />
    </AppShell>
  );
}
