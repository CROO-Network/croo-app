"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Check, Loader2 } from "lucide-react";
import { invalidateMyFirstAgentCampaign } from "@/lib/campaign-cache";
import { getOrderIdByNegotiation } from "@/lib/navigator/api";
import type { OrderSuccessCardPayload } from "@/types/navigator";

/**
 * Hard cap on negotiation→order polling. The backend pay coroutine
 * lands the orders row within ~3-15s on the happy path. If we haven't
 * seen one after 5 minutes the provider has almost certainly not
 * accepted (or the negotiation has effectively expired) — burning
 * another 3s tick every 3s for the rest of the session just creates
 * background noise.
 */
const MAX_POLL_MS = 5 * 60 * 1000;

/**
 * Soft cap on which cards even start polling. Cards persisted on
 * messages older than this are treated as historical — when the user
 * scrolls back through a long chat we don't want every legacy
 * OrderSuccessCard re-firing a polling loop.
 */
const MAX_AGE_FOR_POLLING_MS = 10 * 60 * 1000;

const POLL_INTERVAL_MS = 3000;

function mapOrderStatus(raw: string): string {
  switch (raw.toLowerCase()) {
    case "created":
    case "locked":
    case "paid":
    case "pending":
    case "in_progress":
      return "In Progress";
    case "delivered":
      return "Delivering";
    case "completed":
    case "cleared":
      return "Completed";
    case "lock_failed":
    case "deliver_failed":
      return "Failed";
    case "expired":
      return "Expired";
    default:
      return "In Progress";
  }
}

export interface OrderSuccessCardProps {
  payload: OrderSuccessCardPayload;
  /** Closes the Navigator dialog when the user clicks View Details. */
  onNavigateAway?: () => void;
  /**
   * ISO 8601 timestamp of the host assistant message. Used to gate
   * polling: only "fresh" cards (created within MAX_AGE_FOR_POLLING_MS)
   * start a polling loop.
   */
  messageCreatedAt?: string;
  /**
   * Set by ConversationView when this card belongs to a non-latest
   * assistant message. Historical cards never poll.
   */
  isHistorical?: boolean;
}

function shortenOrderId(orderId: string): string {
  if (orderId.length <= 14) return orderId;
  return `${orderId.slice(0, 8)}…${orderId.slice(-4)}`;
}

export function OrderSuccessCard({
  payload,
  onNavigateAway,
  messageCreatedAt,
  isHistorical,
}: OrderSuccessCardProps) {
  const {
    orderId: payloadOrderId,
    negotiationId,
    agentName,
    status,
    note,
  } = payload;
  const router = useRouter();
  const queryClient = useQueryClient();
  const invalidatedOrderRef = useRef<string | null>(null);

  const [mountedAt] = useState<number>(() => Date.now());

  const [isFreshMessage] = useState<boolean>(() => {
    if (!messageCreatedAt) return true;
    const ts = Date.parse(messageCreatedAt);
    if (!Number.isFinite(ts)) return true;
    return Date.now() - ts < MAX_AGE_FOR_POLLING_MS;
  });

  const shouldPoll =
    Boolean(negotiationId)
    && !payloadOrderId
    && !isHistorical
    && isFreshMessage;
  const pollQuery = useQuery({
    queryKey: ["navigator", "negotiationOrder", negotiationId],
    queryFn: ({ signal }) =>
      getOrderIdByNegotiation(negotiationId as string, { signal }),
    enabled: shouldPoll,
    refetchInterval: (q) => {
      if (q.state.data?.orderId) return false;
      if (Date.now() - mountedAt > MAX_POLL_MS) return false;
      return POLL_INTERVAL_MS;
    },
    refetchIntervalInBackground: false,
    staleTime: Infinity,
  });

  const resolvedOrderId: string | null =
    payloadOrderId ?? pollQuery.data?.orderId ?? null;

  useEffect(() => {
    if (!resolvedOrderId || invalidatedOrderRef.current === resolvedOrderId) return;
    invalidatedOrderRef.current = resolvedOrderId;
    invalidateMyFirstAgentCampaign(queryClient);
  }, [queryClient, resolvedOrderId]);

  // Prefer poll data — it's the freshest BE snapshot. Fall back to the
  // payload value stamped by the upstream schema_form / fund_transfer card.
  const resolvedAgentName: string =
    pollQuery.data?.agentName ?? agentName ?? "the agent";
  const resolvedStatus: string = pollQuery.data?.status ?? status ?? "";

  const hasRealOrderId = Boolean(resolvedOrderId);
  const detailsHref = resolvedOrderId
    ? `/account/orders?highlight=${encodeURIComponent(resolvedOrderId)}`
    : "/account/orders";

  const handleViewDetails = (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    router.push(detailsHref);
    onNavigateAway?.();
  };

  return (
    <div className="space-y-2 min-w-0 w-full">
      <div
        data-card-kind="order_success"
        className="rounded-xl border border-[#6EE646]/40 bg-[#F0F9EB] overflow-hidden w-full"
      >
        <div className="px-4 py-4 flex items-start gap-3">
          <div className="h-8 w-8 rounded-full bg-[#6EE646] flex items-center justify-center shrink-0 mt-0.5">
            {hasRealOrderId ? (
              <Check className="h-4 w-4 text-white" strokeWidth={2.5} />
            ) : (
              <Loader2
                className="h-4 w-4 text-white animate-spin"
                strokeWidth={2.5}
              />
            )}
          </div>
          <div className="space-y-1.5 min-w-0">
            <p className="text-sm font-semibold text-[#0F0F0F]">
              {hasRealOrderId
                ? `Order #${shortenOrderId(resolvedOrderId as string)} created!`
                : "Order request submitted"}
            </p>
            <p className="text-xs text-[#5A7A4A]">
              {hasRealOrderId
                ? `Agent: ${resolvedAgentName} · Status: ${mapOrderStatus(resolvedStatus)}`
                : `Waiting for ${resolvedAgentName} to accept your request.`}
            </p>
            {note && hasRealOrderId && (
              <p className="text-xs text-[#6B6B6B] leading-relaxed">{note}</p>
            )}
            {!hasRealOrderId && (
              <p className="text-xs text-[#6B6B6B] leading-relaxed">
                Track progress on your orders page once accepted.
              </p>
            )}
            <Link
              href={detailsHref}
              onClick={handleViewDetails}
              className="inline-flex items-center gap-1 text-xs font-medium text-[#0F0F0F] hover:underline pt-1"
            >
              View Details
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
