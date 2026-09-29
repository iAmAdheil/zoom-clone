import type { ReactNode } from "react";
import { cn } from "@/lib/format";

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-2xl border border-line bg-surface shadow-card", className)}>
      {children}
    </section>
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
  id,
}: {
  title: string;
  subtitle?: ReactNode;
  action?: ReactNode;
  id?: string;
}) {
  return (
    <header className="flex items-center justify-between gap-3 px-5 pt-4 pb-3">
      <div className="min-w-0">
        <h2 id={id} className="text-base font-semibold text-ink">
          {title}
        </h2>
        {subtitle ? <p className="text-xs text-ink-3">{subtitle}</p> : null}
      </div>
      {action}
    </header>
  );
}
