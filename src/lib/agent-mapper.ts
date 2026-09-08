import type { PublicAgentDetailJson, PublicAgentSummaryJson, PublicServiceBriefJson } from "@/lib/api/discovery";
import type { Agent, Service } from "@/lib/mock-data";
import { formatSlaMinutes, usdcMicroToUsd } from "@/lib/currency";
import { parseSchemaFields } from "@/lib/schema-fields";

function normalizeAgentStatus(s: string): Agent["status"] {
  const x = (s || "").toLowerCase();
  if (x === "online" || x === "active") return "online";
  if (x === "paused") return "paused";
  if (x === "offline") return "offline";
  return "offline";
}

export function mapPublicAgentSummaryToAgent(
  row: PublicAgentSummaryJson,
  slugToName: Map<string, string> = new Map()
): Agent {
  const id = row.agentId;
  const lowestPrice = usdcMicroToUsd(Number(row.minServicePrice) || 0);
  const totalVolume = usdcMicroToUsd(Number(row.totalVolume) || 0);
  const slugs = row.skillTagSlugs || [];
  const tagNames = slugs.map((s) => slugToName.get(s) || s);
  return {
    id,
    name: row.name || id,
    avatar: row.avatar || "",
    // `agents.status` is the registration lifecycle (creating/active/…);
    // the real online/offline signal is `onlineStatus`, which is what the
    // backend public-list filter uses. Prefer it over the lifecycle field.
    status: normalizeAgentStatus(row.onlineStatus || row.status),
    wallet: "",
    joinedAt: (row.createdTime || "").slice(0, 10),
    description: row.description || "",
    tags: tagNames,
    stats: {
      totalOrders: Number(row.completedOrders) || 0,
      totalVolume,
      completionRate: Number(row.completionRate) || 0,
      avgDeliveryTime: row.avgDeliveryText || "—",
    },
    services: [],
    lowestPrice,
    chain: row.chain === "bsc" || row.chain === "base" ? row.chain : undefined,
    chains: row.chains,
    linkedAgentId: row.linkedAgentId?.trim() || undefined,
    externalUrl: row.externalUrl?.trim() || undefined,
    score: typeof row.score === "number" && row.score > 0 ? row.score : undefined,
    feedbackCount: Number(row.feedbackCount) || undefined,
  };
}

function mapServiceBrief(s: PublicServiceBriefJson): Service {
  const rawReq = (s.requirementType || "text").toLowerCase();
  const parsedReq = parseSchemaFields(s.requirementSchema);
  const reqType =
    (rawReq === "schema" || rawReq === "json_schema") && parsedReq?.length ? "schema" : "text";
  const delType = (s.deliverableType || "text").toLowerCase() === "schema" ? "schema" : "text";
  const deliverableSchema = delType === "schema" ? parseSchemaFields(s.deliverableSchema) : undefined;
  return {
    id: s.serviceId,
    name: s.name,
    description: (s.description ?? "").trim(),
    price: usdcMicroToUsd(Number(s.price) || 0),
    sla: formatSlaMinutes(Number(s.slaMinutes) || 0),
    orders7d: Math.trunc(Number(s.orders7d ?? 0)) || 0,
    requirementType: reqType,
    deliverableType: delType,
    requirements:
      reqType === "text"
        ? (s.requirementText ?? (rawReq === "json_schema" ? s.requirementSchema ?? "" : "")).trim()
        : "",
    deliverable: delType === "text" ? (s.deliverableText ?? "").trim() : "",
    requirementsSchema: reqType === "schema" ? parsedReq : undefined,
    deliverableSchema,
  };
}

export function mapPublicAgentDetailToAgent(
  d: PublicAgentDetailJson,
  slugToName: Map<string, string>
): Agent {
  const base = mapPublicAgentSummaryToAgent(d, slugToName);
  const services = (d.services || []).map(mapServiceBrief);
  const minFromServices = services.length
    ? Math.min(...services.map((x) => x.price))
    : 0;
  return {
    ...base,
    wallet: (d.walletAddress && String(d.walletAddress).trim()) || "",
    services,
    lowestPrice: base.lowestPrice || minFromServices,
  };
}

/** UI sort keys → backend `normalizePublicAgentSort` values. */
export function uiSortToApiSort(ui: string): string {
  switch (ui) {
    case "popular":
      return "most_orders";
    case "volume":
      return "highest_volume";
    case "newest":
      return "newest";
    case "price_asc":
      return "lowest_price";
    case "completion":
      return "highest_completion_rate";
    default:
      return "newest";
  }
}
