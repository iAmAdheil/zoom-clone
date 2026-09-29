"use client";

import { useEffect, useState } from "react";
import { Button, type ButtonSize, type ButtonVariant } from "./Button";

/** Copies text and shows "Copied" for two seconds. */
export function CopyButton({
  text,
  label = "Copy link",
  variant = "secondary",
  size = "sm",
  className,
}: {
  text: string;
  label?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(t);
  }, [copied]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Clipboard can fail on http or in a sandbox. The mockup still shows the state.
    }
    setCopied(true);
  }

  return (
    <Button
      variant={variant}
      size={size}
      icon={copied ? "check" : "copy"}
      onClick={copy}
      className={className}
      aria-live="polite"
    >
      {copied ? "Copied" : label}
    </Button>
  );
}
