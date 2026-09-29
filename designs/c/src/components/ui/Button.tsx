import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Icon, type IconName } from "./Icon";

export type ButtonVariant =
  "primary" | "secondary" | "ghost" | "soft" | "danger" | "accent" | "dark" | "darkGhost";
export type ButtonSize = "sm" | "md" | "lg";

const base =
  "inline-flex select-none items-center justify-center gap-2 whitespace-nowrap font-semibold transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-brand text-on-brand hover:bg-brand-hover active:bg-brand-press",
  secondary: "border border-line-strong bg-surface text-ink hover:bg-surface-hover active:bg-surface-sunken",
  ghost: "text-ink-2 hover:bg-surface-hover active:bg-surface-sunken",
  soft: "bg-brand-soft text-brand hover:bg-brand-soft-hover",
  danger: "bg-danger text-white hover:bg-danger-hover",
  accent: "bg-accent text-white hover:bg-accent-hover",
  dark: "bg-room-raised text-room-ink hover:bg-room-hover",
  darkGhost: "text-room-ink hover:bg-room-hover",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-8 rounded-sm px-3 text-sm",
  md: "h-10 rounded-md px-4 text-sm",
  lg: "h-12 rounded-md px-5 text-base",
};

type CommonProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconName;
  iconRight?: IconName;
  fullWidth?: boolean;
  className?: string;
  children?: ReactNode;
};

type ButtonProps = CommonProps & ButtonHTMLAttributes<HTMLButtonElement> & { href?: undefined };
type LinkProps = CommonProps & { href: string; "aria-label"?: string };

export function buttonClass({
  variant = "primary",
  size = "md",
  fullWidth,
  className,
}: Pick<CommonProps, "variant" | "size" | "fullWidth" | "className">) {
  return cn(base, variants[variant], sizes[size], fullWidth && "w-full", className);
}

function Content({ icon, iconRight, size, children }: CommonProps) {
  const iconSize = size === "sm" ? 16 : 18;
  return (
    <>
      {icon && <Icon name={icon} size={iconSize} />}
      {children}
      {iconRight && <Icon name={iconRight} size={iconSize} />}
    </>
  );
}

/** A button. Pass `href` to get a Next.js link with the same look. */
export function Button(props: ButtonProps | LinkProps) {
  if (props.href !== undefined) {
    const { href, variant, size, fullWidth, className, ...content } = props;
    return (
      <Link
        href={href}
        className={buttonClass({ variant, size, fullWidth, className })}
        aria-label={props["aria-label"]}
      >
        <Content {...content} size={size} />
      </Link>
    );
  }

  const { variant, size, icon, iconRight, fullWidth, className, children, ...rest } = props;
  return (
    <button type="button" {...rest} className={buttonClass({ variant, size, fullWidth, className })}>
      <Content icon={icon} iconRight={iconRight} size={size}>
        {children}
      </Content>
    </button>
  );
}
