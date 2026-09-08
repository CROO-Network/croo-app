"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { Agent } from "@/lib/mock-data";
import { formatCompletionRatePct, formatNumber, formatVolume, hasDiscoveryMoney } from "@/lib/formatters";
import { DiscoveryMoney } from "@/components/shared/PriceValue";
import { useChain } from "@/lib/chain-context";
import { isDiscoveryRecord } from "@/lib/chains";
import { getPublicAgent } from "@/lib/api/discovery";
import { mapPublicAgentSummaryToAgent } from "@/lib/agent-mapper";

interface AgentStatsProps {
  agent: Agent;
}

type StatCell = {
  label: string;
  value: ReactNode;
  color: string;
  hint?: string;
  allChains?: ReactNode;
};

type LinkedTotals = {
  id: string;
  orders: number;
  volume: number;
};

export default function AgentStats({ agent }: AgentStatsProps) {
  const { meta, isInteractive } = useChain();
  const discovery = isDiscoveryRecord(agent.chain, isInteractive);
  const linkedId = agent.linkedAgentId?.trim() || "";
  const [linked, setLinked] = useState<LinkedTotals | null>(null);

  useEffect(() => {
    if (!linkedId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await getPublicAgent(linkedId);
        if (cancelled || !res.agent) return;
        const mapped = mapPublicAgentSummaryToAgent(res.agent);
        setLinked({
          id: linkedId,
          orders: mapped.stats.totalOrders,
          volume: mapped.stats.totalVolume,
        });
      } catch {
        /* leave linked unmatched so the all-chains line stays hidden */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [linkedId]);

  const linkedTotals = linked?.id === linkedId ? linked : null;
  const showAllChains = Boolean(linkedTotals && (agent.chains?.length ?? 0) > 1);
  const stats: StatCell[] = discovery
    ? [
        {
          label: "Overall Score",
          value:
            agent.score != null && Number.isFinite(agent.score) && agent.score > 0
              ? formatNumber(agent.score)
              : "—",
          color: "text-[#3D8C1F]",
        },
        {
          label: "Feedback",
          value: formatNumber(agent.feedbackCount ?? 0),
          color: "text-[#0F0F0F]",
        },
        {
          label: "Total Orders",
          value: formatNumber(agent.stats.totalOrders),
          color: "text-[#0F0F0F]",
          allChains: showAllChains
            ? formatNumber(agent.stats.totalOrders + (linkedTotals?.orders ?? 0))
            : undefined,
        },
        {
          label: "Total Volume",
          value: hasDiscoveryMoney(agent.stats.totalVolume) ? (
            <DiscoveryMoney amount={agent.stats.totalVolume} />
          ) : (
            "—"
          ),
          color: "text-[#0F0F0F]",
          allChains: showAllChains ? (
            hasDiscoveryMoney(agent.stats.totalVolume + (linkedTotals?.volume ?? 0)) ? (
              <DiscoveryMoney amount={agent.stats.totalVolume + (linkedTotals?.volume ?? 0)} />
            ) : (
              "—"
            )
          ) : undefined,
        },
        {
          label: "Avg Delivery",
          value: agent.stats.avgDeliveryTime,
          color: "text-[#0F0F0F]",
        },
      ]
    : [
        {
          label: "Total Orders",
          value: formatNumber(agent.stats.totalOrders),
          color: "text-[#0F0F0F]",
          allChains: showAllChains
            ? formatNumber(agent.stats.totalOrders + (linkedTotals?.orders ?? 0))
            : undefined,
        },
        {
          label: "Total Volume",
          value: formatVolume(agent.stats.totalVolume),
          color: "text-[#0F0F0F]",
          allChains: showAllChains
            ? formatVolume(agent.stats.totalVolume + (linkedTotals?.volume ?? 0))
            : undefined,
        },
        ...(meta.hasCompletionRate
          ? [
              {
                label: "Completion Rate",
                value: formatCompletionRatePct(agent.stats.completionRate),
                color: "text-[#3D8C1F]",
              },
            ]
          : []),
        {
          label: "Avg Delivery",
          value: agent.stats.avgDeliveryTime,
          color: "text-[#0F0F0F]",
        },
      ];

  return (
    <div
      className={`grid grid-cols-2 gap-px rounded-2xl overflow-hidden bg-[#E8E8E6] mb-6 ${
        stats.length >= 5
          ? "md:grid-cols-5"
          : stats.length >= 4
            ? "md:grid-cols-4"
            : stats.length === 3
              ? "md:grid-cols-3"
              : "md:grid-cols-2"
      }`}
    >
      {stats.map((stat) => (
        <div key={stat.label} className="bg-white px-5 py-4">
          <p className="text-[9px] font-mono text-[#9A9A9A] uppercase tracking-wider mb-1">
            {stat.label}
          </p>
          <p className={`text-lg font-mono font-semibold ${stat.color}`}>
            {stat.value}
          </p>
          {stat.allChains && (
            <p className="mt-1 text-[10px] font-mono text-[#9A9A9A]">
              All chains{" "}
              <span className="font-semibold text-[#6B6B6B]">{stat.allChains}</span>
            </p>
          )}
          {stat.hint && (
            <p className="mt-1 text-[10px] font-mono text-[#9A9A9A]">{stat.hint}</p>
          )}
        </div>
      ))}
    </div>
  );
}
