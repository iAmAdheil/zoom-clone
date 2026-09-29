import type { ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";

type ListMessageProps = {
  children: ReactNode;
  tone?: "muted" | "error";
  onRetry?: () => void;
  className?: string;
};

/** Loading, empty or error text in place of a meeting list. */
export function ListMessage({ children, tone = "muted", onRetry, className }: ListMessageProps) {
  if (tone === "error") {
    return (
      <p role="alert" className={cn("flex flex-wrap items-center gap-2 text-sm text-danger", className)}>
        <Icon name="alert" size={16} />
        {children}
        {onRetry ? (
          <button type="button" onClick={onRetry} className="rounded-sm font-bold text-primary hover:underline">
            Try again
          </button>
        ) : null}
      </p>
    );
  }
  return <p className={cn("text-sm text-ink-muted", className)}>{children}</p>;
}
