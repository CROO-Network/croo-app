import { publicRequest } from "@/lib/http/client";
import { toApiChain, type ChainId } from "@/lib/chains";

export type LiveStatsJson = {
  liveAgents: number;
  completedOrders: number;
};

export async function getLiveStats() {
  return publicRequest<LiveStatsJson>("/backend/v1/stats/live");
}

export type FeaturedAgentStatsJson = {
  orders: number;
  completionRate: number;
  revenue: number;
  feedbackCount?: number | string;
  score?: number;
};

export type FeaturedAgentJson = {
  id: string;
  name: string;
  avatar: string;
  description: string;
  stats?: FeaturedAgentStatsJson;
  status: string;
};

export async function getFeaturedAgents(chain?: ChainId) {
  const q = new URLSearchParams();
  if (chain === "base" || chain === "bsc") q.set("chain", toApiChain(chain));
  const qs = q.toString();
  return publicRequest<{ agents: FeaturedAgentJson[] }>(
    `/backend/v1/stats/featured${qs ? `?${qs}` : ""}`,
  );
}
