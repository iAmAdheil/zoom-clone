import type { ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";

type FormRowProps = {
  label: string;
  htmlFor?: string;
  children: ReactNode;
  error?: string;
  errorId?: string;
};

/** Zoom portal form row: label on the left (desktop) or on top (phone). */
export function FormRow({ label, htmlFor, children, error, errorId }: FormRowProps) {
  const labelClass = "pt-2.5 text-sm font-bold text-ink-2";
  return (
    <div className="grid gap-1.5 border-b border-line py-5 last:border-b-0 sm:grid-cols-[160px_1fr] sm:gap-6">
      {htmlFor ? (
        <label htmlFor={htmlFor} className={labelClass}>
          {label}
        </label>
      ) : (
        <p className={labelClass}>{label}</p>
      )}
      <div className="flex min-w-0 flex-col gap-2">
        {children}
        {error ? (
          <p id={errorId} role="alert" className="flex items-center gap-1 text-xs text-danger">
            <Icon name="alert" size={14} />
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
