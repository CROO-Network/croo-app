"use client";

import type { OrderEvent } from "@/lib/mock-data";
import { formatOrderTimelineTime } from "@/lib/formatters";
import { orderPhaseColor, orderPhaseLabel, showsOrderPhaseTxLink } from "@/lib/order-timeline";

type OrderTimelineViewProps = {
  events: OrderEvent[];
  className?: string;
};

/** Order CAP stepper — shared by Live Feed and Agent Activity. */
export default function OrderTimelineView({ events, className }: OrderTimelineViewProps) {
  return (
    <div className={className ?? "pl-12 pr-4 pb-4 pt-1"}>
      <div className="relative ml-1">
        {events.map((evt, i) => {
          const color = orderPhaseColor[evt.phase] || "#9A9A9A";
          const label = orderPhaseLabel[evt.phase] || evt.phase;
          const isLast = i === events.length - 1;

          return (
            <div key={i} className="relative flex items-start gap-4 pb-4 last:pb-0">
              {!isLast && (
                <div
                  className="absolute left-[5px] top-[14px] w-px"
                  style={{
                    backgroundColor: color,
                    opacity: 0.3,
                    height: "calc(100% - 4px)",
                  }}
                />
              )}

              <div
                className="relative z-10 mt-[5px] h-[11px] w-[11px] rounded-full shrink-0"
                style={{ backgroundColor: color }}
              />

              <div className="flex flex-1 items-start gap-3 min-w-0">
                <span
                  className="text-xs font-mono font-semibold uppercase w-14 shrink-0"
                  style={{ color }}
                >
                  {label}
                </span>
                <span className="inline-block w-[9.75rem] shrink-0 text-left text-[11px] font-mono text-[#9A9A9A] tabular-nums">
                  {formatOrderTimelineTime(evt.timestamp)}
                </span>
                <span className="min-w-0 flex-1 text-xs text-[#6B6B6B] truncate">{evt.detail}</span>
                <div className="flex w-[4.25rem] shrink-0 items-start justify-end">
                  {showsOrderPhaseTxLink(evt) ? (
                    <a
                      href={`https://basescan.org/tx/${evt.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-0.5 text-[11px] font-mono text-[#3B82F6] transition-colors hover:text-[#2563EB]"
                    >
                      View Tx
                      <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                        <path
                          d="M4.5 2.5H9.5V7.5M9.5 2.5L2.5 9.5"
                          stroke="currentColor"
                          strokeWidth="1.2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </a>
                  ) : (
                    <span
                      className="pointer-events-none invisible inline-flex items-center gap-0.5 text-[11px] font-mono"
                      aria-hidden
                    >
                      View Tx
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
