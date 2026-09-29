import { Icon } from "./Icon";

type ToastProps = { message: string | null; offset?: string; tone?: "success" | "error" };

/** Bottom-center status message. Screen readers hear it through role="status". */
export function Toast({ message, offset = "bottom-6", tone = "success" }: ToastProps) {
  return (
    <div role="status" aria-live="polite" className="pointer-events-none">
      {message ? (
        <div
          className={`animate-toast-in fixed left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-md bg-ink px-4 py-2.5 text-sm text-white shadow-popover ${offset}`}
        >
          {tone === "error" ? (
            <Icon name="alert" size={16} className="text-danger" />
          ) : (
            <Icon name="check" size={16} className="text-success" />
          )}
          {message}
        </div>
      ) : null}
    </div>
  );
}
