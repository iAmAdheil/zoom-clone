import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { cn } from "@/lib/cn";
import { Icon } from "./Icon";

// Form controls in the Zoom portal style: 40px high, 8px radius, grey border, blue focus.

export const controlClass =
  "h-10 w-full rounded-md border border-line-strong bg-surface px-3 text-sm text-ink placeholder:text-ink-subtle transition-colors hover:border-ink-muted focus:border-primary focus:outline-none focus-visible:outline-none focus:ring-2 focus:ring-primary-soft disabled:bg-surface-muted disabled:text-ink-subtle aria-invalid:border-danger aria-invalid:ring-danger-soft";

type FieldProps = {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  children: ReactNode;
  className?: string;
};

/** Label + control + hint or error. The control gets aria-describedby from the caller. */
export function Field({ id, label, hint, error, children, className }: FieldProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-sm font-bold text-ink-2">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-msg`} role="alert" className="flex items-center gap-1 text-xs text-danger">
          <Icon name="alert" size={14} />
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-msg`} className="text-xs text-ink-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function TextInput({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(controlClass, className)} {...rest} />;
}

export function TextArea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(controlClass, "h-auto min-h-24 py-2 leading-5", className)} {...rest} />;
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className={cn("relative", className)}>
      <select className={cn(controlClass, "appearance-none pr-9")} {...rest}>
        {children}
      </select>
      <Icon
        name="chevronDown"
        size={16}
        className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-ink-muted"
      />
    </div>
  );
}

type CheckProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label: ReactNode;
  description?: ReactNode;
  type?: "checkbox" | "radio";
};

/**
 * Checkbox or radio with a label and an optional description line.
 * The real input is invisible and covers a 16 px drawn box. On a phone the input grows to
 * 40 x 40 px (a negative margin keeps the layout the same), so it is easy to tap.
 */
export function Check({ label, description, type = "checkbox", className, id, ...rest }: CheckProps) {
  const round = type === "radio";
  return (
    <label htmlFor={id} className={cn("flex cursor-pointer items-start gap-2.5 text-sm", className)}>
      <span className="relative mt-0.5 flex size-4 shrink-0 items-center justify-center max-sm:-m-3 max-sm:size-10">
        <input
          id={id}
          type={type}
          className="peer absolute inset-0 z-10 m-0 size-full cursor-pointer opacity-0 focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-not-allowed"
          {...rest}
        />
        <span
          aria-hidden="true"
          className={cn(
            "pointer-events-none size-4 border border-line-strong bg-surface transition-colors peer-checked:border-primary peer-checked:bg-primary peer-focus-visible:ring-2 peer-focus-visible:ring-primary peer-focus-visible:ring-offset-1 peer-disabled:opacity-50",
            round ? "rounded-full" : "rounded-sm",
          )}
        />
        {round ? (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute size-1.5 rounded-full bg-white opacity-0 peer-checked:opacity-100"
          />
        ) : (
          <Icon
            name="check"
            size={12}
            strokeWidth={3}
            className="pointer-events-none absolute text-white opacity-0 peer-checked:opacity-100"
          />
        )}
      </span>
      <span className="flex flex-col gap-0.5">
        <span className="text-ink">{label}</span>
        {description ? <span className="text-xs text-ink-muted">{description}</span> : null}
      </span>
    </label>
  );
}
