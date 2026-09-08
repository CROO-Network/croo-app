"use client";

import { useCallback, type ReactNode } from "react";
import { useToast } from "./Toast";

interface CopyableTextProps {
  /** Full string written to the clipboard (children may be a truncated display). */
  value: string;
  /** Label for the success toast: "{label} copied". Defaults to "Copied". */
  label?: string;
  /** Class names for the trigger — caller controls typography/color. */
  className?: string;
  children: ReactNode;
}

/**
 * Click-to-copy wrapped around arbitrary inline text. The display (children)
 * is decoupled from the copied `value` so callers can show a truncated/pretty
 * form while still copying the canonical string.
 */
export default function CopyableText({
  value,
  label,
  className,
  children,
}: CopyableTextProps) {
  const { showToast } = useToast();

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard?.writeText(value);
      showToast(label ? `${label} copied` : "Copied");
    } catch {
      showToast("Copy failed");
    }
  }, [value, label, showToast]);

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={`Copy ${label ?? value}`}
      className={`hover:underline underline-offset-2 transition-colors cursor-pointer ${className ?? ""}`}
    >
      {children}
    </button>
  );
}
