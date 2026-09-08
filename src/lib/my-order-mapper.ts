import type { DeliveryInfoJson, OrderCapTimelineEventJson, OrderInfoJson } from "@/lib/api/order";
import type { MyOrder, OrderEvent } from "@/lib/mock-data";
import { usdcMicroToUsd } from "@/lib/currency";
import { amountLabel, failedRefundDetail } from "@/lib/order-timeline";

function microFromApiAmountString(s: string): number {
  const n = Number.parseFloat(s || "0");
  if (!Number.isFinite(n)) return 0;
  return Math.round(n);
}

export function mapOrderStatus(api: string): MyOrder["status"] {
  switch (api) {
    case "completed":
      return "completed";
    case "expired":
      return "expired";
    case "deliver_failed":
    case "pay_failed":
    case "create_failed":
    case "reject_failed":
    case "rejected":
      return "deliver_failed";
    default:
      return "in_progress";
  }
}

function findCapEvent(
  events: OrderCapTimelineEventJson[],
  phase: OrderCapTimelineEventJson["phase"],
): OrderCapTimelineEventJson | undefined {
  return events.find((event) => event.phase === phase && event.occurredAt);
}

function sentenceCase(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const lower = trimmed.toLowerCase();
  return `${lower.slice(0, 1).toUpperCase()}${lower.slice(1)}`;
}

function deliverDetailFromServiceName(serviceName: string): string {
  const name = serviceName.trim();
  if (!name) return "Result delivered";

  const lower = name.toLowerCase();
  if (lower.includes("code review")) return "Code review report delivered";
  if (lower.includes("token analysis")) return "Token analysis delivered";
  if (lower.includes("dad joke")) return "Dad joke delivered";

  return `${sentenceCase(name.replace(/\s+service$/i, ""))} delivered`;
}

export function capTimelineToOrderEvents(
  events: OrderCapTimelineEventJson[],
  details: {
    agentName: string;
    serviceName: string;
    price: number;
    status: MyOrder["status"];
    paidAt?: string;
    deliveredAt?: string;
    updatedTime?: string;
    expiredAt?: string;
    rejectedAt?: string;
    rejectReason?: string;
    payTxHash?: string;
    deliverTxHash?: string;
    clearTxHash?: string;
    rejectTxHash?: string;
  },
): OrderEvent[] {
  const capEvents = events || [];
  const out: OrderEvent[] = [];
  const isCompleted = details.status === "completed";
  const isExpired = details.status === "expired";
  const isFailed = details.status === "deliver_failed";

  const paid = findCapEvent(capEvents, "paid");
  if (paid || details.paidAt) {
    out.push({
      phase: "lock",
      timestamp: paid?.occurredAt || details.paidAt || "—",
      detail: `Escrow locked ${amountLabel(details.price)}`,
      txHash: paid?.txHash || details.payTxHash || undefined,
    });
  }

  const delivered = findCapEvent(capEvents, "delivered");
  const cleared = findCapEvent(capEvents, "cleared");
  const shouldShowDeliver = Boolean(
    !isExpired && (isCompleted || isFailed) && (delivered || details.deliveredAt || cleared),
  );
  if (shouldShowDeliver) {
    out.push({
      phase: "deliver",
      timestamp: delivered?.occurredAt || details.deliveredAt || cleared?.occurredAt || "",
      detail: deliverDetailFromServiceName(details.serviceName),
      txHash: delivered?.txHash || details.deliverTxHash || undefined,
    });
  }

  if (isCompleted && (cleared || details.clearTxHash || details.deliveredAt || details.updatedTime)) {
    const agentSuffix = details.agentName ? ` to ${details.agentName}` : "";
    out.push({
      phase: "clear",
      timestamp: cleared?.occurredAt || details.deliveredAt || details.updatedTime || "—",
      detail: `${amountLabel(details.price)} settled${agentSuffix || " to provider"}`,
      txHash: cleared?.txHash || details.clearTxHash || undefined,
    });
  }

  const expired = findCapEvent(capEvents, "expired");
  if (isExpired) {
    out.push({
      phase: "expired",
      timestamp: expired?.occurredAt || details.expiredAt || "—",
      detail: `SLA timeout — ${amountLabel(details.price)} refunded`,
      txHash: expired?.txHash || details.rejectTxHash || undefined,
    });
  }

  const rejected = findCapEvent(capEvents, "rejected");
  if (isFailed) {
    out.push({
      phase: "deliver_failed",
      timestamp: rejected?.occurredAt || details.rejectedAt || details.deliveredAt || "—",
      detail: failedRefundDetail(details.price, details.rejectReason),
      txHash: rejected?.txHash || details.rejectTxHash || undefined,
    });
  }

  return out;
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

function normalizeRequirements(value: OrderInfoJson["requirements"]): Record<string, string> {
  if (!value) return {};

  let raw: unknown = value;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return {};
    try {
      raw = JSON.parse(trimmed) as unknown;
    } catch {
      return { value: trimmed };
    }
  }

  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};

  return Object.fromEntries(
    Object.entries(raw as Record<string, unknown>).map(([key, item]) => [
      key,
      typeof item === "string" ? item : JSON.stringify(item),
    ]),
  );
}

/** Raw requirements for JSON / text display (preserves API string before field flattening). */
export function requirementsDisplayValue(
  value: OrderInfoJson["requirements"],
): unknown {
  if (value == null) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    try {
      return JSON.parse(trimmed) as unknown;
    } catch {
      return trimmed;
    }
  }
  return value;
}

function normalizeDeliverableType(value: string | undefined): MyOrder["deliverableType"] {
  const normalized = value?.trim().toLowerCase();
  return normalized === "schema" ? "schema" : normalized === "text" ? "text" : undefined;
}

function deliveryResultFromDelivery(delivery: DeliveryInfoJson | null | undefined): string | undefined {
  if (!delivery) return undefined;

  const deliverableType = normalizeDeliverableType(delivery.deliverableType);
  const result = deliverableType === "schema" ? delivery.deliverableSchema : delivery.deliverableText;
  const trimmed = result?.trim();
  return trimmed || undefined;
}

export type OrderListContext = {
  agentName: string;
  agentAvatar: string;
  serviceName: string;
};

export function orderInfoToMyOrder(
  o: OrderInfoJson,
  ctx: OrderListContext,
  cap?: OrderCapTimelineEventJson[],
  delivery?: DeliveryInfoJson | null,
): MyOrder {
  const amt = usdcMicroToUsd(microFromApiAmountString(o.amount));
  const gas = usdcMicroToUsd(microFromApiAmountString(o.gasAmount));
  const price =
    o.price != null ? usdcMicroToUsd(microFromApiAmountString(String(o.price))) : amt;
  const created = o.createdAt || o.createdTime || "";
  const status = mapOrderStatus(o.status);
  const timeline = cap?.length
    ? capTimelineToOrderEvents(cap, {
        agentName: ctx.agentName,
        serviceName: ctx.serviceName,
        price,
        status,
        paidAt: o.paidAt,
        deliveredAt: o.deliveredAt,
        updatedTime: o.updatedTime,
        expiredAt: o.expiredAt,
        rejectedAt: o.rejectedAt,
        rejectReason: o.rejectReason,
        payTxHash: o.payTxHash,
        deliverTxHash: o.deliverTxHash,
        clearTxHash: o.clearTxHash,
        rejectTxHash: o.rejectTxHash || o.reject_tx_hash,
      })
    : [];
  return {
    id: o.orderId,
    agentId: o.providerAgentId,
    agentName: ctx.agentName,
    agentAvatar: ctx.agentAvatar,
    serviceName: ctx.serviceName,
    price,
    gas,
    total: amt + gas,
    status,
    createdAt: created,
    relativeTime: relTime(created),
    timeline,
    requirements: normalizeRequirements(o.requirements),
    requirementsDisplay: requirementsDisplayValue(o.requirements),
    deliverResult: deliveryResultFromDelivery(delivery) || o.deliverResult,
    deliverableType:
      normalizeDeliverableType(delivery?.deliverableType) ||
      normalizeDeliverableType(o.deliverableType),
  };
}
