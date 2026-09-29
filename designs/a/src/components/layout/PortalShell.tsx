"use client";

import { useRef, useState, type ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";
import { Logo } from "@/components/ui/Logo";
import { useDismiss } from "@/lib/hooks";
import { PortalHeader } from "./PortalHeader";
import { SideNav } from "./SideNav";

/**
 * Light portal layout: top header, left nav, content.
 * Below 1024px the left nav moves into a slide-in drawer.
 */
export function PortalShell({ children }: { children: ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);
  useDismiss(drawerRef, drawerOpen, () => setDrawerOpen(false));

  return (
    <div className="flex min-h-full flex-col bg-surface">
      <PortalHeader onMenu={() => setDrawerOpen(true)} />

      <div className="flex flex-1">
        <aside className="sticky top-header hidden h-[calc(100dvh-var(--spacing-header))] w-sidenav shrink-0 overflow-y-auto border-r border-line lg:block">
          <SideNav />
        </aside>
        <main className="min-w-0 flex-1">{children}</main>
      </div>

      {drawerOpen ? (
        <div className="fixed inset-0 z-40 bg-scrim lg:hidden">
          <div
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
            className="h-full w-sidenav max-w-[85vw] overflow-y-auto bg-surface shadow-popover"
          >
            <div className="flex h-header items-center justify-between border-b border-line px-4">
              <Logo size="sm" />
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label="Close navigation"
                className="rounded-md p-2 text-ink-muted hover:bg-surface-hover"
              >
                <Icon name="close" size={20} />
              </button>
            </div>
            <SideNav onNavigate={() => setDrawerOpen(false)} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
