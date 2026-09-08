"use client";

import { useMemo, type ReactNode } from "react";
import { Check } from "lucide-react";
import CopyableText from "@/components/shared/CopyableText";
import StatusBadge from "@/components/shared/StatusBadge";
import { CardHeader, CardShell } from "../primitives";
import type {
  CapStep,
  CapTimeline,
  OrderDetailCardPayload,
} from "@/types/navigator";

export interface OrderDetailCardProps {
  payload: OrderDetailCardPayload;
}

const STEP_ORDER: Array<{ key: keyof CapTimeline; label: string }> = [
  { key: "lock", label: "Lock" },
  { key: "deliver", label: "Deliver" },
  { key: "clear", label: "Clear" },
];

/**
 * Map raw backend order status to the 4-state OrderRefStatus the badge speaks.
 * Mirrors `normalizeStatus` in OrderListCard — keep both in sync.
 */
function normalizeStatus(raw: string): "in_progress" | "completed" | "failed" | "expired" {
  const s = (raw ?? "").toLowerCase();
  if (s === "completed" || s === "delivered" || s === "cleared") return "completed";
  if (s === "expired") return "expired";
  if (
    s === "failed" ||
    s === "rejected" ||
    s === "deliver_failed" ||
    s === "pay_failed" ||
    s === "create_failed" ||
    s === "reject_failed" ||
    s === "lock_failed"
  )
    return "failed";
  return "in_progress";
}

function defaultFooter(timeline: CapTimeline | undefined, rawStatus: string): string {
  const norm = normalizeStatus(rawStatus);
  if (norm === "completed") return "Order complete. Payment has been released to the agent.";
  if (norm === "failed") return "Order failed. Funds have been returned to your wallet.";
  if (norm === "expired") return "Order expired. The agent did not deliver in time and funds have been refunded.";
  if (timeline?.clear) return "Order complete. Payment has been released to the agent.";
  if (timeline?.deliver) return "The agent has delivered the work. Awaiting settlement.";
  if (timeline?.lock) return "The agent has accepted your order and is working on it.";
  return "Your order is being processed.";
}

function shortOrderId(id: string): string {
  if (!id) return "";
  if (id.length <= 12) return id.startsWith("#") ? id : `#${id}`;
  return `#${id.slice(0, 8)}…`;
}

function formatTs(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  // e.g. "Mar 20, 14:33"
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/** "$0.01" — strip any pre-existing $ to avoid "$$0.01" double-prefix. */
function formatUsd(raw?: string): string {
  if (!raw) return "";
  const cleaned = raw.replace(/^\$/, "").trim();
  return cleaned ? `$${cleaned}` : "";
}

export function OrderDetailCard({ payload }: OrderDetailCardProps) {
  const {
    orderId,
    agentName,
    serviceName,
    status,
    capTimeline,
    requirements,
    pretext,
    footer,
  } = payload;

  const normStatus = normalizeStatus(status);

  const steps = useMemo(
    () =>
      STEP_ORDER.map(({ key, label }) => ({
        key,
        label,
        data: capTimeline?.[key],
        done: Boolean(capTimeline?.[key]),
      })),
    [capTimeline],
  );

  const hasRequirements =
    requirements && Object.keys(requirements).length > 0;

  const resolvedFooter = footer || defaultFooter(capTimeline, status);

  return (
    <div data-card-kind="order_detail" className="space-y-2 w-full">
      {pretext && (
        <p className="text-xs text-[#6B6B6B] leading-relaxed">{pretext}</p>
      )}
      <CardShell>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-[#0F0F0F] font-mono truncate">
                Order{" "}
                {orderId ? (
                  <CopyableText
                    value={orderId}
                    label="Order ID"
                    className="text-[#0F0F0F] hover:text-[#0F0F0F]"
                  >
                    {shortOrderId(orderId)}
                  </CopyableText>
                ) : (
                  shortOrderId(orderId)
                )}
              </p>
              <p className="text-[11px] text-[#9A9A9A] mt-0.5 truncate">
                {agentName}
                {serviceName ? ` · ${serviceName}` : ""}
              </p>
            </div>
            <StatusBadge status={normStatus} variant="subtle" size="sm" />
          </div>
        </CardHeader>

        {/* CAP Timeline (Lock → Deliver → Clear) */}
        <div className="px-4 py-3 space-y-2.5">
          {steps.map((step, i) => {
            const data: CapStep | undefined = step.data;
            const isFirstPending = !step.done && steps.slice(0, i).every((s) => s.done);
            const labelColor = step.done
              ? "text-[#0F0F0F]"
              : isFirstPending
                ? "text-[#6B6B6B]"
                : "text-[#9A9A9A]";

            const parts: Array<{ key: string; node: ReactNode }> = [];
            if (step.done) {
              if (data?.ts) {
                parts.push({ key: "ts", node: formatTs(data.ts) });
              } else {
                parts.push({ key: "status", node: "Completed" });
              }
              if (data?.amountUsdc) {
                parts.push({
                  key: "amount",
                  node: (
                    <>
                      {formatUsd(data.amountUsdc)} deducted
                      {data.priceUsdc && data.gasUsdc && (
                        <> (price {formatUsd(data.priceUsdc)} + gas ~{formatUsd(data.gasUsdc)})</>
                      )}
                    </>
                  ),
                });
              }
            } else {
              parts.push({ key: "status", node: "Pending" });
            }

            const textColor = step.done ? "text-[#9A9A9A]" : "text-[#CACAC8]";

            return (
              <div key={step.key} className="flex items-start gap-3">
                {/* circle + connector */}
                <div className="flex flex-col items-center">
                  <div
                    className={`h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                      step.done
                        ? "border-[#6EE646] bg-[#6EE646]"
                        : "border-[#CACAC8] bg-white"
                    }`}
                  >
                    {step.done && (
                      <Check
                        className="h-3 w-3 text-white"
                        strokeWidth={3}
                      />
                    )}
                  </div>
                  {i < steps.length - 1 && (
                    <div
                      className={`w-0.5 h-4 mt-1 ${
                        steps[i + 1].done ? "bg-[#6EE646]" : "bg-[#E2E2E0]"
                      }`}
                    />
                  )}
                </div>

                {/* content */}
                <div className="flex-1 min-w-0 pb-1">
                  <p className={`text-xs font-semibold ${labelColor}`}>
                    {step.label}
                  </p>
                  <p className={`text-[10px] mt-0.5 ${textColor}`}>
                    {parts.map((p, idx) => (
                      <span key={p.key}>
                        {idx > 0 && " · "}
                        {p.node}
                      </span>
                    ))}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {resolvedFooter && (
          <div className="border-t border-[#E2E2E0] bg-[#FAFAF9] px-4 py-3">
            <p className="text-[11px] text-[#6B6B6B] leading-relaxed">
              {resolvedFooter}
            </p>
          </div>
        )}

        {hasRequirements && (
          <details className="border-t border-[#E2E2E0] bg-[#FAFAF9] group">
            <summary className="px-4 py-2.5 text-[11px] font-mono uppercase tracking-wider text-[#9A9A9A] cursor-pointer select-none hover:text-[#6B6B6B] transition-colors">
              Requirements
            </summary>
            <pre className="px-4 pb-3 text-[10px] leading-relaxed text-[#3A3A3A] font-mono overflow-x-auto whitespace-pre-wrap break-all">
              {JSON.stringify(requirements, null, 2)}
            </pre>
          </details>
        )}
      </CardShell>
    </div>
  );
}
