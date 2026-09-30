"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Logo } from "@/components/ui/Logo";
import { errorMessage } from "@/lib/api";
import { SignedInUserProvider } from "@/lib/auth";
import { useDismiss } from "@/lib/hooks";
import { useMe } from "@/lib/queries";
import { signInHref } from "@/lib/redirects";
import { PortalHeader } from "./PortalHeader";
import { SideNav } from "./SideNav";

/**
 * Light portal layout: top header, left nav, content.
 * Below 1024px the left nav moves into a slide-in drawer.
 * It is also the auth gate: it renders the page only for a signed-in user.
 */
export function PortalShell({ children }: { children: ReactNode }) {
  const { data: user, error, mutate } = useMe();
  const router = useRouter();
  const pathname = usePathname();

  // /api/me said "not signed in" (for example, an expired cookie). Go to sign in, then come back.
  useEffect(() => {
    if (user === null) router.replace(signInHref(pathname));
  }, [user, pathname, router]);

  if (!user) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-surface px-4 text-center">
        <Logo size="md" />
        {error ? (
          <>
            <p role="alert" className="text-sm text-danger">
              {errorMessage(error)}
            </p>
            <Button variant="secondary" size="sm" onClick={() => mutate()}>
              Try again
            </Button>
          </>
        ) : (
          <p role="status" className="text-sm text-ink-muted">
            Loading...
          </p>
        )}
      </div>
    );
  }

  return (
    <SignedInUserProvider user={user}>
      <PortalFrame>{children}</PortalFrame>
    </SignedInUserProvider>
  );
}

function PortalFrame({ children }: { children: ReactNode }) {
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
                className="inline-flex size-10 items-center justify-center rounded-md text-ink-muted hover:bg-surface-hover"
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
