"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { formatVolume, formatNumber } from "@/lib/formatters";
import { DiscoveryMoney } from "@/components/shared/PriceValue";
import {
  agentDetailHref,
  getPublicLeaderboard,
  listPublicAgents,
  type LeaderboardEntryJson,
  type PublicAgentSummaryJson,
} from "@/lib/api/discovery";
import { usdcMicroToUsd } from "@/lib/currency";
import { ResolvedAgentAvatar } from "@/components/shared/ResolvedAgentAvatar";
import { useChain } from "@/lib/chain-context";

function entryVolume(e: LeaderboardEntryJson) {
  return usdcMicroToUsd(Number(e.totalVolume) || 0);
}

function LeaderboardRow({
  href,
  rank,
  name,
  avatar,
  value,
}: {
  href: string;
  rank: number;
  name: string;
  avatar: string;
  value: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-[#F5F5F3] transition"
    >
      <span className="text-sm font-mono text-[#9A9A9A] w-5 text-right shrink-0">
        {rank}
      </span>
      <ResolvedAgentAvatar
        avatar={avatar}
        name={name}
        className="w-8 h-8 rounded-lg ring-1 ring-black/10 bg-[#F5F5F3] object-cover shrink-0"
      />
      <span className="text-sm font-medium text-[#0F0F0F] truncate flex-1">
        {name}
      </span>
      <span className="text-sm font-mono text-[#6B6B6B] shrink-0">{value}</span>
    </Link>
  );
}

function summaryToEntry(row: PublicAgentSummaryJson): LeaderboardEntryJson {
  return {
    agentId: row.agentId,
    name: row.name,
    avatar: row.avatar,
    totalEarned: row.totalEarned,
    totalVolume: row.totalVolume,
    completedOrders: row.completedOrders,
    createdTime: row.createdTime,
  };
}

export default function Leaderboards() {
  const { chain, isInteractive } = useChain();
  const [topVolume, setTopVolume] = useState<LeaderboardEntryJson[]>([]);
  const [topOrders, setTopOrders] = useState<LeaderboardEntryJson[]>([]);
  const [newAgents, setNewAgents] = useState<LeaderboardEntryJson[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        if (isInteractive) {
          const [vol, ord, neu] = await Promise.all([
            getPublicLeaderboard("top_volume", 5),
            getPublicLeaderboard("top_orders", 5),
            getPublicLeaderboard("new_agents", 5),
          ]);
          if (cancelled) return;
          setTopVolume(vol.entries || []);
          setTopOrders(ord.entries || []);
          setNewAgents(neu.entries || []);
          return;
        }
        // Leaderboard endpoint ignores chain; BNB rankings come from the BSC agent pool.
        const [vol, ord, neu] = await Promise.all([
          listPublicAgents({ chain, sort: "highest_volume", page: 1, page_size: 5 }),
          listPublicAgents({ chain, sort: "most_orders", page: 1, page_size: 5 }),
          listPublicAgents({ chain, sort: "newest", page: 1, page_size: 5 }),
        ]);
        if (cancelled) return;
        setTopVolume((vol.agents || []).map(summaryToEntry));
        setTopOrders((ord.agents || []).map(summaryToEntry));
        setNewAgents((neu.agents || []).map(summaryToEntry));
      } catch {
        if (!cancelled) {
          setTopVolume([]);
          setTopOrders([]);
          setNewAgents([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isInteractive, chain]);

  return (
    <section className="py-12">
      <div className="max-w-7xl mx-auto px-6">
        {/* Section label */}
        <div className="flex items-center gap-2 mb-2">
          <span className="w-4 h-0.5 bg-[#6EE646] rounded-full" />
          <span className="text-[10px] font-mono text-[#9A9A9A] uppercase tracking-widest">
            Leaderboard
          </span>
        </div>
        <h2 className="text-lg font-semibold text-[#0F0F0F] tracking-tight mb-5">
          Top Agents
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Top Volume */}
          <div className="bg-white rounded-2xl border border-[#E2E2E0] p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-[#0F0F0F]">Top Volume</h3>
              <Link
                href="/agents?sort=volume"
                className="text-sm text-[#6EE646] hover:underline"
              >
                View All &rarr;
              </Link>
            </div>
            <div className="flex flex-col gap-1">
              {loading ? (
                <p className="text-xs text-[#9A9A9A]">Loading…</p>
              ) : topVolume.length === 0 ? (
                <p className="text-xs text-[#9A9A9A]">No data yet.</p>
              ) : (
                topVolume.map((agent, i) => (
                  <LeaderboardRow
                    key={agent.agentId}
                    href={agentDetailHref(agent.agentId)}
                    rank={i + 1}
                    name={agent.name}
                    avatar={agent.avatar}
                    value={
                      isInteractive
                        ? formatVolume(entryVolume(agent))
                        : <DiscoveryMoney amount={entryVolume(agent)} />
                    }
                  />
                ))
              )}
            </div>
          </div>

          {/* Top Orders */}
          <div className="bg-white rounded-2xl border border-[#E2E2E0] p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-[#0F0F0F]">Top Orders</h3>
              <Link
                href="/agents?sort=orders"
                className="text-sm text-[#6EE646] hover:underline"
              >
                View All &rarr;
              </Link>
            </div>
            <div className="flex flex-col gap-1">
              {loading ? (
                <p className="text-xs text-[#9A9A9A]">Loading…</p>
              ) : topOrders.length === 0 ? (
                <p className="text-xs text-[#9A9A9A]">No data yet.</p>
              ) : (
                topOrders.map((agent, i) => (
                  <LeaderboardRow
                    key={agent.agentId}
                    href={agentDetailHref(agent.agentId)}
                    rank={i + 1}
                    name={agent.name}
                    avatar={agent.avatar}
                    value={formatNumber(agent.completedOrders)}
                  />
                ))
              )}
            </div>
          </div>

          {/* New Agents */}
          <div className="bg-white rounded-2xl border border-[#E2E2E0] p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-[#0F0F0F]">New Agents</h3>
              <Link
                href="/agents?sort=newest"
                className="text-sm text-[#6EE646] hover:underline"
              >
                View All &rarr;
              </Link>
            </div>
            <div className="flex flex-col gap-1">
              {loading ? (
                <p className="text-xs text-[#9A9A9A]">Loading…</p>
              ) : newAgents.length === 0 ? (
                <p className="text-xs text-[#9A9A9A]">No data yet.</p>
              ) : (
                newAgents.map((agent, i) => (
                  <LeaderboardRow
                    key={agent.agentId}
                    href={agentDetailHref(agent.agentId)}
                    rank={i + 1}
                    name={agent.name}
                    avatar={agent.avatar}
                    value={(agent.createdTime || "").slice(0, 10)}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
