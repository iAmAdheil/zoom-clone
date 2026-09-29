"use client";

import { Globe, ShieldCheck, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/format";
import type { MeetingAccess } from "@/lib/types";

const options: { value: MeetingAccess; title: string; body: string; icon: LucideIcon }[] = [
  {
    value: "allow_guests",
    title: "Allow guests",
    body: "Anyone with the link can join with a name.",
    icon: Globe,
  },
  {
    value: "verified_only",
    title: "Verified users only",
    body: "People must sign in before they join.",
    icon: ShieldCheck,
  },
];

/** Radio cards for the meeting access setting. */
export function AccessOptions({
  value,
  onChange,
}: {
  value: MeetingAccess;
  onChange: (v: MeetingAccess) => void;
}) {
  return (
    <div role="radiogroup" aria-label="Who can join" className="grid gap-3 sm:grid-cols-2">
      {options.map((o) => {
        const selected = o.value === value;
        const Icon = o.icon;
        return (
          <label
            key={o.value}
            className={cn(
              "relative flex cursor-pointer gap-3 rounded-xl border p-4 transition-colors has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus",
              selected ? "border-brand bg-brand-soft" : "border-line-strong bg-surface hover:border-ink-4 hover:bg-surface-2",
            )}
          >
            <input
              type="radio"
              name="access"
              value={o.value}
              checked={selected}
              onChange={() => onChange(o.value)}
              className="sr-only"
            />
            <span
              className={cn(
                "flex size-9 shrink-0 items-center justify-center rounded-lg",
                selected ? "bg-brand text-white" : "bg-surface-2 text-ink-2",
              )}
            >
              <Icon className="size-5" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-ink">{o.title}</span>
              <span className="block text-xs text-ink-3">{o.body}</span>
            </span>
            <span
              aria-hidden
              className={cn(
                "absolute top-3 right-3 flex size-4 items-center justify-center rounded-full border-2",
                selected ? "border-brand" : "border-line-strong",
              )}
            >
              {selected ? <span className="size-2 rounded-full bg-brand" /> : null}
            </span>
          </label>
        );
      })}
    </div>
  );
}
