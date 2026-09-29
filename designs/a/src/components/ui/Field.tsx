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

/** Checkbox or radio with a label and an optional description line. */
export function Check({ label, description, type = "checkbox", className, id, ...rest }: CheckProps) {
  return (
    <label htmlFor={id} className={cn("flex cursor-pointer items-start gap-2.5 text-sm", className)}>
      <input
        id={id}
        type={type}
        className="mt-0.5 size-4 shrink-0 cursor-pointer accent-primary"
        {...rest}
      />
      <span className="flex flex-col gap-0.5">
        <span className="text-ink">{label}</span>
        {description ? <span className="text-xs text-ink-muted">{description}</span> : null}
      </span>
    </label>
  );
}
