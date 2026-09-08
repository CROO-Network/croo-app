import { publicRequest } from "@/lib/http/client";
import { ApiError } from "@/lib/http/errors";
import { toApiChain, type ChainId } from "@/lib/chains";

/** Keep `:` in `bsc:{token_id}` path IDs; encode everything else. */
export function encodePublicId(id: string): string {
  return encodeURIComponent(id).replace(/%3A/gi, ":");
}

/** Decode a route/query public id; leaves already-decoded values unchanged. */
export function decodePublicId(id: string): string {
  try {
    return decodeURIComponent(id);
  } catch {
    return id;
  }
}

/**
 * Store detail path for an opaque public agent id.
 * Colons become extra path segments so Next.js can route `bsc:49637`
 * as `/agents/bsc/49637` instead of a broken `/agents/bsc:49637`.
 */
export function agentDetailHref(
  agentId: string,
  query?: Record<string, string>,
): string {
  const path = String(agentId)
    .split(":")
    .filter((part) => part.length > 0)
    .map((part) => encodeURIComponent(part))
    .join("/");
  const qs = query ? `?${new URLSearchParams(query).toString()}` : "";
  return `/agents/${path}${qs}`;
}

/** Reconstruct the opaque agent id from `/agents/[...id]`. */
export function agentIdFromRouteParams(id: string | string[] | undefined): string {
  const parts = (Array.isArray(id) ? id : id ? [id] : []).map(decodePublicId);
  return parts.join(":");
}

/** BSC public ids are `bsc:{token_id}`; Base ids are unprefixed UUIDs. */
export function chainFromPublicId(id: string): ChainId | undefined {
  const prefix = String(id).split(":")[0]?.toLowerCase();
  return prefix === "bsc" || prefix === "base" ? prefix : undefined;
}

function setChainParam(q: URLSearchParams, chain?: ChainId) {
  if (chain === "base" || chain === "bsc") q.set("chain", toApiChain(chain));
}

/** Kratos HTTP uses protobuf JSON names (lowerCamelCase), not Go struct `json:"snake"` tags. */
export type PublicAgentSummaryJson = {
  agentId: string;
  name: string;
  description: string;
  avatar: string;
  status: string;
  createdTime: string;
  minServicePrice: number;
  completedOrders: number;
  totalEarned: number;
  totalVolume: number;
  completionRate: number;
  avgDeliveryText: string;
  onlineStatus: string;
  skillTagSlugs?: string[];
  chain?: string;
  chains?: string[];
  linkedAgentId?: string;
  externalUrl?: string;
  feedbackCount?: number | string;
  score?: number;
};

export type PublicServiceBriefJson = {
  serviceId: string;
  name: string;
  price: number;
  slaMinutes: number;
  description?: string;
  orders7d?: number | string;
  requirementType?: string;
  requirementText?: string;
  requirementSchema?: string;
  deliverableType?: string;
  deliverableText?: string;
  deliverableSchema?: string;
};

export type PublicAgentDetailJson = PublicAgentSummaryJson & {
  skillTagSlugs: string[];
  services: PublicServiceBriefJson[];
  walletAddress?: string;
};

export type ListPublicAgentsParams = {
  chain?: ChainId;
  tags?: string;
  min_price?: number;
  max_price?: number;
  search?: string;
  sort?: string;
  page?: number;
  page_size?: number;
};

export function listPublicAgentsQuery(params: ListPublicAgentsParams): string {
  const q = new URLSearchParams();
  if (params.tags) q.set("tags", params.tags);
  if (params.min_price != null && params.min_price > 0) q.set("min_price", String(params.min_price));
  if (params.max_price != null && params.max_price > 0) q.set("max_price", String(params.max_price));
  if (params.search) q.set("search", params.search);
  if (params.sort) q.set("sort", params.sort);
  setChainParam(q, params.chain);
  q.set("page", String(params.page ?? 1));
  q.set("page_size", String(params.page_size ?? 20));
  const s = q.toString();
  return s ? `?${s}` : "";
}

export async function listPublicAgents(params: ListPublicAgentsParams) {
  const qs = listPublicAgentsQuery(params);
  return publicRequest<{ agents: PublicAgentSummaryJson[]; total: number }>(
    `/backend/v1/public/agents${qs}`
  );
}

async function requestPublicAgent(agentId: string, chain?: ChainId) {
  const id = encodePublicId(agentId);
  const q = new URLSearchParams();
  setChainParam(q, chain);
  const qs = q.toString();
  return publicRequest<{ agent: PublicAgentDetailJson }>(
    `/backend/v1/public/agents/${id}${qs ? `?${qs}` : ""}`,
  );
}

export async function getPublicAgent(agentId: string, chain?: ChainId) {
  const primary = chainFromPublicId(agentId) ?? chain;
  try {
    return await requestPublicAgent(agentId, primary);
  } catch (e) {
    // Empty chain is treated as base. BSC ids 404 unless chain=bsc, and a
    // Base id fetched with chain=bsc 404s the other way — try the other pool.
    if (e instanceof ApiError && e.status === 404) {
      const other: ChainId = primary === "bsc" ? "base" : "bsc";
      if (other !== primary) {
        try {
          return await requestPublicAgent(agentId, other);
        } catch {
          throw e;
        }
      }
    }
    throw e;
  }
}

export type PublicTagJson = {
  id: number;
  slug: string;
  name: string;
  parentId: number;
  sortOrder: number;
};

/** Wire shape from Kratos/proto JSON (`json` struct tags use snake_case on int64 fields). */
type PublicTagWire = Partial<PublicTagJson> & {
  parent_id?: number | string;
  sort_order?: number | string;
  id?: number | string;
};

function num(v: unknown, fallback = 0): number {
  if (v === null || v === undefined) return fallback;
  if (typeof v === "number" && !Number.isNaN(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isNaN(n) ? fallback : n;
  }
  return fallback;
}

/** Normalize tags from GET /public/tags for client code (camelCase + numeric fields). */
export function normalizePublicTags(tags: unknown): PublicTagJson[] {
  if (!Array.isArray(tags)) return [];
  return tags.map((raw) => {
    const t = raw as PublicTagWire;
    return {
      id: num(t.id),
      slug: String(t.slug ?? ""),
      name: String(t.name ?? ""),
      parentId: num(t.parentId ?? t.parent_id, 0),
      sortOrder: num(t.sortOrder ?? t.sort_order, 0),
    };
  });
}

export async function getPublicTags() {
  const res = await publicRequest<{ tags: unknown }>("/backend/v1/public/tags");
  return { tags: normalizePublicTags(res.tags) };
}

/** Protobuf JSON may emit int64 fields as decimal strings. */
export type PlatformStatsJson = {
  totalAgents: number | string;
  totalServices: number | string;
  totalOrders: number | string;
  /** Cumulative completed-order volume: `sum(amount + gas_amount)` in **USDC micro units** (6 decimals), same as `orders.amount`. */
  totalVolume: number | string;
  updatedTimeUnix: number | string;
};

export async function getPlatformStats() {
  return publicRequest<PlatformStatsJson>("/backend/v1/public/platform-stats");
}

export async function listTrendingAgents(limit = 12, chain?: ChainId) {
  const q = new URLSearchParams({ limit: String(limit) });
  setChainParam(q, chain);
  return publicRequest<{ agents: PublicAgentSummaryJson[] }>(
    `/backend/v1/public/trending-agents?${q}`
  );
}

export type PublicPopularServiceItemJson = {
  serviceId: string;
  agentId: string;
  serviceName: string;
  description?: string;
  price: number;
  slaMinutes: number;
  orders7d: number;
  agentName: string;
  agentAvatar: string;
  chain?: string;
};

export async function listPopularServices(limit = 12, chain?: ChainId) {
  const q = new URLSearchParams({ limit: String(limit) });
  setChainParam(q, chain);
  return publicRequest<{ items: PublicPopularServiceItemJson[] }>(
    `/backend/v1/public/popular-services?${q}`
  );
}

export type LiveFeedEventItemJson = {
  id: number | string;
  eventType: string;
  refType: string;
  refId: string;
  metadataJson: string;
  createdTime: string;
  avatar?: string;
  agentName?: string;
  serviceName?: string;
  chain?: string;
};

export async function listLiveFeedEvents(page = 1, pageSize = 10, chain?: ChainId) {
  const q = new URLSearchParams({
    page: String(page),
    page_size: String(pageSize),
  });
  setChainParam(q, chain);
  return publicRequest<{ items: LiveFeedEventItemJson[]; total: number }>(
    `/backend/v1/public/live-feed?${q}`
  );
}

export type LeaderboardEntryJson = {
  agentId: string;
  name: string;
  avatar: string;
  totalEarned: number;
  totalVolume: number;
  completedOrders: number;
  createdTime: string;
};

export async function getPublicLeaderboard(dimension: string, limit = 20) {
  const q = new URLSearchParams({ dimension, limit: String(limit) });
  return publicRequest<{ entries: LeaderboardEntryJson[] }>(
    `/backend/v1/public/leaderboard?${q}`
  );
}

export type SearchPublicAgentJson = {
  agentId: string;
  name: string;
  subtitle: string;
  minServicePrice: number;
  avatar?: string;
  chain?: string;
};

export type SearchPublicServiceJson = {
  serviceId: string;
  name: string;
  subtitle: string;
  agentId: string;
  price: number;
  slaMinutes: number;
  agentName: string;
  agentAvatar?: string;
  chain?: string;
  externalUrl?: string;
};

export async function searchPublic(q: string, page = 1, pageSize = 20, chain?: ChainId) {
  const params = new URLSearchParams({
    q: q.trim(),
    page: String(page),
    page_size: String(pageSize),
  });
  setChainParam(params, chain);
  return publicRequest<{
    agents: SearchPublicAgentJson[];
    services: SearchPublicServiceJson[];
    total: number;
  }>(`/backend/v1/public/search?${params}`);
}

export type PublicOrderActivityItemJson = {
  orderId: string;
  buyerAddrShort: string;
  serviceName: string;
  amount: number | string;
  status: string;
  paidAt: string;
  deliveredAt: string;
  /** Completion/settlement time for "Clear" step (RFC3339). */
  settledAt?: string;
  expiredAt?: string;
  rejectedAt?: string;
  rejectReason?: string;
  clearTxHash: string;
  refundTxHash?: string;
  rejectTxHash?: string;
  refund_tx_hash?: string;
  reject_tx_hash?: string;
  payTxHash: string;
  deliverTxHash: string;
  createTxHash: string;
};

async function requestPublicAgentActivity(
  agentId: string,
  opts: { page?: number; page_size?: number; status?: string; chain?: ChainId } = {},
) {
  const id = encodePublicId(agentId);
  const q = new URLSearchParams();
  q.set("page", String(opts.page ?? 1));
  q.set("page_size", String(opts.page_size ?? 20));
  if (opts.status) q.set("status", opts.status);
  setChainParam(q, opts.chain);
  return publicRequest<{ items: PublicOrderActivityItemJson[]; total: number }>(
    `/backend/v1/public/agents/${id}/activity?${q}`,
  );
}

export async function getPublicAgentActivity(
  agentId: string,
  opts: { page?: number; page_size?: number; status?: string; chain?: ChainId } = {},
) {
  const primary = opts.chain ?? chainFromPublicId(agentId);
  const first = { ...opts, chain: primary };
  try {
    return await requestPublicAgentActivity(agentId, first);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) {
      const other: ChainId = primary === "bsc" ? "base" : "bsc";
      if (other !== primary) {
        try {
          return await requestPublicAgentActivity(agentId, { ...opts, chain: other });
        } catch {
          throw e;
        }
      }
    }
    throw e;
  }
}

export type PublicServiceListItemJson = {
  serviceId: string;
  agentId: string;
  name: string;
  description: string;
  price: number;
  slaMinutes: number;
  /** Rolling 7d count from service_stats.orders_7d (sort + display). */
  orders7d: number;
  /** Present if backend adds join fields to JSON */
  agentName?: string;
  agentAvatar?: string;
  chain?: string;
};

export type ListPublicServicesParams = {
  chain?: ChainId;
  search?: string;
  page?: number;
  page_size?: number;
  min_price?: number;
  max_price?: number;
};

export function listPublicServicesQuery(params: ListPublicServicesParams): string {
  const q = new URLSearchParams();
  if (params.search) q.set("search", params.search);
  if (params.min_price != null && params.min_price > 0) q.set("min_price", String(params.min_price));
  if (params.max_price != null && params.max_price > 0) q.set("max_price", String(params.max_price));
  setChainParam(q, params.chain);
  q.set("page", String(params.page ?? 1));
  q.set("page_size", String(params.page_size ?? 20));
  const s = q.toString();
  return s ? `?${s}` : "";
}

export async function listPublicServices(params: ListPublicServicesParams = {}) {
  const qs = listPublicServicesQuery(params);
  return publicRequest<{ items: PublicServiceListItemJson[]; total: number }>(
    `/backend/v1/public/services${qs}`,
  );
}
