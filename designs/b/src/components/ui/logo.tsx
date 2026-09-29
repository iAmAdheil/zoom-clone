import { cn } from "@/lib/format";

/** Text wordmark in the Zoom Workplace style: "zoom" over "Workplace". */
export function Logo({ tone = "dark", className }: { tone?: "dark" | "light"; className?: string }) {
  return (
    <span className={cn("inline-flex flex-col leading-none select-none", className)}>
      <span
        className={cn(
          "text-[11px] font-extrabold tracking-tight lowercase",
          tone === "dark" ? "text-brand" : "text-white",
        )}
      >
        zoom
      </span>
      <span
        className={cn(
          "text-lg font-semibold tracking-tight",
          tone === "dark" ? "text-ink" : "text-white",
        )}
      >
        Workplace
      </span>
    </span>
  );
}
