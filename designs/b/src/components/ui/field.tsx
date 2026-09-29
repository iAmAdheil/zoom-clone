import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/format";

const control =
  "w-full rounded-lg border bg-surface px-3 text-sm text-ink placeholder:text-ink-4 transition-colors " +
  "hover:border-ink-4 focus:border-brand focus:outline-none focus:ring-3 focus:ring-brand-soft-2 " +
  "disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-ink-3";

function borderFor(invalid?: boolean) {
  return invalid ? "border-danger focus:border-danger focus:ring-danger-soft" : "border-line-strong";
}

type FieldProps = {
  label: string;
  htmlFor: string;
  hint?: ReactNode;
  error?: string | null;
  optional?: boolean;
  children: ReactNode;
  className?: string;
};

/** Label + control + hint or error. The error text replaces the hint. */
export function Field({ label, htmlFor, hint, error, optional, children, className }: FieldProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-sm font-medium text-ink">
        {label}
        {optional ? <span className="ml-1 font-normal text-ink-3">(optional)</span> : null}
      </label>
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} role="alert" className="text-xs font-medium text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${htmlFor}-hint`} className="text-xs text-ink-3">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

type InputProps = ComponentProps<"input"> & { invalid?: boolean };

export function TextInput({ className, invalid, ...props }: InputProps) {
  return (
    <input
      aria-invalid={invalid || undefined}
      className={cn(control, "h-10", borderFor(invalid), className)}
      {...props}
    />
  );
}

type TextAreaProps = ComponentProps<"textarea"> & { invalid?: boolean };

export function TextArea({ className, invalid, ...props }: TextAreaProps) {
  return (
    <textarea
      aria-invalid={invalid || undefined}
      className={cn(control, "min-h-24 py-2.5 leading-relaxed", borderFor(invalid), className)}
      {...props}
    />
  );
}

type SelectProps = ComponentProps<"select"> & { invalid?: boolean };

export function Select({ className, invalid, children, ...props }: SelectProps) {
  return (
    <div className={cn("relative", className)}>
      <select
        className={cn(control, "h-10 appearance-none pr-9", borderFor(invalid))}
        {...props}
      >
        {children}
      </select>
      <svg
        aria-hidden
        viewBox="0 0 16 16"
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-ink-3"
      >
        <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    </div>
  );
}

type CheckboxProps = Omit<ComponentProps<"input">, "type"> & { label: ReactNode; description?: ReactNode };

export function Checkbox({ label, description, id, className, ...props }: CheckboxProps) {
  return (
    <label htmlFor={id} className={cn("flex cursor-pointer items-start gap-2.5", className)}>
      <input
        id={id}
        type="checkbox"
        className="focus-ring mt-0.5 size-4 shrink-0 cursor-pointer rounded-xs accent-brand"
        {...props}
      />
      <span className="flex flex-col">
        <span className="text-sm text-ink">{label}</span>
        {description ? <span className="text-xs text-ink-3">{description}</span> : null}
      </span>
    </label>
  );
}
