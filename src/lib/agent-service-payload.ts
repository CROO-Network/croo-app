import type { ServiceFormData } from "@/components/agent/ServiceModal";
import type { AgentServicePayloadJson } from "@/lib/api/agent";
import type { PublicTagJson } from "@/lib/api/discovery";
import { usdcMicroFromUsd } from "@/lib/currency";

/** Base mainnet USDC — must match backend `contracts.usdc` for Create/Update service payloads. */
export const BASE_MAINNET_USDC =
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_BASE_USDC_ADDRESS?.trim()) ||
  "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

/** Sent to Create/Update agent: COS object key or full public URL; backend normalizes to key. No data URLs. */
export function avatarStringForApi(avatar: string): string {
  const t = (avatar ?? "").trim();
  if (!t) return "";
  if (t.startsWith("data:")) return "";
  if (t.length > 512) return "";
  return t;
}

export function skillTagLabelsToSlugs(labels: string[], catalog: PublicTagJson[]): string[] {
  const byName = new Map(catalog.map((t) => [t.name, t.slug] as const));
  const out: string[] = [];
  const seen = new Set<string>();
  for (const label of labels) {
    const slug = byName.get(label)?.trim().toLowerCase();
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    out.push(slug);
  }
  return out;
}

export function serviceFormDataToPayload(
  s: ServiceFormData,
  paymentToken: string,
): AgentServicePayloadJson {
  const usd = parseFloat(String(s.price).replace(/,/g, "")) || 0;
  const priceMicro = usdcMicroFromUsd(usd);
  const slaH = parseInt(String(s.slaHours), 10) || 0;
  const slaM = parseInt(String(s.slaMinutes), 10) || 0;
  const totalMinutes = Math.max(5, slaH * 60 + slaM);
  const rt = s.requirementsType === "schema" ? "schema" : "text";
  const dt = s.deliverableType === "schema" ? "schema" : "text";
  // `principal_amount` is platform-owned: the BE prepends it on save when
  // require_fund_transfer is on and strips it otherwise. The modal hides
  // the row, but strip defensively in case stale state slips through.
  const stripPrincipal = (fields: import("@/components/agent/ServiceModal").ServiceFormData["requirementsSchema"]) =>
    (fields ?? []).filter((f) => f.name !== "principal_amount");
  const reqSchemaJson = rt === "schema" ? JSON.stringify(stripPrincipal(s.requirementsSchema)) : "[]";
  const delSchemaJson = dt === "schema" ? JSON.stringify(s.deliverableSchema ?? []) : "[]";
  const sid = s.id.trim().startsWith("svc-new-") ? "" : s.id.trim();

  const requireFundTransfer = !!s.requireFundTransfer;
  const priceModel = requireFundTransfer ? (s.priceModel === "percentage" ? "percentage" : "flat") : "flat";
  const feePercentage = priceModel === "percentage" ? String(parseFloat(String(s.feePercentage)) || 0) : "0";

  return {
    serviceId: sid,
    name: s.name.trim(),
    description: (s.description ?? "").trim(),
    price: String(priceMicro),
    slaMinutes: totalMinutes,
    requirementType: rt,
    requirementText: rt === "text" ? (s.requirementsText ?? "").trim() : "",
    requirementSchemaJson: reqSchemaJson,
    deliverableType: dt,
    deliverableText: (s.deliverableText ?? "").trim(),
    deliverableSchemaJson: delSchemaJson,
    orderType: "one_time",
    paymentToken,
    requireFundTransfer,
    priceModel,
    feePercentage,
  };
}
