import type { PublicOrderActivityItemJson } from "@/lib/api/discovery";
import type { Order, OrderEvent } from "@/lib/mock-data";
import { usdcMicroToUsd } from "@/lib/currency";
import {
  buildCompletedOrderTimeline,
  buildExpiredOrderTimeline,
  buildFailedOrderTimeline,
  buildPostPaidOrderTimeline,
} from "@/lib/order-timeline";

function mapOrderStatus(api: string): Order["status"] {
  switch (api) {
    case "paid":
      return "paid";
    case "feedback":
      return "feedback";
    case "completed":
      return "completed";
    case "expired":
      return "expired";
    case "deliver_failed":
    case "pay_failed":
    case "create_failed":
    case "reject_failed":
      return "deliver_failed";
    case "rejected":
      return "lock_failed";
    default:
      return "in_progress";
  }
}

function relTime(iso: string): string {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "—";
  const sec = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (sec < 60) return `${sec}s ago`;
  const m = Math.floor(sec / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function tsOrDash(iso?: string): string {
  return (iso || "").trim() || "—";
}

function firstText(...values: Array<unknown>): string {
  for (const value of values) {
    if (typeof value !== "string") continue;
    const text = value.trim();
    if (text) return text;
  }
  return "";
}

function buildTimeline(row: PublicOrderActivityItemJson): OrderEvent[] {
  const amountUsd = usdcMicroToUsd(Number(row.amount) || 0);
  const refundTxHash = firstText(
    row.refundTxHash,
    row.rejectTxHash,
    row.refund_tx_hash,
    row.reject_tx_hash,
    row.clearTxHash,
  );

  if (row.status === "completed") {
    return buildCompletedOrderTimeline({
      amountUsd,
      paidAt: tsOrDash(row.paidAt),
      deliveredAt: tsOrDash(row.deliveredAt),
      clearAt: tsOrDash(row.settledAt),
      payTxHash: row.payTxHash || row.createTxHash,
      deliverTxHash: row.deliverTxHash,
      clearTxHash: row.clearTxHash,
    });
  }

  if (row.status === "expired") {
    return buildExpiredOrderTimeline({
      amountUsd,
      paidAt: tsOrDash(row.paidAt),
      expiredAt: tsOrDash(row.expiredAt || row.deliveredAt || row.settledAt),
      payTxHash: row.payTxHash || row.createTxHash,
      refundTxHash,
    });
  }

  if (
    row.status === "deliver_failed"
    || row.status === "rejected"
    || row.status === "pay_failed"
    || row.status === "create_failed"
    || row.status === "reject_failed"
  ) {
    return buildFailedOrderTimeline({
      amountUsd,
      paidAt: tsOrDash(row.paidAt),
      failedAt: tsOrDash(row.rejectedAt || row.deliveredAt || row.settledAt),
      deliveredAt: tsOrDash(row.deliveredAt),
      payTxHash: row.payTxHash || row.createTxHash,
      deliverTxHash: row.deliverTxHash,
      failedTxHash: refundTxHash,
      reason: row.rejectReason,
    });
  }

  return buildPostPaidOrderTimeline({
    amountUsd,
    paidAt: tsOrDash(row.paidAt),
    deliveredAt: tsOrDash(row.deliveredAt),
    payTxHash: row.payTxHash || row.createTxHash,
    deliverTxHash: row.deliverTxHash,
  });
}

export function publicActivityItemToOrder(row: PublicOrderActivityItemJson, agentName: string): Order {
  const amount = usdcMicroToUsd(Number(row.amount) || 0);
  const refTime = row.deliveredAt || row.paidAt || "";
  const isBscActivity = row.status === "paid" || row.status === "feedback";
  return {
    id: row.orderId,
    agentName,
    agentId: "",
    serviceName: row.serviceName || "—",
    amount,
    status: mapOrderStatus(row.status),
    buyerWallet: row.buyerAddrShort || "0x",
    timeline: isBscActivity ? [] : buildTimeline(row),
    createdAt: row.paidAt || refTime,
    relativeTime: relTime(refTime || row.paidAt),
    payTxHash: row.payTxHash?.trim() || undefined,
  };
}
