"use client";

import { Check, Copy } from "lucide-react";
import { useCopy } from "@/lib/hooks";
import { cn } from "@/lib/format";

type CopyButtonProps = {
  text: string;
  label: string;
  /** "icon" shows only an icon with a tooltip. "text" shows the label. */
  display?: "icon" | "text";
  theme?: "light" | "room";
  className?: string;
};

export function CopyButton({ text, label, display = "icon", theme = "light", className }: CopyButtonProps) {
  const { copied, copy } = useCopy();
  const Icon = copied ? Check : Copy;
  const room = theme === "room";

  return (
    <button
      type="button"
      onClick={() => copy(text)}
      aria-label={copied ? "Copied" : label}
      className={cn(
        "group relative inline-flex items-center justify-center gap-1.5 font-medium transition-colors",
        room ? "focus-ring-room" : "focus-ring",
        display === "icon"
          ? cn(
              "size-8 rounded-lg",
              room ? "text-room-ink-2 hover:bg-room-hover hover:text-room-ink" : "text-ink-3 hover:bg-surface-2 hover:text-ink",
            )
          : cn(
              "h-9 rounded-lg px-3 text-sm",
              room ? "border border-room-line bg-room-2 text-room-ink hover:bg-room-hover" : "bg-brand-soft text-brand hover:bg-brand-soft-2",
            ),
        className,
      )}
    >
      <Icon className={cn("size-4", copied && (room ? "text-speaker" : "text-success"))} />
      {display === "text" ? <span>{copied ? "Copied" : label}</span> : null}
      {display === "icon" ? (
        <span
          role="tooltip"
          className="pointer-events-none absolute bottom-full left-1/2 mb-1.5 -translate-x-1/2 rounded-md bg-ink px-2 py-1 text-[11px] whitespace-nowrap text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
        >
          {copied ? "Copied" : label}
        </span>
      ) : null}
    </button>
  );
}
