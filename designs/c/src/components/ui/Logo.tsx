import { cn } from "@/lib/cn";

/** Text wordmark. It is not the real Zoom logo file. */
export function Logo({
  tone = "brand",
  size = "md",
  className,
}: {
  tone?: "brand" | "white";
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "font-bold tracking-logo lowercase leading-none select-none",
        tone === "brand" ? "text-brand" : "text-white",
        size === "sm" && "text-xl",
        size === "md" && "text-2xl",
        size === "lg" && "text-5xl",
        className,
      )}
    >
      zoom
    </span>
  );
}
