import Link from "next/link";
import type { ButtonHTMLAttributes, ComponentProps } from "react";
import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "link" | "outline-dark";
export type ButtonSize = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-md font-bold whitespace-nowrap transition-colors select-none disabled:cursor-not-allowed disabled:opacity-50";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-primary text-white hover:bg-primary-hover active:bg-primary-active",
  secondary:
    "border border-line-strong bg-surface text-ink hover:bg-surface-hover active:bg-line",
  ghost: "text-ink hover:bg-surface-hover active:bg-line",
  danger: "bg-danger text-white hover:bg-danger-hover",
  link: "text-primary hover:underline px-0",
  "outline-dark":
    "border border-room-line bg-room-bar text-room-text hover:bg-room-hover active:bg-room-press",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-sm",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-6 text-base",
};

type StyleProps = { variant?: ButtonVariant; size?: ButtonSize; block?: boolean };

export function buttonClass({ variant = "primary", size = "md", block }: StyleProps = {}) {
  return cn(base, variants[variant], variant !== "link" && sizes[size], block && "w-full");
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & StyleProps;

export function Button({ variant, size, block, className, type = "button", ...rest }: ButtonProps) {
  return <button type={type} className={cn(buttonClass({ variant, size, block }), className)} {...rest} />;
}

type ButtonLinkProps = ComponentProps<typeof Link> & StyleProps;

/** A Next.js link that looks like a button. */
export function ButtonLink({ variant, size, block, className, ...rest }: ButtonLinkProps) {
  return <Link className={cn(buttonClass({ variant, size, block }), className)} {...rest} />;
}
