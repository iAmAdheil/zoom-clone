"use client";

import { Toast } from "@/components/ui/Toast";
import { useUser } from "@/lib/auth";
import { dayKey } from "@/lib/format";
import { useNowMinute, useToast } from "@/lib/hooks";
import { useRecentMeetings, useUpcomingMeetings } from "@/lib/queries";
import { ActionTiles } from "./ActionTiles";
import { RecentMeetings } from "./RecentMeetings";
import { UpcomingCard } from "./UpcomingCard";

function greeting(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

/** Zoom Home: greeting, the four action tiles, Upcoming and Recent. */
export function DashboardHome() {
  const user = useUser();
  const upcoming = useUpcomingMeetings();
  const recent = useRecentMeetings();
  const now = useNowMinute();
  const toast = useToast();

  const firstName = user.name.split(" ")[0];
  const todayKey = now === null ? null : dayKey(new Date(now));
  const todayCount =
    todayKey === null || !upcoming.data
      ? null
      : upcoming.data.filter((m) => m.scheduled_start && dayKey(new Date(m.scheduled_start)) === todayKey).length;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-6 sm:px-8 sm:py-8">
      <div>
        <h1 className="text-2xl font-bold text-ink">Home</h1>
        <p className="mt-1 text-sm text-ink-muted">
          {now === null ? "Welcome" : greeting(new Date(now).getHours())}, {firstName}.
          {todayCount === null
            ? null
            : todayCount === 0
              ? " You have no more meetings today."
              : ` You have ${todayCount} ${todayCount === 1 ? "meeting" : "meetings"} today.`}
        </p>
      </div>

      <div className="grid items-start gap-10 md:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:gap-16">
        <div className="flex justify-center py-2 md:pt-10">
          <ActionTiles />
        </div>
        <UpcomingCard
          now={now}
          meetings={upcoming.data}
          error={upcoming.error}
          onRetry={() => upcoming.mutate()}
          onCopied={toast.show}
        />
      </div>

      <RecentMeetings
        meetings={recent.data}
        error={recent.error}
        onRetry={() => recent.mutate()}
        me={user}
        onCopied={toast.show}
      />
      <Toast message={toast.message} />
    </div>
  );
}
