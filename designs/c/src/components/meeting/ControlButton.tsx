import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import { Icon, type IconName } from "@/components/ui/Icon";

type ControlButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: IconName;
  label: string;
  /** Panel is open or feature is on. */
  active?: boolean;
  /** Red icon, for muted mic or stopped video. */
  alert?: boolean;
  /** Green icon tile, for Share Screen like Zoom. */
  highlight?: boolean;
  count?: number;
};

/** Icon over label: the Zoom meeting toolbar button. */
export function ControlButton({
  icon,
  label,
  active,
  alert,
  highlight,
  count,
  className,
  ...rest
}: ControlButtonProps) {
  return (
    <button
      type="button"
      className={cn(
        "relative flex h-14 min-w-14 flex-col items-center justify-center gap-1 rounded-md px-2 text-2xs font-medium text-room-ink transition-colors hover:bg-room-hover sm:min-w-16 sm:text-xs",
        active && "bg-room-raised",
        className,
      )}
      {...rest}
    >
      <span
        className={cn(
          "relative flex items-center justify-center",
          highlight && "rounded-sm bg-success px-1.5 py-0.5 text-white",
          alert && "text-danger",
        )}
      >
        <Icon name={icon} size={highlight ? 18 : 22} strokeWidth={highlight ? 2.2 : 1.8} />
        {count !== undefined && (
          <span className="absolute -top-1.5 -right-3 min-w-4 rounded-full bg-room-raised px-1 text-center text-2xs leading-4 font-semibold text-room-ink">
            {count}
          </span>
        )}
      </span>
      <span className="whitespace-nowrap">{label}</span>
    </button>
  );
}

/** Small caret next to Mute and Video that opens a device menu. */
export function CaretButton({ label, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      className="hidden h-14 w-5 items-start justify-center rounded-sm pt-2 text-room-ink-muted transition-colors hover:bg-room-hover hover:text-room-ink sm:flex"
      {...rest}
    >
      <Icon name="chevronUp" size={14} strokeWidth={2.2} />
    </button>
  );
}
