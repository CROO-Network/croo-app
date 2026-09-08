"use client";

import { useMemo } from "react";
import CopyableText from "@/components/shared/CopyableText";
import StatusBadge from "@/components/shared/StatusBadge";
import { CardShell } from "../primitives";
import type {
  CardState,
  OrderListCardPayload,
  OrderRefStatus,
} from "@/types/navigator";

export interface OrderListCardProps {
  payload: OrderListCardPayload;
  state?: CardState;
  /**
   * @deprecated Order rows are now display-only — clicking is intentionally
   * disabled to avoid misleading users. Kept on the interface so existing
   * callers (e.g. CardRenderer) compile without changes; ignored internally.
   */
  onSelect?: (orderId: string) => void;
}

/**
 * Map raw backend order status (created/paying/paid/delivered/…) onto the
 * 4-state OrderRefStatus the UI cares about. Keeps the badge palette stable
 * regardless of how granular the BE pipeline gets.
 */
function normalizeStatus(raw: string): OrderRefStatus {
  const s = (raw ?? "").toLowerCase();
  if (s === "completed" || s === "delivered" || s === "cleared") return "completed";
  if (s === "expired") return "expired";
  if (
    s === "failed" ||
    s === "rejected" ||
    s === "deliver_failed" ||
    s === "pay_failed" ||
    s === "create_failed" ||
    s === "reject_failed"
  )
    return "failed";
  // created / paying / paid / negotiating / in_progress …
  return "in_progress";
}

/** Truncate Order ID for display: ensure `#` prefix, show ≤10 chars. */
function shortOrderId(id: string): string {
  if (!id) return "";
  if (id.length <= 12) return id.startsWith("#") ? id : `#${id}`;
  return `#${id.slice(0, 8)}…`;
}

/** Short "X ago" formatter — matches mock-data style (`5m ago`, `2h ago`). */
function relativeTime(iso: string): string {
  if (!iso) return "";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  const sec = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (sec < 60) return `${sec}s ago`;
  const m = Math.floor(sec / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

/** Format a USDC amount with `$` prefix (1 USDC ≈ $1). */
function formatPrice(raw: string | undefined): string {
  if (!raw) return "";
  const cleaned = raw.replace(/^\$/, "").trim();
  if (!cleaned) return "";
  return `$${cleaned}`;
}

export function OrderListCard({ payload }: OrderListCardProps) {
  const { orders, pretext, footer } = payload;

  // Memoize relative-time strings so re-renders don't drift (good enough until
  // we add a 1-min ticker).
  const relTimes = useMemo(
    () => orders.map((o) => relativeTime(o.createdAt)),
    [orders],
  );

  if (!orders || orders.length === 0) {
    return (
      <div data-card-kind="order_list" className="space-y-2 w-full">
        {pretext && (
          <p className="text-xs text-[#6B6B6B] leading-relaxed">{pretext}</p>
        )}
        <CardShell>
          <p className="px-4 py-6 text-center text-xs text-[#9A9A9A]">
            You have no orders yet. Search for an agent to get started.
          </p>
        </CardShell>
        {footer && (
          <p className="text-xs text-[#6B6B6B] leading-relaxed">{footer}</p>
        )}
      </div>
    );
  }

  return (
    <div data-card-kind="order_list" className="space-y-2 w-full">
      {pretext && (
        <p className="text-xs text-[#6B6B6B] leading-relaxed">{pretext}</p>
      )}
      <CardShell>
        {orders.map((o, i) => {
          const normStatus = normalizeStatus(o.status);
          return (
            <div
              key={o.orderId ?? `order-${i}`}
              className={`w-full text-left px-4 py-3 ${
                i < orders.length - 1 ? "border-b border-[#F0F0EE]" : ""
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  {o.orderId ? (
                    <CopyableText
                      value={o.orderId}
                      label="Order ID"
                      className="font-mono text-[13px] text-[#9A9A9A] shrink-0 hover:text-[#0F0F0F]"
                    >
                      {shortOrderId(o.orderId)}
                    </CopyableText>
                  ) : (
                    <span className="font-mono text-[13px] text-[#9A9A9A] shrink-0">
                      {shortOrderId(o.orderId)}
                    </span>
                  )}
                  <span className="text-[#CACAC8] shrink-0">—</span>
                  <span className="text-[13px] font-semibold text-[#0F0F0F] truncate">
                    {o.agentName}
                  </span>
                  {o.priceUsdc && (
                    <span className="font-mono text-[13px] text-[#9A9A9A] shrink-0 tabular-nums">
                      {formatPrice(o.priceUsdc)}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <StatusBadge
                    status={normStatus}
                    variant="subtle"
                    size="sm"
                  />
                  <span className="text-[11px] text-[#9A9A9A] tabular-nums">
                    {relTimes[i]}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </CardShell>
      {footer && (
        <p className="text-xs text-[#6B6B6B] leading-relaxed">{footer}</p>
      )}
    </div>
  );
}
