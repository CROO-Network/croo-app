"use client";

import { useState, useEffect, useCallback, type ReactNode } from "react";
import Link from "next/link";
import CopyButton from "@/components/shared/CopyButton";
import FilterPills from "@/components/shared/FilterPills";
import Reveal from "@/components/shared/Reveal";
import TopUpModal from "@/components/shared/TopUpModal";
import { ResolvedAgentAvatar } from "@/components/shared/ResolvedAgentAvatar";
import StatusBadge from "@/components/shared/StatusBadge";
import WithdrawModal from "@/components/shared/WithdrawModal";
import { fmtUsd, formatCompletionRatePct, formatVolume, truncateAddress } from "@/lib/formatters";
import { isNavigatorAgentType, listMyAgents } from "@/lib/api/agent";
import { agentDetailHref } from "@/lib/api/discovery";
import { agentInfoToMyAgentListItem } from "@/lib/my-agent-mapper";
import type { MyAgent } from "@/lib/mock-data";

/* ── Info tooltip ──────────────────────────────── */

function InfoTip({ children }: { children: ReactNode }) {
  return (
    <div className="relative group/tip inline-flex items-center shrink-0">
      <svg
        width="10"
        height="10"
        viewBox="0 0 12 12"
        fill="none"
        className="text-[#C4C4C2] group-hover/tip:text-[#9A9A9A] transition-colors cursor-default"
        aria-hidden="true"
      >
        <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.2" />
        <path d="M6 5.5v3M6 3.8h.01" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 hidden group-hover/tip:block pointer-events-none w-44">
        <div className="rounded-lg bg-[#0F0F0F] px-2.5 py-2 text-[10px] leading-relaxed text-white shadow-lg">
          {children}
        </div>
        <div className="mx-auto mt-0.5 h-0 w-0 border-x-4 border-t-4 border-x-transparent border-t-[#0F0F0F]" />
      </div>
    </div>
  );
}

/* ── Agent card ────────────────────────────────── */

type AgentFilter = "all" | "online" | "offline" | "draft";

const filterPills: Array<{ key: AgentFilter; label: string }> = [
  { key: "all", label: "All" },
  { key: "online", label: "Online" },
  { key: "offline", label: "Offline" },
  { key: "draft", label: "Draft" },
];

function AgentCard({
  agent,
  onWithdrawSubmitted,
}: {
  agent: MyAgent;
  onWithdrawSubmitted: (agentId: string, previousBalance: number) => boolean | Promise<boolean>;
}) {
  return (
    <div className="rounded-2xl border border-[#E2E2E0] bg-white p-5 transition-colors hover:border-[#6EE646]/30">
      {/* Row 1: avatar + name + status + CTAs */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <ResolvedAgentAvatar
            avatar={agent.avatar}
            name={agent.name}
            className="h-9 w-9 shrink-0 rounded-xl border border-[#E2E2E0] bg-[#F5F5F3] object-cover"
          />
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold text-[#0F0F0F]">{agent.name}</span>
            <StatusBadge status={agent.status} />
            {agent.status !== "draft" && agent.source && agent.source.toLowerCase() !== "custom" && (
              <span className="rounded bg-[#F5F5F3] px-1.5 py-0.5 text-[9px] font-mono text-[#9A9A9A]">{agent.source}</span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <Link
            href={`/account/agents/${agent.id}/configure`}
            className="text-[11px] font-medium text-[#9A9A9A] transition-colors hover:text-[#0F0F0F]"
          >
            Configure
          </Link>
          {agent.status !== "draft" && (
            <Link
              href={agentDetailHref(agent.id)}
              className="inline-flex items-center gap-0.5 text-[11px] font-medium text-[#6EE646] transition-colors hover:text-[#5DD835]"
            >
              View →
            </Link>
          )}
        </div>
      </div>

      {/* Row 2: wallet + balance + actions */}
      <div className="mt-2 ml-12 flex flex-wrap items-center gap-1.5 text-[11px] text-[#9A9A9A]">
        <span className="font-mono">{truncateAddress(agent.wallet.address)}</span>
        <CopyButton value={agent.wallet.address} />
        <span className="h-3 w-px bg-[#E2E2E0]" />
        <span className="font-mono font-medium text-[#0F0F0F]">{fmtUsd(agent.wallet.balance)}</span>
        <TopUpModal walletLabel={`${agent.name} Wallet`} walletAddress={agent.wallet.address}>
          <button className="ml-0.5 rounded-full border border-[#E2E2E0] px-2 py-0.5 text-[9px] text-[#6B6B6B] transition-colors hover:border-[#9A9A9A] hover:text-[#0F0F0F]">
            Top Up
          </button>
        </TopUpModal>
        <WithdrawModal
          agentId={agent.id}
          sourceKind="agent"
          walletLabel={`${agent.name} Wallet`}
          walletAddress={agent.wallet.address}
          balance={agent.wallet.balance}
          onWithdrawSubmitted={(previousBalance) => onWithdrawSubmitted(agent.id, previousBalance)}
        >
          <button className="rounded-full border border-[#E2E2E0] px-2 py-0.5 text-[9px] text-[#6B6B6B] transition-colors hover:border-[#9A9A9A] hover:text-[#0F0F0F]">
            Withdraw
          </button>
        </WithdrawModal>
      </div>

      {/* Row 3: stats. Corner rounding is per-cell so tooltips can escape the grid. */}
      <div className="mt-3 grid grid-cols-4 gap-px rounded-xl bg-[#E8E8E6]">
        <div className="bg-[#FCFCFB] px-3 py-2.5 rounded-l-xl">
          <p className="mb-0.5 text-[8px] font-mono uppercase tracking-[0.2em] text-[#9A9A9A]">Orders</p>
          <p className="text-sm font-mono font-semibold text-[#0F0F0F]">{agent.totalOrders.toLocaleString("en-US")}</p>
        </div>
        <div className="bg-[#FCFCFB] px-3 py-2.5">
          <div className="mb-0.5 flex items-center gap-1">
            <p className="text-[8px] font-mono uppercase tracking-[0.2em] text-[#9A9A9A]">Volume</p>
            <InfoTip>Total transaction volume, including both costs and revenue</InfoTip>
          </div>
          <p className="text-sm font-mono font-semibold text-[#0F0F0F]">{formatVolume(agent.totalVolume)}</p>
        </div>
        <div className="bg-[#FCFCFB] px-3 py-2.5">
          <p className="mb-0.5 text-[8px] font-mono uppercase tracking-[0.2em] text-[#9A9A9A]">Completion</p>
          <p className="text-sm font-mono font-semibold text-[#3D8C1F]">
            {formatCompletionRatePct(agent.completionRate)}
          </p>
        </div>
        <div className="bg-[#FCFCFB] px-3 py-2.5 rounded-r-xl">
          <div className="mb-0.5 flex items-center gap-1">
            <p className="text-[8px] font-mono uppercase tracking-[0.2em] text-[#9A9A9A]">Earnings</p>
            <InfoTip>Net revenue earned from completed orders</InfoTip>
          </div>
          <p className="text-sm font-mono font-semibold text-[#0F0F0F]">{fmtUsd(agent.totalEarned)}</p>
        </div>
      </div>
    </div>
  );
}

/* ── Page ───────────────────────────────────────── */

export default function MyAgentsPage() {
  const [filter, setFilter] = useState<AgentFilter>("all");
  const [agents, setAgents] = useState<MyAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshAgents = useCallback(async (changedAgentId: string, previousBalance: number) => {
    try {
      const res = await listMyAgents({ page: 1, page_size: 100 });
      const nextAgents = (res.agents || [])
        .filter((a) => !isNavigatorAgentType(a.agentType))
        .map(agentInfoToMyAgentListItem);
      setAgents(nextAgents);
      setError(null);
      const changedAgent = nextAgents.find((agent) => agent.id === changedAgentId);
      if (!changedAgent) return true;
      return Math.abs(changedAgent.wallet.balance - previousBalance) > 1e-9;
    } catch {
      setError("Could not load your agents.");
      return false;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await listMyAgents({ page: 1, page_size: 100 });
        if (cancelled) return;
        setAgents(
          (res.agents || [])
            .filter((a) => !isNavigatorAgentType(a.agentType))
            .map(agentInfoToMyAgentListItem),
        );
      } catch {
        if (!cancelled) {
          setAgents([]);
          setError("Could not load your agents.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const agentWalletTotal = agents.reduce((s, a) => s + a.wallet.balance, 0);
  const filtered = agents.filter((a) => {
    if (filter === "all") return true;
    if (filter === "offline") return a.status === "offline";
    return a.status === filter;
  });

  return (
    <div className="space-y-8">
      <Reveal>
        <div className="mb-4 flex items-center gap-3">
          <span className="h-px w-5 bg-[#6EE646]" />
          <span className="text-[10px] font-mono uppercase tracking-[0.24em] text-[#9A9A9A]">My Agents ({agents.length})</span>
          <span className="ml-auto flex items-baseline gap-1.5">
            <span className="text-[9px] font-mono uppercase tracking-wider text-[#9A9A9A]">Agent Wallets</span>
            <span className="text-sm font-mono font-medium text-[#0F0F0F] tabular-nums">{fmtUsd(agentWalletTotal)}</span>
          </span>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-3">
          <FilterPills
            items={filterPills}
            activeKey={filter}
            onSelect={setFilter}
          />
        </div>

        {error && <p className="text-xs text-amber-700 font-mono mb-2">{error}</p>}

        <div className="space-y-3">
          {loading ? (
            <div className="rounded-2xl border border-[#E2E2E0] bg-white px-6 py-12 text-center text-sm text-[#9A9A9A]">
              Loading agents…
            </div>
          ) : (
            <>
              {filtered.map((agent, i) => (
                <Reveal key={agent.id} delay={i * 50}>
                  <AgentCard agent={agent} onWithdrawSubmitted={refreshAgents} />
                </Reveal>
              ))}
              {filtered.length === 0 && (
                <div className="rounded-2xl border border-dashed border-[#E2E2E0] bg-white px-6 py-12 text-center">
                  <p className="text-sm text-[#9A9A9A]">
                    {agents.length === 0 ? "You have no agents yet." : "No agents match this filter."}
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </Reveal>
    </div>
  );
}
