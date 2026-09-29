import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Icon, type IconName } from "./Icon";

type RadioCardProps = {
  name: string;
  value: string;
  checked: boolean;
  onChange: (value: string) => void;
  icon: IconName;
  title: string;
  description: ReactNode;
};

/** A large radio option. The whole card is the click target. */
export function RadioCard({ name, value, checked, onChange, icon, title, description }: RadioCardProps) {
  const id = `${name}-${value}`;
  return (
    <label
      htmlFor={id}
      className={cn(
        "relative flex cursor-pointer gap-3 rounded-md border p-4 transition-colors has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus",
        checked
          ? "border-brand bg-brand-soft"
          : "border-line-strong bg-surface hover:border-ink-faint hover:bg-surface-hover",
      )}
    >
      <input
        id={id}
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={() => onChange(value)}
        className="peer sr-only"
      />
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-full",
          checked ? "bg-brand text-on-brand" : "bg-surface-sunken text-ink-muted",
        )}
      >
        <Icon name={icon} size={18} />
      </span>
      <span className="grid gap-0.5 pr-6">
        <span className="text-sm font-semibold text-ink">{title}</span>
        <span className="text-xs text-ink-muted">{description}</span>
      </span>
      <span
        aria-hidden="true"
        className={cn(
          "absolute top-4 right-4 flex size-5 items-center justify-center rounded-full border-2",
          checked ? "border-brand bg-brand text-on-brand" : "border-line-strong",
        )}
      >
        {checked && <Icon name="check" size={12} strokeWidth={3} />}
      </span>
    </label>
  );
}
