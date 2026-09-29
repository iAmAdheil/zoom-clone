import { AppShell } from "@/components/layout/app-shell";
import { ActionTiles } from "@/components/dashboard/action-tiles";
import { Greeting } from "@/components/dashboard/greeting";
import { RecentList } from "@/components/dashboard/recent-list";
import { UpcomingCard } from "@/components/dashboard/upcoming-card";
import { Card } from "@/components/ui/card";
import { demoUser, recentAttendance, recentMeetings, upcomingMeetings } from "@/lib/mock";

export default function DashboardPage() {
  const firstName = demoUser.name.split(" ")[0];

  return (
    <AppShell>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_28rem] lg:gap-6">
        <Card className="flex flex-col px-4 py-5 md:px-8 md:py-7">
          <Greeting firstName={firstName} />
          <p className="mt-1 text-sm text-ink-3">
            Start, join or schedule a meeting. You have {upcomingMeetings.length} meetings coming up.
          </p>
          <div className="mt-6 flex flex-1 items-center justify-center lg:mt-4 lg:py-6">
            <div className="w-full lg:max-w-sm">
              <ActionTiles />
            </div>
          </div>
        </Card>

        <UpcomingCard meetings={upcomingMeetings} me={demoUser} />

        <div className="lg:col-span-2">
          <RecentList meetings={recentMeetings} attendance={recentAttendance} me={demoUser} />
        </div>
      </div>
    </AppShell>
  );
}
