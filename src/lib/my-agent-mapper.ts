import type { AgentInfoJson, AgentServicePayloadJson } from "@/lib/api/agent";
import type { MyAgent, MyAgentService, SchemaField } from "@/lib/mock-data";
import { usdcMicroToUsd } from "@/lib/currency";

/** Map backend `AgentInfo.status` to UI lifecycle status (list + configure). */
export function mapAgentStatus(api: string): MyAgent["status"] {
  const s = (api || "").toLowerCase();
  if (s === "online" || s === "active") return "online";
  if (s === "offline" || s === "inactive") return "offline";
  return "draft";
}

function parseSchemaJson(raw: string): SchemaField[] | undefined {
  const t = raw?.trim();
  if (!t) return undefined;
  try {
    const v = JSON.parse(t) as unknown;
    return Array.isArray(v) ? (v as SchemaField[]) : undefined;
  } catch {
    return undefined;
  }
}

function payloadToService(p: AgentServicePayloadJson): MyAgentService {
  const priceMicro =
    typeof p.price === "string" ? Math.round(parseFloat(p.price) || 0) : Math.round(Number(p.price) || 0);
  const priceUsd = usdcMicroToUsd(priceMicro);
  const slaM = Number(p.slaMinutes) || 0;
  const reqType = (p.requirementType || "text").toLowerCase() === "schema" ? "schema" : "text";
  const delType = (p.deliverableType || "text").toLowerCase() === "schema" ? "schema" : "text";
  const rawPriceModel = (p.priceModel || "").toLowerCase();
  const priceModel = rawPriceModel === "percentage" ? "percentage" : "flat";
  const feePercentage =
    p.feePercentage !== undefined && p.feePercentage !== ""
      ? Number(p.feePercentage)
      : undefined;
  return {
    id: p.serviceId || "",
    name: p.name || "",
    description: p.description || "",
    price: priceUsd,
    requireFundTransfer: !!p.requireFundTransfer,
    priceModel,
    ...(typeof feePercentage === "number" && Number.isFinite(feePercentage) ? { feePercentage } : {}),
    slaHours: Math.floor(slaM / 60),
    slaMinutes: slaM % 60,
    deliverableType: delType,
    deliverableText: p.deliverableText || "",
    deliverableSchema: delType === "schema" ? parseSchemaJson(p.deliverableSchemaJson) : undefined,
    requirementsType: reqType,
    requirementsText: p.requirementText || "",
    requirementsSchema: reqType === "schema" ? parseSchemaJson(p.requirementSchemaJson) : undefined,
  };
}

/** List card: aggregates + on-chain wallet balance from `AgentInfo`. */
export function agentInfoToMyAgentListItem(a: AgentInfoJson): MyAgent {
  const id = a.agentId || "";
  const balStr = String(a.walletBalanceUsdc ?? "0").trim();
  const walletBal = Number.parseFloat(balStr);
  const totalOrders = Math.trunc(Number(a.totalOrders ?? 0)) || 0;
  const totalVolume = usdcMicroToUsd(Math.trunc(Number(a.totalVolumeMicro ?? 0)));
  const totalEarned = usdcMicroToUsd(Math.trunc(Number(a.totalEarnedMicro ?? 0)));
  const completionRate = Number(a.completionRate ?? 0);
  return {
    id,
    name: a.name || "Agent",
    description: (a.description ?? "").trim(),
    /** Raw value: HTTPS URL, `data:`, or COS `object_key` — use `ResolvedAgentAvatar` to display. */
    avatar: (a.avatar ?? "").trim(),
    status: mapAgentStatus(a.status),
    wallet: { address: a.walletAddress || "", balance: Number.isFinite(walletBal) ? walletBal : 0 },
    tags: [],
    totalOrders,
    totalVolume,
    completionRate,
    avgDeliveryTime: (a.avgDeliveryText || "").trim() || "—",
    totalEarned,
    source: (a.source || "custom").trim() || "custom",
    joinedAt: a.createdTime || "",
    services: [],
  };
}

export function getAgentDetailToMyAgent(
  agent: AgentInfoJson,
  skillTags: string[],
  services: AgentServicePayloadJson[],
  tagSlugToLabel: Map<string, string>,
  /** Masked key from GET agent `sdkKey`; omit when no key. */
  sdkKeyMasked?: string,
): MyAgent {
  const base = agentInfoToMyAgentListItem(agent);
  const tags = skillTags.map((slug) => tagSlugToLabel.get(slug) || slug);
  const m = (sdkKeyMasked ?? "").trim();
  return {
    ...base,
    avatar: (agent.avatar ?? "").trim(),
    tags,
    services: services.map(payloadToService),
    ...(m ? { apiKey: m } : {}),
  };
}
