"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { formatCompletionRatePct, formatScore, formatVolume, formatNumber, hasDiscoveryMoney } from "@/lib/formatters";
import type { Agent } from "@/lib/mock-data";
import PriceValue, { DiscoveryMoney } from "@/components/shared/PriceValue";
import { ResolvedAgentAvatar } from "@/components/shared/ResolvedAgentAvatar";
import { useChain } from "@/lib/chain-context";
import { isDiscoveryRecord } from "@/lib/chains";
import { agentDetailHref, getPublicAgent } from "@/lib/api/discovery";
import { mapPublicAgentSummaryToAgent } from "@/lib/agent-mapper";

interface AgentListItemProps {
  agent: Agent;
}

function Stat({
  label,
  value,
  tone = "default",
  allChains,
}: {
  label: string;
  value: ReactNode;
  tone?: "default" | "positive";
  allChains?: ReactNode;
}) {
  const valueColor = tone === "positive" ? "text-[#3D8C1F]" : "text-[#0F0F0F]";
  return (
    <div>
      <p className="text-[8px] font-mono text-[#9A9A9A] uppercase tracking-wider whitespace-nowrap">
        {label}
      </p>
      <p className={`text-sm font-mono font-semibold tabular-nums ${valueColor}`}>{value}</p>
      {allChains && (
        <p className="mt-0.5 text-[9px] font-mono text-[#9A9A9A] tabular-nums whitespace-nowrap">
          All chains <span className="font-semibold text-[#6B6B6B]">{allChains}</span>
        </p>
      )}
    </div>
  );
}

export default function AgentListItem({ agent }: AgentListItemProps) {
  const { meta, isInteractive } = useChain();
  const visibleTags = agent.tags.slice(0, 3);
  const isOnline = agent.status === "online";
  const discovery = isDiscoveryRecord(agent.chain, isInteractive);
  const showRate = !discovery && meta.hasCompletionRate;
  const volumeText = formatVolume;
  const showPresence = !discovery;
  const linkedId = agent.linkedAgentId?.trim() || "";
  const isMultiChain = (agent.chains?.length ?? 0) > 1;
  const [linked, setLinked] = useState<{ id: string; orders: number; volume: number } | null>(null);

  useEffect(() => {
    if (!linkedId || !isMultiChain) return;
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
        /* hide the all-chains line until the other chain loads */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [linkedId, isMultiChain]);

  const showAllChains = Boolean(linked?.id === linkedId && isMultiChain);

  return (
    <Link href={agentDetailHref(agent.id)} className="block">
      <div className="group flex items-center gap-4 rounded-2xl border border-[#E2E2E0] bg-white p-5 transition-all hover:border-[#C2C2C0] hover:shadow-sm cursor-pointer">
        <ResolvedAgentAvatar
          avatar={agent.avatar}
          name={agent.name}
          className="w-10 h-10 rounded-xl ring-1 ring-black/10 bg-[#F5F5F3] object-cover shrink-0"
        />

        <div className="min-w-0 max-w-2xl flex-1">
          <div className="flex items-center gap-2 mb-0.5">
            <h3 className="text-sm font-semibold text-[#0F0F0F] truncate group-hover:text-[#3D8C1F] transition-colors duration-200">
              {agent.name}
            </h3>
            {showPresence ? (
            <span className="flex items-center gap-1 shrink-0">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isOnline ? "bg-[#6EE646] animate-pulse" : "bg-[#9A9A9A]"
                }`}
              />
              <span className="text-[9px] font-mono text-[#9A9A9A] uppercase tracking-wider">
                {isOnline ? "Live" : "Offline"}
              </span>
            </span>
            ) : null}
          </div>
          <p className="text-xs text-[#9A9A9A] truncate">
            {agent.description}
          </p>
        </div>

        {discovery ? null : (
        <div className="hidden 2xl:flex items-center gap-1.5 shrink-0">
          {visibleTags.map((tag) => (
            <span
              key={tag}
              className="text-[10px] px-2 py-0.5 rounded-full bg-[#EBEBEA] text-[#3A3A3A] font-medium whitespace-nowrap"
            >
              {tag}
            </span>
          ))}
        </div>
        )}

        <div className="hidden sm:ml-auto sm:flex items-start gap-5 shrink-0 text-right">
          {discovery && (
            <>
              <Stat
                label="Overall Score"
                value={formatScore(agent.score)}
                tone="positive"
              />
              <Stat label="Feedback" value={formatNumber(agent.feedbackCount ?? 0)} />
            </>
          )}
          <Stat
            label="Orders"
            value={formatNumber(agent.stats.totalOrders)}
            allChains={showAllChains ? formatNumber(agent.stats.totalOrders + (linked?.orders ?? 0)) : undefined}
          />
          {showRate && (
            <Stat
              label="Rate"
              value={formatCompletionRatePct(agent.stats.completionRate)}
              tone="positive"
            />
          )}
          {discovery && !hasDiscoveryMoney(agent.stats.totalVolume) ? null : (
          <Stat
            label="Volume"
            value={discovery ? <DiscoveryMoney amount={agent.stats.totalVolume} /> : volumeText(agent.stats.totalVolume)}
            allChains={
              showAllChains
                ? discovery
                  ? <DiscoveryMoney amount={agent.stats.totalVolume + (linked?.volume ?? 0)} />
                  : volumeText(agent.stats.totalVolume + (linked?.volume ?? 0))
                : undefined
            }
          />
          )}
        </div>

        {discovery && !hasDiscoveryMoney(agent.lowestPrice) ? null : (
        <div className="shrink-0 text-right min-w-[80px]">
          <p className="text-xs text-[#9A9A9A]">From</p>
          <PriceValue
            amount={agent.lowestPrice}
            className="text-sm font-semibold text-[#0F0F0F]"
          />
        </div>
        )}
      </div>
    </Link>
  );
}
