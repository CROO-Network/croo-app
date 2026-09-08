"use client";

import { useEffect, useRef, useState } from "react";

interface CopyButtonProps {
  value: string;
  label?: string;
}

export default function CopyButton({ value, label }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<number | null>(null);
  const actionLabel = label ? `Copy ${label}` : "Copy";

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(value);

    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
    }

    setCopied(true);
    timeoutRef.current = window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <span className="relative inline-flex items-center">
      <button
        type="button"
        onClick={handleCopy}
        className="inline-flex items-center justify-center text-[#9A9A9A] transition-colors hover:text-[#0F0F0F]"
        title={copied ? "Copied" : actionLabel}
        aria-label={copied ? "Copied" : actionLabel}
      >
        {copied ? (
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path
              d="M3 8.5l3 3 7-7"
              stroke="#6EE646"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : (
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <rect
              x="5"
              y="5"
              width="8"
              height="8"
              rx="1.5"
              stroke="currentColor"
              strokeWidth="1.3"
            />
            <path
              d="M3 11V3.5A.5.5 0 013.5 3H11"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinecap="round"
            />
          </svg>
        )}
      </button>

      <span
        aria-live="polite"
        className={`pointer-events-none absolute left-full top-1/2 ml-2 -translate-y-1/2 rounded-full bg-[#0F0F0F] px-2 py-0.5 text-[9px] font-mono uppercase tracking-[0.16em] text-white transition-all duration-200 ${
          copied ? "translate-x-0 opacity-100" : "-translate-x-1 opacity-0"
        }`}
      >
        Copied
      </span>
    </span>
  );
}
