"use client";

/* eslint-disable @next/next/no-img-element */

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import FilterPills from "@/components/shared/FilterPills";
import Reveal from "@/components/shared/Reveal";
import SectionHeader from "@/components/shared/SectionHeader";
import StatusBadge from "@/components/shared/StatusBadge";
import ExpandableJsonPanel from "@/components/shared/ExpandableJsonPanel";
import UsdcIcon from "@/components/shared/UsdcIcon";
import { formatUsdc } from "@/lib/formatters";
import { listMyOrders, getMyOrder } from "@/lib/api/order";
import { orderInfoToMyOrder } from "@/lib/my-order-mapper";
import { mapOrderRowsToMyOrders } from "@/lib/order-list-utils";
import { showsOrderPhaseTxLink } from "@/lib/order-timeline";
import type { MyOrder, OrderEvent } from "@/lib/mock-data";

type OrderFilter = "all" | "in_progress" | "completed" | "failed";

const ORDER_PAGE_SIZE = 3;

const orderFilters: Array<{ key: OrderFilter; label: string }> = [
  { key: "all", label: "All" },
  { key: "in_progress", label: "In Progress" },
  { key: "completed", label: "Completed" },
  { key: "failed", label: "Failed" },
];

const phaseConfig: Record<
  OrderEvent["phase"],
  { label: string; marker: string; color: string }
> = {
  lock: { label: "Lock", marker: "●", color: "text-[#2775CA]" },
  deliver: { label: "Deliver", marker: "●", color: "text-[#F59E0B]" },
  clear: { label: "Clear", marker: "●", color: "text-[#3D8C1F]" },
  expired: { label: "Expired", marker: "✕", color: "text-[#F97316]" },
  deliver_failed: { label: "Failed", marker: "✕", color: "text-[#E54D2E]" },
};

function formatTimelineTimestamp(timestamp: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T/.test(timestamp)) return timestamp;

  const d = new Date(timestamp);
  if (!Number.isFinite(d.getTime())) return timestamp;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

function formatAccountOrderTimelineTimestamp(timestamp: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T/.test(timestamp)) {
    return formatTimelineTimestamp(timestamp);
  }

  const d = new Date(timestamp);
  if (!Number.isFinite(d.getTime())) {
    return formatTimelineTimestamp(timestamp);
  }

  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
}

function TimelineEvent({ event, isLast }: { event: OrderEvent; isLast: boolean }) {
  const phase = phaseConfig[event.phase];

  return (
    <div className="flex gap-3">
      {/* Left column: dot centered, then connector line below */}
      <div className="flex flex-col items-center w-4 shrink-0">
        <span
          className={`text-[10px] leading-none shrink-0 mt-[3px] ${phase.color}`}
          aria-hidden="true"
        >
          {phase.marker}
        </span>
        {!isLast && (
          <div className="w-px flex-1 bg-[#E2E2E0] mt-1.5" />
        )}
      </div>

      {/* Content */}
      <div className={`flex-1 min-w-0 ${!isLast ? "pb-4" : ""}`}>
        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-xs font-medium uppercase tracking-[0.16em] text-[#0F0F0F]">
                {phase.label}
              </span>
              <span className="text-xs text-[#9A9A9A]">
                {formatAccountOrderTimelineTimestamp(event.timestamp)}
              </span>
            </div>
            <p className="mt-1 text-sm text-[#6B6B6B]">{event.detail}</p>
          </div>

          {showsOrderPhaseTxLink(event) && (
            <a
              href={`https://basescan.org/tx/${event.txHash}`}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex shrink-0 items-center gap-1 text-[11px] font-mono uppercase tracking-[0.18em] text-[#2775CA] transition-colors hover:text-[#1A5CA0]"
            >
              View Tx
              <svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                <path
                  d="M4.5 2.5h5m0 0v5m0-5L3 9"
                  stroke="currentColor"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function DeliverResult({ order }: { order: MyOrder }) {
  if (!order.deliverResult?.trim()) {
    return null;
  }

  return (
    <ExpandableJsonPanel
      label="Deliver Result"
      value={order.deliverResult}
      emptyMessage="No delivery result yet."
    />
  );
}

function ExpandedOrderBody({ order }: { order: MyOrder }) {
  return (
    <div className="border-t border-[#F0F0EE] px-5 py-4">
      <div className="space-y-6">
        <div>
          <p className="mb-3 text-[10px] font-mono uppercase tracking-[0.24em] text-[#9A9A9A]">
            Price Breakdown
          </p>
          <div className="rounded-2xl bg-[#F5F5F3] px-4 py-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-[#9A9A9A]">Price</span>
              <span className="text-sm font-mono font-medium tabular-nums text-[#0F0F0F]">${order.price.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-[#9A9A9A]">Gas</span>
              <span className="text-sm font-mono tabular-nums text-[#9A9A9A]">${order.gas.toFixed(2)}</span>
            </div>
            <div className="border-t border-[#E2E2E0] pt-2 flex items-center justify-between">
              <span className="text-xs font-medium text-[#0F0F0F]">Total</span>
              <span className="text-sm font-mono font-semibold tabular-nums text-[#0F0F0F]">${order.total.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div>
          <p className="mb-3 text-[10px] font-mono uppercase tracking-[0.24em] text-[#9A9A9A]">
            CAP Timeline
          </p>
          <div className="flex flex-col">
            {order.timeline.length === 0 ? (
              <p className="text-sm text-[#9A9A9A]">No timeline loaded yet.</p>
            ) : (
              order.timeline.map((event, index) => (
                <TimelineEvent
                  key={`${order.id}-${event.phase}-${event.timestamp}`}
                  event={event}
                  isLast={index === order.timeline.length - 1}
                />
              ))
            )}
          </div>
        </div>

        <ExpandableJsonPanel
          label="Requirements"
          value={order.requirementsDisplay ?? order.requirements}
          emptyMessage="No requirement fields on this order."
        />

        <DeliverResult order={order} />
      </div>
    </div>
  );
}

function LoadOrderDetail({
  orderId,
  onLoad,
}: {
  orderId: string;
  onLoad: (orderId: string) => void | Promise<void>;
}) {
  useEffect(() => {
    void onLoad(orderId);
  }, [onLoad, orderId]);

  return null;
}

function OrderCard({
  order,
  expanded,
  onToggle,
  onLoadDetail,
}: {
  order: MyOrder;
  expanded: boolean;
  onToggle: () => void;
  onLoadDetail: (orderId: string) => void;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[#E2E2E0] bg-white transition-colors hover:border-[#6EE646]/35">
      <button
        onClick={onToggle}
        className="w-full px-5 py-4 text-left"
        aria-expanded={expanded}
      >
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-mono text-sm font-semibold text-[#0F0F0F]">
                {order.id}
              </span>

              <div className="flex min-w-0 items-center gap-2">
                <img
                  src={
                    order.agentAvatar ||
                    `https://api.dicebear.com/9.x/identicon/svg?seed=${encodeURIComponent(order.agentId)}`
                  }
                  alt={order.agentName}
                  className="h-6 w-6 rounded-full border border-[#E2E2E0] bg-[#F5F5F3] object-cover"
                />
                <span className="truncate text-sm font-medium text-[#0F0F0F]">
                  {order.agentName}
                </span>
              </div>

              <div className="inline-flex items-center gap-1 text-sm font-semibold text-[#0F0F0F]">
                <UsdcIcon size={14} />
                <span className="font-mono tabular-nums">{formatUsdc(order.total)}</span>
              </div>

              <StatusBadge status={order.status === "deliver_failed" || order.status === "expired" ? "failed" : order.status} />
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-[#6B6B6B]">
              <span>{order.serviceName}</span>
              <span className="hidden sm:inline">•</span>
              <span className="text-[#9A9A9A]">{order.relativeTime}</span>
            </div>
          </div>

          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            className={`shrink-0 text-[#9A9A9A] transition-transform duration-200 ${
              expanded ? "rotate-180" : ""
            }`}
            aria-hidden="true"
          >
            <path
              d="M4.5 6l3.5 3.5L11.5 6"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </button>

      {expanded && order.timeline.length === 0 && (
        <LoadOrderDetail orderId={order.id} onLoad={onLoadDetail} />
      )}
      {expanded && <ExpandedOrderBody order={order} />}
    </div>
  );
}

function orderPassesFilter(order: MyOrder, f: OrderFilter): boolean {
  if (f === "all") return true;
  if (f === "completed") return order.status === "completed";
  if (f === "failed") return order.status === "deliver_failed" || order.status === "expired";
  if (f === "in_progress") return order.status === "in_progress";
  return true;
}

function filterForOrder(order: MyOrder): OrderFilter {
  if (order.status === "completed") return "completed";
  if (order.status === "deliver_failed" || order.status === "expired") return "failed";
  if (order.status === "in_progress") return "in_progress";
  return "all";
}

export default function AccountOrdersPage() {
  const searchParams = useSearchParams();
  const highlightedOrderId = searchParams.get("highlight")?.trim() ?? "";
  const [activeFilter, setActiveFilter] = useState<OrderFilter | null>(null);
  const [visibleCount, setVisibleCount] = useState(ORDER_PAGE_SIZE);
  const [expandedOrders, setExpandedOrders] = useState<string[]>([]);
  const [orders, setOrders] = useState<MyOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const loadOrderDetail = useCallback(async (orderId: string) => {
    try {
      const d = await getMyOrder(orderId);
      setOrders((prev) => {
        const p = prev.find((x) => x.id === orderId);
        const ctx = p
          ? { agentName: p.agentName, agentAvatar: p.agentAvatar, serviceName: p.serviceName }
          : {
              agentName: d.order.providerAgentId,
              agentAvatar: "",
              serviceName: d.order.serviceId || "Service",
            };
        const full = orderInfoToMyOrder(d.order, ctx, d.capTimeline, d.delivery);
        return prev.map((o) => (o.id === orderId ? full : o));
      });
    } catch {
      /* keep row without timeline */
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setListError(null);
      try {
        const res = await listMyOrders({ page: 1, page_size: 100 });
        if (cancelled) return;
        const mapped = await mapOrderRowsToMyOrders(res.orders || []);
        if (!cancelled) setOrders(mapped);
      } catch {
        if (!cancelled) {
          setOrders([]);
          setListError("Could not load orders.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const highlightedOrder = highlightedOrderId
    ? orders.find((order) => order.id === highlightedOrderId)
    : undefined;
  const effectiveFilter = activeFilter ?? (highlightedOrder ? filterForOrder(highlightedOrder) : "all");
  const filteredOrders = orders.filter((o) => orderPassesFilter(o, effectiveFilter));
  const highlightedFilteredIndex = highlightedOrderId
    ? filteredOrders.findIndex((order) => order.id === highlightedOrderId)
    : -1;
  const effectiveVisibleCount =
    highlightedFilteredIndex >= 0
      ? Math.max(visibleCount, ORDER_PAGE_SIZE, highlightedFilteredIndex + 1)
      : visibleCount;
  const visibleOrders = filteredOrders.slice(0, effectiveVisibleCount);
  const hasMoreOrders = filteredOrders.length > effectiveVisibleCount;
  const expandedOrderIds = highlightedOrderId
    ? Array.from(new Set([...expandedOrders, highlightedOrderId]))
    : expandedOrders;

  const toggleExpanded = useCallback(
    async (orderId: string) => {
      if (expandedOrderIds.includes(orderId)) {
        setExpandedOrders((current) => current.filter((id) => id !== orderId));
        return;
      }
      setExpandedOrders((current) => [...current, orderId]);
      await loadOrderDetail(orderId);
    },
    [expandedOrderIds, loadOrderDetail],
  );

  return (
    <div className="space-y-8">
      <Reveal>
        <section>
          <SectionHeader label="My Orders" />

          <div className="mb-6 max-w-full overflow-x-auto pb-1">
            <FilterPills
              items={orderFilters}
              activeKey={effectiveFilter}
              onSelect={(key) => {
                setActiveFilter(key);
                setVisibleCount(ORDER_PAGE_SIZE);
                setExpandedOrders([]);
              }}
            />
          </div>

          {listError && <p className="text-xs text-amber-700 font-mono mb-2">{listError}</p>}

          {loading ? (
            <div className="rounded-2xl border border-[#E2E2E0] bg-white px-6 py-14 text-center text-sm text-[#9A9A9A]">
              Loading orders…
            </div>
          ) : visibleOrders.length > 0 ? (
            <div className="space-y-3">
              {visibleOrders.map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  expanded={expandedOrderIds.includes(order.id)}
                  onLoadDetail={loadOrderDetail}
                  onToggle={() => {
                    void toggleExpanded(order.id);
                  }}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-[#E2E2E0] bg-white px-6 py-14 text-center">
              <p className="text-sm text-[#9A9A9A]">
                {orders.length === 0 ? "You have no orders yet." : "No orders found for this filter."}
              </p>
            </div>
          )}

          {!loading && hasMoreOrders && (
            <div className="mt-6 flex justify-center">
              <button
                type="button"
                onClick={() => setVisibleCount((current) => current + ORDER_PAGE_SIZE)}
                className="rounded-full border border-[#E2E2E0] px-6 py-2 text-sm text-[#0F0F0F] transition-colors hover:border-[#6EE646]/50"
              >
                Load More
              </button>
            </div>
          )}
        </section>
      </Reveal>
    </div>
  );
}
