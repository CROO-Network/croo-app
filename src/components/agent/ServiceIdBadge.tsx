"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";
import { Check, Copy } from "lucide-react";

const COPIED_RESET_MS = 1500;

function formatServiceIdDisplay(serviceId: string): string {
  const id = serviceId.trim();
  if (id.length <= 8) return id;
  return `${id.slice(0, 8)}...`;
}

interface ServiceIdBadgeProps {
  serviceId: string;
}

/**
 * Compact service_id badge for service list rows: truncated label, hover tooltip,
 * click-to-copy with green success state. Stops propagation so parent row clicks
 * do not open the edit dialog.
 */
export function ServiceIdBadge({ serviceId }: ServiceIdBadgeProps) {
  const fullId = serviceId.trim();
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  if (!fullId) return null;

  const handleClick = async (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    e.preventDefault();
    try {
      await navigator.clipboard.writeText(fullId);
    } catch {
      return;
    }
    setCopied(true);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setCopied(false), COPIED_RESET_MS);
  };

  return (
    <span className="group/badge relative inline-flex shrink-0">
      <button
        type="button"
        onClick={handleClick}
        aria-label={copied ? "Service ID copied" : "Copy service ID"}
        className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 font-mono text-[10px] leading-none transition-colors ${
          copied
            ? "border-[#6EE646] bg-[#F0FDF4] text-[#2D6A1E]"
            : "border-[#E2E2E0] bg-[#F5F5F3] text-[#6B6B6B] hover:border-[#C4C4C2] hover:text-[#0F0F0F]"
        }`}
      >
        <span>{formatServiceIdDisplay(fullId)}</span>
        {copied ? (
          <Check className="h-3 w-3 shrink-0 text-[#6EE646]" strokeWidth={2.5} aria-hidden />
        ) : (
          <Copy className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
        )}
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-md bg-[#0F0F0F] px-2 py-1 font-mono text-[10px] text-white opacity-0 shadow-md transition-opacity duration-150 group-hover/badge:opacity-100"
      >
        {fullId}
      </span>
    </span>
  );
}
