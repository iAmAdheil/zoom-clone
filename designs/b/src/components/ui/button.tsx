import Link from "next/link";
import type { ComponentProps } from "react";
import { cn } from "@/lib/format";

export type ButtonVariant =
  | "primary"
  | "accent"
  | "secondary"
  | "soft"
  | "ghost"
  | "danger"
  | "room"
  | "room-ghost";

export type ButtonSize = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-semibold transition-colors duration-150 select-none disabled:cursor-not-allowed disabled:opacity-50";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-brand text-white hover:bg-brand-hover active:bg-brand-press focus-ring",
  accent: "bg-accent text-white hover:bg-accent-hover focus-ring",
  secondary:
    "bg-surface text-ink border border-line-strong hover:bg-surface-2 active:bg-surface-3 focus-ring",
  soft: "bg-brand-soft text-brand hover:bg-brand-soft-2 focus-ring",
  ghost: "text-ink-2 hover:bg-surface-2 hover:text-ink active:bg-surface-3 focus-ring",
  danger: "bg-danger text-white hover:bg-danger-hover focus-ring",
  room: "bg-room-3 text-room-ink border border-room-line hover:bg-room-hover focus-ring-room",
  "room-ghost": "text-room-ink hover:bg-room-hover focus-ring-room",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-sm rounded-md",
  md: "h-10 px-4 text-sm rounded-lg",
  lg: "h-12 px-5 text-base rounded-xl",
};

export function buttonClasses(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "md",
  className?: string,
): string {
  return cn(base, variants[variant], sizes[size], className);
}

type ButtonProps = ComponentProps<"button"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  type = "button",
  ...props
}: ButtonProps) {
  return <button type={type} className={buttonClasses(variant, size, className)} {...props} />;
}

type ButtonLinkProps = ComponentProps<typeof Link> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

export function ButtonLink({ variant = "primary", size = "md", className, ...props }: ButtonLinkProps) {
  return <Link className={buttonClasses(variant, size, className)} {...props} />;
}
