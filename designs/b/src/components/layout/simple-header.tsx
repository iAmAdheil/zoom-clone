import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/ui/logo";

/** Slim header for focused screens (join). */
export function SimpleHeader({ backHref = "/", backLabel = "Back to home" }: { backHref?: string; backLabel?: string }) {
  return (
    <header className="flex h-topbar items-center justify-between border-b border-line bg-surface px-4 md:px-6">
      <Link href="/" aria-label="Zoom Workplace home" className="focus-ring rounded-md">
        <Logo />
      </Link>
      <Link
        href={backHref}
        className="focus-ring inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-ink-2 hover:bg-surface-2 hover:text-ink"
      >
        <ArrowLeft className="size-4" />
        {backLabel}
      </Link>
    </header>
  );
}
