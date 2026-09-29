import type { Metadata } from "next";
import Link from "next/link";
import { PortalShell } from "@/components/layout/PortalShell";
import { ScheduleForm } from "@/components/schedule/ScheduleForm";
import { Icon } from "@/components/ui/Icon";

export const metadata: Metadata = { title: "Schedule Meeting - Zoom clone" };

export default function SchedulePage() {
  return (
    <PortalShell>
      <div className="px-4 py-6 sm:px-8 sm:py-8">
        <Link
          href="/"
          className="inline-flex items-center gap-1 rounded-sm text-sm text-ink-muted hover:text-primary"
        >
          <Icon name="chevronLeft" size={16} /> Back to Home
        </Link>
        <h1 className="mt-3 mb-2 text-2xl font-bold text-ink">Schedule Meeting</h1>
        <ScheduleForm />
      </div>
    </PortalShell>
  );
}
