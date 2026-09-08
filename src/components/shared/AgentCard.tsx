"use client";

import Link from "next/link";
import { formatCompletionRatePct, formatVolume, formatNumber, hasDiscoveryMoney } from "@/lib/formatters";
import type { Agent } from "@/lib/mock-data";
import PriceValue, { DiscoveryMoney } from "@/components/shared/PriceValue";
import { ResolvedAgentAvatar } from "@/components/shared/ResolvedAgentAvatar";
import { useChain } from "@/lib/chain-context";
import { isDiscoveryRecord } from "@/lib/chains";
import { agentDetailHref } from "@/lib/api/discovery";

interface AgentCardProps {
  agent: Agent;
}

export default function AgentCard({ agent }: AgentCardProps) {
  const { meta, isInteractive } = useChain();
  const visibleTags = agent.tags.slice(0, 3);
  const extraTags = agent.tags.length - 3;
  const isOnline = agent.status === "online";
  const discovery = isDiscoveryRecord(agent.chain, isInteractive);
  const showRate = !discovery && meta.hasCompletionRate;
  const showPresence = !discovery;

  return (
    <Link href={agentDetailHref(agent.id)} className="block h-full">
      <div className="group flex h-full flex-col rounded-2xl border border-[#E2E2E0] bg-white p-6 transition-all hover:border-[#C2C2C0] hover:shadow-sm cursor-pointer">
        {/* Top row: avatar + status */}
        <div className="flex items-start justify-between mb-5">
          <ResolvedAgentAvatar
            avatar={agent.avatar}
            name={agent.name}
            className="w-12 h-12 rounded-[0.95rem] ring-1 ring-black/10 bg-[#F5F5F3] object-cover"
          />
          {showPresence ? (
          <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full ${isOnline ? 'bg-[#6EE646]/10' : 'bg-[#E2E2E0]/50'}`}>
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isOnline ? "bg-[#6EE646] animate-pulse" : "bg-[#9A9A9A]"
              }`}
            />
            <span className={`text-[9px] font-mono uppercase tracking-wider ${isOnline ? 'text-[#3D8C1F]' : 'text-[#9A9A9A]'}`}>
              {isOnline ? "Live" : "Offline"}
            </span>
          </div>
          ) : null}
        </div>

        {/* Name */}
        <h3 className="text-base font-semibold text-[#0F0F0F] mb-1.5 group-hover:text-[#3D8C1F] transition-colors duration-200 truncate">
          {agent.name}
        </h3>

        {/* Description */}
        <p className="text-sm text-[#9A9A9A] mb-4 leading-snug line-clamp-3 min-h-[3.9rem]">
          {agent.description}
        </p>

        {discovery ? null : (
        <div className="flex flex-wrap gap-1.5 mb-5">
          {visibleTags.map((tag) => (
            <span
              key={tag}
              className="text-[10px] px-2.5 py-0.5 rounded-full bg-[#EBEBEA] text-[#3A3A3A] font-medium"
            >
              {tag}
            </span>
          ))}
          {extraTags > 0 && (
            <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-[#EBEBEA] text-[#9A9A9A] font-medium">
              +{extraTags}
            </span>
          )}
        </div>
        )}

        {/* Spacer */}
        <div className="mt-auto" />

        {/* Stats row */}
        <div className="flex items-center gap-px rounded-xl overflow-hidden bg-[#E8E8E6]">
          <div className="flex-1 bg-white px-4 py-3">
            <p className="text-[8px] font-mono text-[#9A9A9A] uppercase tracking-wider mb-0.5">Orders</p>
            <p className="text-sm font-mono font-semibold text-[#0F0F0F]">{formatNumber(agent.stats.totalOrders)}</p>
          </div>
          {showRate && (
            <div className="flex-1 bg-white px-4 py-3">
              <p className="text-[8px] font-mono text-[#9A9A9A] uppercase tracking-wider mb-0.5">Completion</p>
              <p className="text-sm font-mono font-semibold text-[#3D8C1F]">
                {formatCompletionRatePct(agent.stats.completionRate)}
              </p>
            </div>
          )}
          {discovery && !hasDiscoveryMoney(agent.stats.totalVolume) ? null : (
          <div className="flex-1 bg-white px-4 py-3">
            <p className="text-[8px] font-mono text-[#9A9A9A] uppercase tracking-wider mb-0.5">Volume</p>
            <p className="text-sm font-mono font-semibold text-[#0F0F0F]">{discovery ? <DiscoveryMoney amount={agent.stats.totalVolume} /> : formatVolume(agent.stats.totalVolume)}</p>
          </div>
          )}
        </div>

        {discovery && !hasDiscoveryMoney(agent.lowestPrice) ? null : (
        <p className="text-sm text-[#6B6B6B] mt-4 flex items-center gap-1">
          From{" "}
          <PriceValue amount={agent.lowestPrice} className="font-semibold text-[#0F0F0F]" />
        </p>
        )}
      </div>
    </Link>
  );
}
