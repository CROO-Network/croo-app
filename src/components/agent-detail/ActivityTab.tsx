"use client";

import { useState, useEffect } from "react";
import StatusBadge from "@/components/shared/StatusBadge";
import OrderTimelineView from "@/components/shared/OrderTimelineView";
import { discoveryMoneyText, truncateAddress } from "@/lib/formatters";
import { DiscoveryMoney } from "@/components/shared/PriceValue";
import type { Order } from "@/lib/mock-data";
import { getPublicAgentActivity } from "@/lib/api/discovery";
import { publicActivityItemToOrder } from "@/lib/order-activity-mapper";
import { PriceMark } from "@/components/shared/PriceValue";
import { useChain } from "@/lib/chain-context";
import { bscScanTxUrl, isDiscoveryChain, type ChainId } from "@/lib/chains";

interface ActivityTabProps {
  agentId: string;
  agentName: string;
  chain?: ChainId;
}

const PAGE_SIZE = 5;

function formatOrderTitle(orderId: string): string {
  if (!orderId) return "#—";
  const compact =
    orderId.length > 22 ? `${orderId.slice(0, 10)}…${orderId.slice(-6)}` : orderId;
  if (compact.startsWith("#") || compact.startsWith("0x") || compact.includes(":")) return compact;
  return `#${compact}`;
}

function OrderRow({
  order,
  canExpand,
  discoveryAmount,
}: {
  order: Order;
  canExpand: boolean;
  discoveryAmount: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-white border border-[#E2E2E0] rounded-2xl overflow-hidden hover:border-[#E2E2E0]/80 transition-all duration-150">
      {/* Summary row */}
      <button
        onClick={() => {
          if (canExpand) setExpanded(!expanded);
        }}
        className="w-full px-5 py-4 flex items-center gap-3 text-left"
        disabled={!canExpand}
      >
        {/* Order ID + Amount */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <span className="text-sm font-mono font-semibold text-[#0F0F0F] shrink-0">
            {formatOrderTitle(order.id)}
          </span>
          {order.status !== "feedback" && (!discoveryAmount || discoveryMoneyText(order.amount)) && (
            <span className="flex items-center gap-0.5 text-sm font-mono text-[#0F0F0F] shrink-0">
              {discoveryAmount ? (
                <DiscoveryMoney amount={order.amount} />
              ) : (
                <>
                  <PriceMark size={13} />
                  {order.amount.toFixed(2)}
                </>
              )}
            </span>
          )}
          <StatusBadge status={order.status} size="sm" />
          <span className="text-xs text-[#9A9A9A] shrink-0">{order.relativeTime}</span>
        </div>

        {canExpand && (
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            className={`shrink-0 text-[#9A9A9A] transition-transform duration-200 ${
              expanded ? "rotate-180" : ""
            }`}
          >
            <path
              d="M4 5.5l3 3 3-3"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </button>

      {/* Second line: Buyer + Service */}
      <div className="px-5 -mt-2 pb-3 flex items-center gap-2 text-xs text-[#9A9A9A]">
        <span className="font-mono">{truncateAddress(order.buyerWallet)}</span>
        {!discoveryAmount && order.serviceName ? (
          <>
            <span>·</span>
            <span className="truncate">{order.serviceName}</span>
          </>
        ) : null}
        {order.payTxHash ? (
          <>
            <span>·</span>
            <a
              href={bscScanTxUrl(order.payTxHash)}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-[#3D8C1F] hover:underline"
            >
              Tx
            </a>
          </>
        ) : null}
      </div>

      {canExpand && expanded && order.timeline.length > 0 && (
        <div className="bg-[#FAFAF9] border-t border-[#F0F0EE]">
          <OrderTimelineView events={order.timeline} />
        </div>
      )}
    </div>
  );
}

// ── Pagination controls ──────────────────────────────────────────────────────

function Pagination({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (p: number) => void;
}) {
  if (totalPages <= 1) return null;

  // Build page number list (show at most 5 pages centred on current)
  const pages: (number | "…")[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (page > 3) pages.push("…");
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) {
      pages.push(i);
    }
    if (page < totalPages - 2) pages.push("…");
    pages.push(totalPages);
  }

  return (
    <div className="flex items-center justify-between pt-4">
      <span className="text-xs text-[#9A9A9A] font-mono">
        Page {page} of {totalPages}
      </span>

      <div className="flex items-center gap-1">
        {/* Prev */}
        <button
          onClick={() => onChange(page - 1)}
          disabled={page === 1}
          className="h-8 w-8 rounded-full border border-[#E2E2E0] flex items-center justify-center text-[#6B6B6B] hover:border-[#6EE646]/50 hover:text-[#0F0F0F] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M8 3L5 6l3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {/* Page numbers */}
        {pages.map((p, i) =>
          p === "…" ? (
            <span key={`dots-${i}`} className="h-8 w-8 flex items-center justify-center text-[11px] text-[#9A9A9A]">
              …
            </span>
          ) : (
            <button
              key={p}
              onClick={() => onChange(p as number)}
              className={`h-8 w-8 rounded-full text-xs font-medium transition-colors ${
                p === page
                  ? "bg-[#0F0F0F] text-white"
                  : "border border-[#E2E2E0] text-[#6B6B6B] hover:border-[#6EE646]/50 hover:text-[#0F0F0F]"
              }`}
            >
              {p}
            </button>
          )
        )}

        {/* Next */}
        <button
          onClick={() => onChange(page + 1)}
          disabled={page === totalPages}
          className="h-8 w-8 rounded-full border border-[#E2E2E0] flex items-center justify-center text-[#6B6B6B] hover:border-[#6EE646]/50 hover:text-[#0F0F0F] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M4 3l3 3-3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// ── Main export ──────────────────────────────────────────────────────────────

export default function ActivityTab({ agentId, agentName, chain }: ActivityTabProps) {
  const { isInteractive } = useChain();
  const canExpand = isInteractive && !isDiscoveryChain(chain);
  const [page, setPage] = useState(1);
  const [agentOrders, setAgentOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await getPublicAgentActivity(agentId, { page, page_size: PAGE_SIZE, chain });
        if (cancelled) return;
        setTotal(Number(res.total) || 0);
        setAgentOrders((res.items || []).map((row) => publicActivityItemToOrder(row, agentName)));
      } catch {
        if (!cancelled) {
          setTotal(0);
          setAgentOrders([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [agentId, agentName, page, chain]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const visibleOrders = agentOrders;

  const handlePageChange = (p: number) => {
    setPage(p);
    document.getElementById("activity-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  if (loading) {
    return (
      <div className="bg-white border border-[#E2E2E0] rounded-2xl p-12 text-center">
        <p className="text-sm text-[#9A9A9A]">Loading activity…</p>
      </div>
    );
  }

  if (total === 0) {
    return (
      <div className="bg-white border border-[#E2E2E0] rounded-2xl p-12 text-center">
        <p className="text-sm text-[#9A9A9A]">No activity yet</p>
      </div>
    );
  }

  return (
    <div>
      <div className="space-y-3">
        {visibleOrders.map((order) => (
          <OrderRow
            key={order.id}
            order={order}
            canExpand={canExpand}
            discoveryAmount={isDiscoveryChain(chain)}
          />
        ))}
      </div>

      <Pagination page={page} totalPages={totalPages} onChange={handlePageChange} />
    </div>
  );
}
