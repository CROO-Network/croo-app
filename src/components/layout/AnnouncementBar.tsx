"use client";

import { ArrowRight, Trophy } from "lucide-react";

export const HACKATHON_RESULTS_URL =
  "https://x.com/CROONetwork/status/2080195168687526173";

/**
 * Full-width announcement strip above the nav inside the fixed header.
 * The Header renders a matching 40px flow spacer so page content keeps its
 * existing clearance below the taller fixed header.
 */
export default function AnnouncementBar() {
  return (
    <a
      href={HACKATHON_RESULTS_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="group relative block h-10 w-full overflow-hidden bg-[#0F0F0F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#6EE646]"
    >
      <div
        className="pointer-events-none absolute inset-y-0 right-0 w-1/2"
        style={{
          background:
            "radial-gradient(ellipse at right, rgba(110,230,70,0.22) 0%, transparent 70%)",
        }}
      />

      <div className="relative mx-auto flex h-full max-w-7xl items-center justify-center gap-2.5 px-6">
        <Trophy
          className="h-3.5 w-3.5 shrink-0 text-[#6EE646]"
          strokeWidth={1.8}
          aria-hidden
        />
        <span className="hidden font-mono text-[10px] uppercase tracking-[0.18em] text-[#6EE646] sm:inline">
          Hackathon
        </span>
        <span className="hidden text-[#3A3A3A] sm:inline" aria-hidden>
          ·
        </span>
        <span className="truncate text-xs font-medium text-white sm:text-[13px]">
          The CROO Agent Hackathon results are in
        </span>
        <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-[#6EE646] transition-transform group-hover:translate-x-0.5 motion-reduce:transform-none motion-reduce:transition-none">
          <span className="hidden sm:inline">View on X</span>
          <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden />
        </span>
      </div>
    </a>
  );
}
