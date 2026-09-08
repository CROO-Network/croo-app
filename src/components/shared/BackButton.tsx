"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getBackInfo } from "@/lib/navigation";

interface BackButtonProps {
  className?: string;
}

/**
 * Dynamic back button that reads the previously visited path from
 * sessionStorage (populated by NavigationTracker in root layout) and
 * shows a context-aware label: "Back to Store", "Back to Agents", etc.
 *
 * Label is resolved after mount so SSR and the first client paint both use
 * "Back" and avoid hydration mismatch (sessionStorage is client-only).
 */
export default function BackButton({ className }: BackButtonProps) {
  const router = useRouter();
  const [label, setLabel] = useState("Back");

  useEffect(() => {
    setLabel(getBackInfo().label);
  }, []);

  return (
    <button
      onClick={() => router.back()}
      className={`inline-flex items-center gap-1.5 text-sm text-[#9A9A9A] hover:text-[#0F0F0F] transition-colors ${className ?? ""}`}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path
          d="M10 4L6 8l4 4"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {label}
    </button>
  );
}
