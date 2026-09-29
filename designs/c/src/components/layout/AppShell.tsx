import type { ReactNode } from "react";
import { SideNav } from "./SideNav";
import { TabBar } from "./TabBar";
import { TopNav } from "./TopNav";

/** Light app frame: top bar, left nav, content. Phones get a bottom tab bar. */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <TopNav />
      <div className="flex flex-1">
        <SideNav />
        <main id="main" className="min-w-0 flex-1 pb-tabbar md:pb-0">
          {children}
        </main>
      </div>
      <TabBar />
    </div>
  );
}
