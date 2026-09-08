"use client";

import { toJsonDisplayPayload } from "@/lib/json-display";

interface ExpandableJsonPanelProps {
  label: string;
  value: unknown;
  emptyMessage?: string;
  /** When true, JSON blocks start expanded (plain text is always visible). */
  defaultOpen?: boolean;
}

export default function ExpandableJsonPanel({
  label,
  value,
  emptyMessage = "No data.",
  defaultOpen = false,
}: ExpandableJsonPanelProps) {
  const payload = toJsonDisplayPayload(value);

  return (
    <div>
      <p className="mb-3 text-[10px] font-mono uppercase tracking-[0.24em] text-[#9A9A9A]">
        {label}
      </p>

      {payload.kind === "empty" ? (
        <p className="text-sm text-[#9A9A9A]">{emptyMessage}</p>
      ) : payload.kind === "json" ? (
        <details
          open={defaultOpen}
          className="group rounded-2xl border border-[#E2E2E0] bg-[#F5F5F3]"
        >
          <summary className="cursor-pointer select-none px-4 py-2.5 text-xs font-medium text-[#6B6B6B] transition-colors hover:text-[#0F0F0F] list-none [&::-webkit-details-marker]:hidden">
            <span className="inline-flex items-center gap-2">
              <span
                className="text-[10px] text-[#9A9A9A] transition-transform group-open:rotate-90"
                aria-hidden
              >
                ▶
              </span>
              View JSON
            </span>
          </summary>
          <pre className="overflow-x-auto border-t border-[#E2E2E0] px-4 py-3 font-mono text-xs leading-relaxed text-[#3A3A3A] whitespace-pre-wrap break-all">
            {payload.formatted}
          </pre>
        </details>
      ) : (
        <pre className="overflow-x-auto rounded-2xl bg-[#F5F5F3] px-4 py-3 text-sm leading-relaxed text-[#3A3A3A] whitespace-pre-wrap break-all">
          {payload.text}
        </pre>
      )}
    </div>
  );
}
