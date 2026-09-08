import type { LiveFeedEventItemJson } from "@/lib/api/discovery";
import type { ActivityEvent, OrderEvent } from "@/lib/mock-data";
import { usdcMicroToUsd } from "@/lib/currency";
import {
  buildCompletedOrderTimeline,
  buildExpiredOrderTimeline,
  buildFailedOrderTimeline,
  buildPostPaidOrderTimeline,
} from "@/lib/order-timeline";

function safeParseMeta(raw: string): Record<string, unknown> {
  if (!raw || !raw.trim()) return {};
  try {
    const v = JSON.parse(raw) as unknown;
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function relTime(iso: string): string {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "";
  const sec = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (sec < 60) return `${sec}s ago`;
  const m = Math.floor(sec / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function asText(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function asNumber(v: unknown): number {
  return typeof v === "number" ? v : Number.NaN;
}

function pickText(meta: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const s = asText(meta[k]);
    if (s) return s;
  }
  return "";
}

function resolveOrderEventType(eventType: string, meta: Record<string, unknown>): string {
  const notifyType = pickText(meta, ["notify_type", "type"]);
  if (notifyType === "order_expired" || notifyType === "order_rejected") return notifyType;

  const status = pickText(meta, ["status"]).toLowerCase();
  if (status === "expired") return "order_expired";
  if (status === "rejected" || status === "deliver_failed") return "order_rejected";

  return eventType;
}

function humanDuration(seconds?: number): string | undefined {
  if (!Number.isFinite(seconds) || (seconds ?? 0) <= 0) return undefined;
  const s = Math.floor(seconds as number);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`;
  if (m > 0) return `${m}min`;
  return `${s}s`;
}

function buildOrderTimeline(
  row: LiveFeedEventItemJson,
  eventType: string,
  meta: Record<string, unknown>,
  amountUsd?: number
): OrderEvent[] {
  const fallbackTs = row.createdTime;
  const payTs = pickText(meta, ["paid_at", "pay_time", "lock_time", "lock_at"]) || fallbackTs;
  const deliverTsRaw = pickText(meta, ["delivered_at", "deliver_time", "deliver_at"]);
  const deliverTs = deliverTsRaw || fallbackTs;
  const clearTs = pickText(meta, ["clear_at", "cleared_at", "settled_at"]) || "—";
  const expiredTs = pickText(meta, ["expired_at", "expire_time", "expired_time"]) || fallbackTs;
  const failedTs = pickText(meta, ["failed_at", "rejected_at", "reject_time", "failed_time"]) || deliverTs;

  const payTx = pickText(meta, ["pay_tx_hash", "lock_tx_hash", "create_tx_hash"]);
  const clearTx = pickText(meta, [
    "clear_tx_hash",
    "settle_tx_hash",
    "refund_tx_hash",
    "refundTxHash",
    "reject_tx_hash",
    "rejectTxHash",
  ]);
  const deliverTx = pickText(meta, ["deliver_tx_hash", "deliverTxHash"]);
  const deliverableType = pickText(meta, ["deliverable_type"]).toLowerCase();
  const failureReason = pickText(meta, ["failure_reason", "failed_reason", "reject_reason", "reason", "error"]);

  if (eventType === "order_completed") {
    return buildCompletedOrderTimeline({
      amountUsd,
      paidAt: payTs,
      deliveredAt: deliverTs,
      clearAt: clearTs,
      payTxHash: payTx,
      deliverTxHash: deliverTx,
      clearTxHash: clearTx,
      deliverableType,
    });
  }

  if (eventType === "order_expired") {
    return buildExpiredOrderTimeline({
      amountUsd,
      paidAt: payTs,
      expiredAt: expiredTs,
      payTxHash: payTx,
      refundTxHash: clearTx,
    });
  }

  if (
    eventType === "order_failed"
    || eventType === "order_rejected"
    || eventType === "order_deliver_failed"
  ) {
    return buildFailedOrderTimeline({
      amountUsd,
      paidAt: payTs,
      failedAt: failedTs,
      deliveredAt: deliverTsRaw,
      payTxHash: payTx,
      deliverTxHash: deliverTx,
      failedTxHash: clearTx,
      reason: failureReason,
      deliverableType,
    });
  }

  const paidAtRaw = pickText(meta, ["paid_at", "pay_time", "lock_time", "lock_at"]);
  if (paidAtRaw) {
    return buildPostPaidOrderTimeline({
      amountUsd,
      paidAt: paidAtRaw,
      deliveredAt: deliverTsRaw,
      payTxHash: payTx,
      deliverTxHash: deliverTx,
      deliverableType,
    });
  }

  return [
    {
      phase: "lock",
      timestamp: fallbackTs,
      detail: `Order ${String(meta.order_id ?? row.refId ?? "").trim() || row.refId}`,
      txHash: payTx || undefined,
    },
  ];
}

/** Map backend live_feed_events row → home ActivityFeed row. */
export function liveFeedItemToActivityEvent(row: LiveFeedEventItemJson): ActivityEvent {
  const meta = safeParseMeta(row.metadataJson);
  if (row.eventType === "x402_paid") {
    const amountMicro = Number.isFinite(asNumber(meta.amount_usd))
      ? asNumber(meta.amount_usd)
      : asNumber(meta.amount);
    const amount = Number.isFinite(amountMicro) ? usdcMicroToUsd(amountMicro) : undefined;
    const agentName =
      String(row.agentName ?? "").trim() ||
      String(meta.agent_name ?? "").trim() ||
      "Agent";
    return {
      id: `feed-${row.id}`,
      type: "x402_paid",
      agentName,
      agentId: row.refId || String(row.id),
      agentAvatar: String(row.avatar ?? "").trim() || undefined,
      serviceName: pickText(meta, ["symbol"]) || String(row.serviceName ?? "").trim() || undefined,
      amount,
      timestamp: row.createdTime,
      relativeTime: relTime(row.createdTime),
      payTxHash: pickText(meta, ["tx_hash"]) || undefined,
    };
  }
  const isOrderEvent = row.refType === "order" || row.eventType.startsWith("order_");
  const providerId = String(meta.provider_agent_id ?? (row.refType === "agent" ? row.refId : ""));
  const orderId = String(meta.order_id ?? (isOrderEvent ? row.refId : ""));
  const amountMicro = Number.isFinite(asNumber(meta.amount))
    ? asNumber(meta.amount)
    : asNumber(meta.order_amount);
  const amount = Number.isFinite(amountMicro) ? usdcMicroToUsd(amountMicro) : undefined;

  const agentNameFromApi = String(row.agentName ?? "").trim();
  const serviceNameFromApi = String(row.serviceName ?? "").trim();

  const agentName =
    agentNameFromApi ||
    String(meta.agent_name ?? meta.provider_name ?? "").trim() ||
    (providerId ? `${providerId.slice(0, 6)}…${providerId.slice(-4)}` : "Agent");

  const serviceName =
    (isOrderEvent ? serviceNameFromApi || String(meta.service_name ?? "").trim() : "") || undefined;

  const eventType = resolveOrderEventType(row.eventType, meta);
  let type: ActivityEvent["type"] = "order_locked";
  if (eventType === "agent_joined") {
    type = "agent_joined";
  } else if (eventType === "order_completed") {
    type = "order_completed";
  } else if (eventType === "order_expired") {
    type = "order_expired";
  } else if (
    eventType === "order_failed"
    || eventType === "order_rejected"
    || eventType === "order_deliver_failed"
  ) {
    type = "order_locked";
  }

  const timeline = isOrderEvent ? buildOrderTimeline(row, eventType, meta, amount) : [];
  const durationSeconds = asNumber(meta.duration_seconds);
  const duration = humanDuration(durationSeconds);

  const avatarFromApi = String(row.avatar ?? "").trim();

  return {
    id: `feed-${row.id}`,
    type,
    agentName,
    agentId: providerId || orderId || String(row.id),
    agentAvatar: avatarFromApi || undefined,
    serviceName: isOrderEvent ? serviceName : undefined,
    orderId: isOrderEvent ? orderId || undefined : undefined,
    amount: isOrderEvent ? amount : undefined,
    timestamp: row.createdTime,
    relativeTime: relTime(row.createdTime),
    timeline: timeline.length ? timeline : undefined,
    orderStatus:
      eventType === "order_completed"
        ? "success"
        : eventType === "order_failed" || eventType === "order_rejected" || eventType === "order_deliver_failed"
          ? "failed"
          : undefined,
    duration: eventType === "order_completed" ? duration : undefined,
  };
}
