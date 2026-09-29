import Link from "next/link";
import { cn } from "@/lib/cn";

type LogoProps = { tone?: "brand" | "white"; size?: "sm" | "md" | "lg"; href?: string; className?: string };

const sizes = { sm: "text-xl", md: "text-[28px]", lg: "text-5xl" };

/** Text wordmark in the Zoom style. It is not the official logo file. */
export function Logo({ tone = "brand", size = "md", href = "/", className }: LogoProps) {
  return (
    <Link
      href={href}
      aria-label="Zoom clone home"
      className={cn(
        "inline-flex items-center rounded-sm font-black leading-none tracking-tight lowercase",
        tone === "brand" ? "text-primary" : "text-white",
        sizes[size],
        className,
      )}
    >
      zoom
    </Link>
  );
}
