import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/ui/Logo";

type SimpleShellProps = { children: ReactNode; headerRight?: ReactNode };

/** Plain white page with a logo bar and the Zoom-style legal footer (sign in, join, preview). */
export function SimpleShell({ children, headerRight }: SimpleShellProps) {
  return (
    <div className="flex min-h-dvh flex-col bg-surface">
      <header className="flex h-header items-center justify-between border-b border-line px-4 sm:px-8">
        <Logo size="md" />
        {headerRight}
      </header>
      <main className="flex flex-1 flex-col">{children}</main>
      <footer className="px-4 py-6 text-center text-xs text-ink-muted">
        © 2026 Zoom clone. Not affiliated with Zoom Video Communications.{" "}
        <Link href="/signin" className="rounded-sm underline hover:text-ink">
          Privacy &amp; Legal Policies
        </Link>
      </footer>
    </div>
  );
}
