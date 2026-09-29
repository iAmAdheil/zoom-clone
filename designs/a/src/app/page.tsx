import { ActionTiles } from "@/components/dashboard/ActionTiles";
import { RecentMeetings } from "@/components/dashboard/RecentMeetings";
import { UpcomingCard } from "@/components/dashboard/UpcomingCard";
import { PortalShell } from "@/components/layout/PortalShell";
import { MOCK_NOW, demoUser, recentMeetings, upcomingMeetings } from "@/lib/mock";

export default function DashboardPage() {
  const firstName = demoUser.name.split(" ")[0];

  return (
    <PortalShell>
      <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-6 sm:px-8 sm:py-8">
        <div>
          <h1 className="text-2xl font-bold text-ink">Home</h1>
          <p className="mt-1 text-sm text-ink-muted">Good morning, {firstName}. You have 2 meetings today.</p>
        </div>

        <div className="grid items-start gap-10 md:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:gap-16">
          <div className="flex justify-center py-2 md:pt-10">
            <ActionTiles />
          </div>
          <UpcomingCard now={MOCK_NOW} meetings={upcomingMeetings} />
        </div>

        <RecentMeetings meetings={recentMeetings} me={demoUser} />
      </div>
    </PortalShell>
  );
}
