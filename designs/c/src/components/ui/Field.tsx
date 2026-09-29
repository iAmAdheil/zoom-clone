import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import { Icon, type IconName } from "./Icon";

// Shared look for every text control. Light by default, dark for the meeting screens.
const lightControl =
  "w-full rounded-md border border-line-strong bg-surface px-3 text-sm text-ink placeholder:text-ink-faint transition-colors hover:border-ink-faint focus:border-brand focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-focus aria-[invalid=true]:border-danger disabled:bg-surface-sunken disabled:text-ink-muted";

const darkControl =
  "w-full rounded-md border border-room-line bg-room-raised px-3 text-sm text-room-ink placeholder:text-room-ink-faint transition-colors hover:border-room-ink-faint focus:border-focus-dark focus:outline-none aria-[invalid=true]:border-danger";

type Tone = "light" | "dark";
const controlFor = (tone: Tone) => (tone === "dark" ? darkControl : lightControl);

type FieldProps = {
  id: string;
  label: string;
  hint?: ReactNode;
  error?: string;
  optional?: boolean;
  /** "stack" puts the label on top. "row" puts it in a left column on wide screens. */
  layout?: "stack" | "row";
  children: ReactNode;
};

/** Label, control, hint and error in one block. */
export function Field({ id, label, hint, error, optional, layout = "stack", children }: FieldProps) {
  return (
    <div
      className={cn(
        "grid gap-1.5",
        layout === "row" && "md:grid-cols-[var(--spacing-label)_minmax(0,1fr)] md:items-start md:gap-6",
      )}
    >
      <label htmlFor={id} className={cn("text-sm font-medium text-ink-2", layout === "row" && "md:pt-2.5")}>
        {label}
        {optional && <span className="ml-1 font-normal text-ink-faint">(optional)</span>}
      </label>
      <div className="grid gap-1.5">
        {children}
        {error ? (
          <p id={`${id}-error`} className="flex items-center gap-1 text-xs text-danger" role="alert">
            <Icon name="info" size={14} />
            {error}
          </p>
        ) : (
          hint && (
            <p id={`${id}-hint`} className="text-xs text-ink-muted">
              {hint}
            </p>
          )
        )}
      </div>
    </div>
  );
}

type TextInputProps = InputHTMLAttributes<HTMLInputElement> & {
  leadingIcon?: IconName;
  invalid?: boolean;
  tone?: Tone;
};

export function TextInput({ leadingIcon, invalid, tone = "light", className, ...rest }: TextInputProps) {
  return (
    <div className="relative">
      {leadingIcon && (
        <Icon
          name={leadingIcon}
          size={18}
          className={cn(
            "pointer-events-none absolute top-1/2 left-3 -translate-y-1/2",
            tone === "dark" ? "text-room-ink-muted" : "text-ink-muted",
          )}
        />
      )}
      <input
        aria-invalid={invalid || undefined}
        className={cn(controlFor(tone), "h-10", leadingIcon && "pl-10", className)}
        {...rest}
      />
    </div>
  );
}

export function TextArea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea className={cn(lightControl, "min-h-24 resize-y py-2.5 leading-relaxed", className)} {...rest} />
  );
}

export function Select({
  className,
  children,
  tone = "light",
  leadingIcon,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & { tone?: Tone; leadingIcon?: IconName }) {
  const iconTone = tone === "dark" ? "text-room-ink-muted" : "text-ink-muted";
  return (
    <div className="relative">
      {leadingIcon && (
        <Icon
          name={leadingIcon}
          size={16}
          className={cn("pointer-events-none absolute top-1/2 left-3 -translate-y-1/2", iconTone)}
        />
      )}
      <select
        className={cn(
          controlFor(tone),
          "h-10 appearance-none truncate pr-9",
          leadingIcon && "pl-9",
          className,
        )}
        {...rest}
      >
        {children}
      </select>
      <Icon
        name="chevronDown"
        size={16}
        className={cn("pointer-events-none absolute top-1/2 right-3 -translate-y-1/2", iconTone)}
      />
    </div>
  );
}

type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label: ReactNode;
  description?: ReactNode;
  tone?: "light" | "dark";
};

export function Checkbox({ id, label, description, tone = "light", className, ...rest }: CheckboxProps) {
  return (
    <label htmlFor={id} className={cn("flex cursor-pointer items-start gap-3", className)}>
      <input
        id={id}
        type="checkbox"
        className="mt-0.5 size-4 shrink-0 cursor-pointer rounded-xs accent-brand"
        {...rest}
      />
      <span className="grid gap-0.5">
        <span className={cn("text-sm", tone === "dark" ? "text-room-ink" : "text-ink")}>{label}</span>
        {description && (
          <span className={cn("text-xs", tone === "dark" ? "text-room-ink-muted" : "text-ink-muted")}>
            {description}
          </span>
        )}
      </span>
    </label>
  );
}
