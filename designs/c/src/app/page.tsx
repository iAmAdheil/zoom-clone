import { AppShell } from "@/components/layout/AppShell";
import { ActionTiles } from "@/components/dashboard/ActionTiles";
import { RecentList } from "@/components/dashboard/RecentList";
import { UpcomingList } from "@/components/dashboard/UpcomingList";
import { demoUser, recentMeetings, upcomingMeetings } from "@/lib/mock";

export default function DashboardPage() {
  const firstName = demoUser.name.split(" ")[0];

  return (
    <AppShell>
      <div className="mx-auto grid max-w-content gap-6 px-4 py-6 md:px-8 md:py-8">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Good morning, {firstName}</h1>
          <p className="mt-1 text-sm text-ink-muted">Start, join or plan a meeting.</p>
        </header>

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          <ActionTiles />
          <UpcomingList meetings={upcomingMeetings} />
        </div>

        <RecentList meetings={recentMeetings} />
      </div>
    </AppShell>
  );
}
