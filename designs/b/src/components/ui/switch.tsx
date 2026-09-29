"use client";

import { cn } from "@/lib/format";

type SwitchProps = {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  id?: string;
  className?: string;
};

export function Switch({ checked, onChange, label, id, className }: SwitchProps) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        "focus-ring relative inline-flex h-6 w-10 shrink-0 cursor-pointer items-center rounded-full transition-colors",
        checked ? "bg-brand hover:bg-brand-hover" : "bg-line-strong hover:bg-ink-4",
        className,
      )}
    >
      <span
        className={cn(
          "inline-block size-5 rounded-full bg-white shadow-card transition-transform duration-150",
          checked ? "translate-x-[18px]" : "translate-x-0.5",
        )}
      />
    </button>
  );
}
