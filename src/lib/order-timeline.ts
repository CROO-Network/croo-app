import type { OrderEvent } from "@/lib/mock-data";

export const orderPhaseColor: Record<string, string> = {
  lock: "#3B82F6",
  deliver: "#F59E0B",
  clear: "#6EE646",
  expired: "#F97316",
  deliver_failed: "#EF4444",
};

export const orderPhaseLabel: Record<string, string> = {
  lock: "Lock",
  deliver: "Deliver",
  clear: "Clear",
  expired: "Expired",
  deliver_failed: "Failed",
};

export const orderPhaseShowsTx: Record<string, boolean> = {
  lock: true,
  deliver: true,
  clear: true,
  expired: true,
  deliver_failed: true,
};

export function showsOrderPhaseTxLink(event: Pick<OrderEvent, "phase" | "txHash">): boolean {
  return Boolean(event.txHash);
}

export function amountLabel(amountUsd?: number): string {
  if (!Number.isFinite(amountUsd) || (amountUsd ?? 0) <= 0) return "USDC";
  return `${(amountUsd as number).toFixed(2)} USDC`;
}

function refundDetail(amountUsd?: number): string {
  return `SLA timeout — ${amountLabel(amountUsd)} refunded`;
}

export function failedRefundDetail(amountUsd?: number, reason?: string): string {
  const trimmed = (reason || "").trim();
  const prefix = trimmed || "Delivery verification failed";
  if (/\brefund(ed)?\b/i.test(prefix)) return prefix;
  return `${prefix} — ${amountLabel(amountUsd)} refunded`;
}

/** Post-paid, not yet completed (Agent Activity + partial states). */
export function buildPostPaidOrderTimeline(params: {
  amountUsd?: number;
  paidAt: string;
  deliveredAt?: string;
  payTxHash?: string;
  deliverTxHash?: string;
  deliverableType?: string;
}): OrderEvent[] {
  const deliveredAs = (params.deliverableType || "text").trim().toLowerCase() || "text";
  const payTx = (params.payTxHash || "").trim();
  const deliverTx = (params.deliverTxHash || "").trim();
  const out: OrderEvent[] = [
    {
      phase: "lock",
      timestamp: params.paidAt,
      detail: `Escrow locked ${amountLabel(params.amountUsd)}`,
      txHash: payTx || undefined,
    },
  ];
  const deliverTs = (params.deliveredAt || "").trim();
  if (deliverTs && deliverTs !== "—") {
    out.push({
      phase: "deliver",
      timestamp: deliverTs,
      detail: `Result delivered (${deliveredAs})`,
      txHash: deliverTx || undefined,
    });
  }
  return out;
}

/** CAP timeline for a completed order (Live Feed + Agent Activity). */
export function buildCompletedOrderTimeline(params: {
  amountUsd?: number;
  paidAt: string;
  deliveredAt: string;
  clearAt: string;
  payTxHash?: string;
  deliverTxHash?: string;
  clearTxHash?: string;
  deliverableType?: string;
}): OrderEvent[] {
  const deliveredAs = (params.deliverableType || "text").trim().toLowerCase() || "text";
  const payTx = (params.payTxHash || "").trim();
  const deliverTx = (params.deliverTxHash || "").trim();
  const clearTx = (params.clearTxHash || "").trim();

  return [
    {
      phase: "lock",
      timestamp: params.paidAt,
      detail: `Escrow locked ${amountLabel(params.amountUsd)}`,
      txHash: payTx || undefined,
    },
    {
      phase: "deliver",
      timestamp: params.deliveredAt,
      detail: `Result delivered (${deliveredAs})`,
      txHash: deliverTx || undefined,
    },
    {
      phase: "clear",
      timestamp: params.clearAt,
      detail: `${amountLabel(params.amountUsd)} settled to provider`,
      txHash: clearTx || undefined,
    },
  ];
}

export function buildExpiredOrderTimeline(params: {
  amountUsd?: number;
  paidAt: string;
  expiredAt: string;
  payTxHash?: string;
  refundTxHash?: string;
}): OrderEvent[] {
  const payTx = (params.payTxHash || "").trim();
  const refundTx = (params.refundTxHash || "").trim();

  return [
    {
      phase: "lock",
      timestamp: params.paidAt,
      detail: `Escrow locked ${amountLabel(params.amountUsd)}`,
      txHash: payTx || undefined,
    },
    {
      phase: "expired",
      timestamp: params.expiredAt,
      detail: refundDetail(params.amountUsd),
      txHash: refundTx || undefined,
    },
  ];
}

export function buildFailedOrderTimeline(params: {
  amountUsd?: number;
  paidAt: string;
  failedAt: string;
  deliveredAt?: string;
  payTxHash?: string;
  deliverTxHash?: string;
  failedTxHash?: string;
  reason?: string;
  deliverableType?: string;
}): OrderEvent[] {
  const payTx = (params.payTxHash || "").trim();
  const deliverTx = (params.deliverTxHash || "").trim();
  const failedTx = (params.failedTxHash || "").trim();
  const deliveredAs = (params.deliverableType || "text").trim().toLowerCase() || "text";
  const deliveredAt = (params.deliveredAt || "").trim();

  const out: OrderEvent[] = [
    {
      phase: "lock",
      timestamp: params.paidAt,
      detail: `Escrow locked ${amountLabel(params.amountUsd)}`,
      txHash: payTx || undefined,
    },
  ];

  if (deliveredAt && deliveredAt !== "—") {
    out.push({
      phase: "deliver",
      timestamp: deliveredAt,
      detail: `Result delivered (${deliveredAs})`,
      txHash: deliverTx || undefined,
    });
  }

  out.push({
    phase: "deliver_failed",
    timestamp: params.failedAt,
    detail: failedRefundDetail(params.amountUsd, params.reason),
    txHash: failedTx || undefined,
  });

  return out;
}
