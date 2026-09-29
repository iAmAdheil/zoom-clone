import type { ReactNode } from "react";
import { MobileTabBar, SideNav } from "./side-nav";
import { TopBar } from "./top-bar";

/** Light app frame: top bar, left rail (tablet+), bottom tabs (phone). */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <TopBar />
      <div className="flex flex-1">
        <SideNav />
        <main className="min-w-0 flex-1 px-4 pt-5 pb-24 md:px-8 md:pt-7 md:pb-10">
          <div className="mx-auto w-full max-w-content">{children}</div>
        </main>
      </div>
      <MobileTabBar />
    </div>
  );
}
