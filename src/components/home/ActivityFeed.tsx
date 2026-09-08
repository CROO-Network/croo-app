"use client";

import { useState, useEffect } from "react";
import { ChevronDown, Clock } from "lucide-react";
import type { ActivityEvent } from "@/lib/mock-data";
import { PriceMark } from "@/components/shared/PriceValue";
import { ResolvedAgentAvatar } from "@/components/shared/ResolvedAgentAvatar";
import { useChain } from "@/lib/chain-context";
import { bscScanTxUrl } from "@/lib/chains";
import { listLiveFeedEvents } from "@/lib/api/discovery";
import { liveFeedItemToActivityEvent } from "@/lib/live-feed-mapper";
import { discoveryMoneyText } from "@/lib/formatters";
import { DiscoveryMoney } from "@/components/shared/PriceValue";
import OrderTimelineView from "@/components/shared/OrderTimelineView";

// ── Status badge ───────────────────────────────────────────────────────────

const statusConfig: Record<
  string,
  { label: string; className: string }
> = {
  success: {
    label: "Completed",
    className: "bg-[#6EE646]/15 text-[#3D8C1F]",
  },
  failed: {
    label: "Failed",
    className: "bg-red-50 text-red-600",
  },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = statusConfig[status];
  if (!cfg) return null;
  return (
    <span
      className={`inline-flex items-center text-[10px] font-mono font-medium px-2 py-0.5 rounded-full shrink-0 ${cfg.className}`}
    >
      {cfg.label}
    </span>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────

function getRowText(event: ActivityEvent, discoveryAmount: boolean): string {
  switch (event.type) {
    case "order_completed":
      return event.serviceName
        ? `${event.agentName} · ${event.serviceName}`
        : `${event.agentName} completed order ${event.orderId}`;
    case "agent_joined":
      return `${event.agentName} joined the network`;
    case "order_expired":
      return event.serviceName
        ? `${event.agentName} · ${event.serviceName}`
        : `Order ${event.orderId} for ${event.agentName} expired`;
    case "order_locked":
      return event.serviceName
        ? `${event.agentName} · ${event.serviceName}`
        : `Order update · ${event.agentName}`;
    case "x402_paid": {
      const amt = discoveryAmount
        ? discoveryMoneyText(event.amount) ?? ""
        : event.amount != null && event.amount > 0
          ? `$${event.amount.toFixed(2)}`
          : "";
      return amt ? `${event.agentName} was paid ${amt}` : `${event.agentName} paid`;
    }
    default:
      return `${event.agentName} activity`;
  }
}

const LIVE_FEED_POLL_MS = 10_000;

// ── Main component ─────────────────────────────────────────────────────────

export default function ActivityFeed() {
  const { chain, isInteractive } = useChain();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedError, setFeedError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchFeed = async (isInitial: boolean) => {
      if (isInitial) {
        setLoading(true);
        setFeedError(null);
      }
      try {
        const res = await listLiveFeedEvents(1, 10, chain);
        if (cancelled) return;
        const mapped = (res.items || []).map(liveFeedItemToActivityEvent);
        setEvents(mapped);
        setFeedError(null);
      } catch {
        if (!cancelled) {
          if (isInitial) {
            setEvents([]);
            setFeedError("Could not load live feed.");
          }
        }
      } finally {
        if (!cancelled && isInitial) setLoading(false);
      }
    };

    void fetchFeed(true);
    const interval = setInterval(() => void fetchFeed(false), LIVE_FEED_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [chain]);

  const hasTimeline = (event: ActivityEvent) =>
    isInteractive && !!event.timeline && event.timeline.length > 0;

  return (
    <section className="pb-6">
      {/* Section header */}
      <div className="flex items-center gap-2 mb-4">
        <span className="w-5 h-px bg-[#6EE646]" />
        <span className="text-xs font-mono text-[#6EE646] uppercase tracking-widest">
          Network Activity
        </span>
      </div>
      <h3 className="text-lg font-semibold text-[#0F0F0F] tracking-tight mb-4">
        Live Feed
      </h3>

      {feedError && (
        <p className="text-xs text-amber-700 font-mono mb-2">{feedError}</p>
      )}

      <div className="bg-white border border-[#E2E2E0] rounded-2xl overflow-hidden">
        {loading ? (
          <div className="px-5 py-10 text-center text-sm text-[#9A9A9A]">Loading activity…</div>
        ) : events.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-[#9A9A9A]">No activity yet.</div>
        ) : (
        events.map((event, index) => {
          const isExpanded = expandedId === event.id;
          const canExpand = hasTimeline(event);

          return (
            <div
              key={event.id}
              className={index < events.length - 1 ? "border-b border-[#F0F0EE]" : ""}
            >
              {/* Row */}
              <div
                className={`flex items-center gap-3 px-4 py-3 ${
                  canExpand ? "cursor-pointer hover:bg-[#FAFAF9]" : ""
                } transition-colors`}
                onClick={() => {
                  if (canExpand) {
                    setExpandedId(isExpanded ? null : event.id);
                  }
                }}
              >
                {/* Avatar */}
                {event.agentAvatar ? (
                  <ResolvedAgentAvatar
                    avatar={event.agentAvatar}
                    name={event.agentName}
                    alt={event.agentName}
                    className="w-7 h-7 rounded-full shrink-0 bg-[#F5F5F3]"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-[#E2E2E0] shrink-0" />
                )}

                {/* Text + inline status + duration */}
                <div className="flex-1 flex items-center gap-2 min-w-0">
                  <p className="text-sm text-[#3A3A3A] min-w-0 truncate">
                    {getRowText(event, !isInteractive)}
                  </p>
                  {event.orderStatus && (
                    <StatusBadge status={event.orderStatus === "not_passed" ? "failed" : event.orderStatus} />
                  )}
                  {event.duration && (
                    <span className="inline-flex items-center gap-0.5 text-[11px] font-mono text-[#9A9A9A] shrink-0 tabular-nums hidden sm:inline-flex">
                      <Clock className="h-3 w-3" />
                      {event.duration}
                    </span>
                  )}
                </div>

                {/* Amount */}
                {event.amount != null && (isInteractive || discoveryMoneyText(event.amount)) && (
                  event.payTxHash ? (
                    <a
                      href={bscScanTxUrl(event.payTxHash)}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-sm font-mono font-semibold shrink-0 tabular-nums text-[#0F0F0F] inline-flex items-center gap-0.5 hover:text-[#3D8C1F]"
                    >
                      {!isInteractive ? (
                        <DiscoveryMoney amount={event.amount} />
                      ) : (
                        <>
                          <PriceMark size={13} />
                          {event.amount.toFixed(2)}
                        </>
                      )}
                    </a>
                  ) : (
                    <span className="text-sm font-mono font-semibold shrink-0 tabular-nums text-[#0F0F0F] inline-flex items-center gap-0.5">
                      {!isInteractive ? (
                        <DiscoveryMoney amount={event.amount} />
                      ) : (
                        <>
                          <PriceMark size={13} />
                          {event.amount.toFixed(2)}
                        </>
                      )}
                    </span>
                  )
                )}

                {/* Relative time */}
                <span className="text-[11px] font-mono text-[#9A9A9A] shrink-0 tabular-nums">
                  {event.relativeTime}
                </span>

                {/* Expand chevron */}
                {canExpand && (
                  <ChevronDown
                    className={`h-4 w-4 text-[#9A9A9A] shrink-0 transition-transform duration-200 ${
                      isExpanded ? "rotate-180" : ""
                    }`}
                  />
                )}
              </div>

              {/* Expanded timeline */}
              {isExpanded && event.timeline && (
                <div className="bg-[#FAFAF9] border-t border-[#F0F0EE]">
                  <OrderTimelineView events={event.timeline} />
                </div>
              )}
            </div>
          );
        })
        )}
      </div>
    </section>
  );
}
