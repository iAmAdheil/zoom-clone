import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/ui/Icon";

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon: IconName;
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-brand-soft text-brand">
        <Icon name={icon} size={22} />
      </span>
      <p className="text-sm font-semibold text-ink">{title}</p>
      <p className="max-w-xs text-xs text-ink-muted">{body}</p>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
