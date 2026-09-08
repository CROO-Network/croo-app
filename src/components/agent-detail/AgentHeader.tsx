"use client";

import CopyButton from "@/components/shared/CopyButton";
import MarkdownText from "@/components/shared/MarkdownText";
import { ResolvedAgentAvatar } from "@/components/shared/ResolvedAgentAvatar";
import { formatDate } from "@/lib/formatters";
import type { Agent } from "@/lib/mock-data";
import { truncateAddress } from "@/lib/formatters";
import { useNavigator } from "@/lib/navigator-context";
import { useChain } from "@/lib/chain-context";
import { getAgentHandoffUrl, isDiscoveryChain, isDiscoveryRecord } from "@/lib/chains";

interface AgentHeaderProps {
  agent: Agent;
}

export default function AgentHeader({ agent }: AgentHeaderProps) {
  const { openNavigator } = useNavigator();
  const { isInteractive } = useChain();
  const canOrder = isInteractive && !isDiscoveryChain(agent.chain);
  const showPresence = !isDiscoveryRecord(agent.chain, isInteractive);

  const statusConfig = {
    online: {
      badge: "bg-[#6EE646]/10",
      dot: "bg-[#6EE646] animate-pulse",
      text: "text-[#3D8C1F]",
      label: "Live",
    },
    offline: {
      badge: "bg-[#E2E2E0]/50",
      dot: "bg-[#9A9A9A]",
      text: "text-[#9A9A9A]",
      label: "Offline",
    },
    paused: {
      badge: "bg-[#F59E0B]/10",
      dot: "bg-[#F59E0B]",
      text: "text-[#B66A00]",
      label: "Paused",
    },
  } as const;
  const status = statusConfig[agent.status];

  return (
    <div className="bg-white border border-[#E2E2E0] rounded-2xl p-6 mb-4">
      <div className="flex items-start gap-5">
        {/* Avatar */}
        <ResolvedAgentAvatar
          avatar={agent.avatar}
          name={agent.name}
          className="w-16 h-16 rounded-[1.1rem] ring-1 ring-black/10 bg-[#F5F5F3] object-cover shrink-0"
        />

        {/* Info */}
        <div className="flex-1 min-w-0">
          {/* Name + Status + Hire */}
          <div className="flex items-center gap-3 mb-1.5">
            <h1 className="text-xl font-semibold text-[#0F0F0F] truncate">
              {agent.name}
            </h1>
            {showPresence ? (
            <div
              className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full shrink-0 ${status.badge}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
              <span className={`text-[9px] font-mono uppercase tracking-wider ${status.text}`}>
                {status.label}
              </span>
            </div>
            ) : null}

            {/* Hire CTA — same label; off Base it hands off to the provider */}
            <div className="ml-auto shrink-0">
              {canOrder ? (
                <button
                  type="button"
                  onClick={() =>
                    openNavigator({
                      type: "hire",
                      agentId: agent.id,
                      agentName: agent.name,
                      walletAddress: agent.wallet,
                    })
                  }
                  className="h-9 px-5 bg-[#0F0F0F] text-white text-sm font-medium rounded-full hover:bg-[#1A1A1A] transition-colors cursor-pointer"
                >
                  Hire
                </button>
              ) : (
                <a
                  href={getAgentHandoffUrl(agent)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-9 items-center rounded-full bg-[#0F0F0F] px-5 text-sm font-medium text-white transition-colors hover:bg-[#1A1A1A]"
                >
                  Hire
                </a>
              )}
            </div>
          </div>

          {/* Wallet + Joined */}
          <div className="flex items-center gap-4 mb-3">
            {agent.wallet ? (
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-mono text-[#9A9A9A]">
                  {truncateAddress(agent.wallet)}
                </span>
                <CopyButton value={agent.wallet} label="wallet address" />
              </div>
            ) : null}
            {agent.joinedAt ? (
              <span className="text-xs text-[#9A9A9A]">
                Joined {formatDate(agent.joinedAt)}
              </span>
            ) : null}
          </div>

          {/* Tags */}
          <div className="flex flex-wrap gap-1.5 mb-4">
            {agent.tags.map((tag) => (
              <span
                key={tag}
                className="text-[10px] px-2.5 py-0.5 rounded-full bg-[#EBEBEA] text-[#3A3A3A] font-medium"
              >
                {tag}
              </span>
            ))}
          </div>

          {/* Description (Markdown) */}
          <MarkdownText
            content={agent.description}
            className="text-sm text-[#6B6B6B] leading-relaxed"
          />
        </div>
      </div>
    </div>
  );
}
