"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import AgentCard from "@/components/shared/AgentCard";
import { getPublicTags, listPublicAgents, listTrendingAgents } from "@/lib/api/discovery";
import { mapPublicAgentSummaryToAgent } from "@/lib/agent-mapper";
import type { Agent } from "@/lib/mock-data";
import { useChain } from "@/lib/chain-context";

export default function TrendingAgents() {
  const { chain } = useChain();
  const trackRef = useRef<HTMLDivElement>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [tagRes, res] = await Promise.all([getPublicTags(), listTrendingAgents(6, chain)]);
        if (cancelled) return;
        let rows = res.agents || [];
        if (!rows.length) {
          const fallback = await listPublicAgents({
            chain,
            sort: "most_orders",
            page: 1,
            page_size: 6,
          });
          if (cancelled) return;
          rows = fallback.agents || [];
        }
        const m = new Map<string, string>();
        for (const t of tagRes.tags || []) {
          if (t.parentId === 0) m.set(t.slug, t.name);
        }
        setAgents(rows.map((r) => mapPublicAgentSummaryToAgent(r, m)));
      } catch {
        if (!cancelled) setAgents([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [chain]);

  const scroll = (dir: number) => {
    trackRef.current?.scrollBy({ left: dir * 352, behavior: "smooth" });
  };

  return (
    <section className="py-12">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-center gap-2 mb-2">
          <span className="w-4 h-0.5 bg-[#6EE646] rounded-full" />
          <span className="text-[10px] font-mono text-[#9A9A9A] uppercase tracking-widest">
            Trending
          </span>
        </div>

        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-[#0F0F0F] tracking-tight">
            Trending Agents
          </h2>
          <Link href="/agents" className="text-sm text-[#6EE646] hover:underline">
            View All &rarr;
          </Link>
        </div>

        <div className="relative">
          {loading ? (
            <p className="text-sm text-[#9A9A9A]">Loading…</p>
          ) : agents.length === 0 ? (
            <p className="text-sm text-[#9A9A9A]">No trending agents yet.</p>
          ) : (
            <div
              ref={trackRef}
              className="flex gap-4 overflow-x-auto snap-x snap-mandatory pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {agents.map((agent) => (
                <div key={agent.id} className="snap-start w-[19rem] shrink-0">
                  <AgentCard agent={agent} />
                </div>
              ))}
            </div>
          )}

          {agents.length > 0 && (
            <>
              <button
                onClick={() => scroll(-1)}
                aria-label="Scroll left"
                className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 w-9 h-9 rounded-full border border-[#E2E2E0] bg-white shadow-sm flex items-center justify-center hover:border-[#6EE646]/50 hover:text-[#6EE646] text-[#9A9A9A] transition-colors duration-150 z-10 hidden md:flex"
              >
                <svg width="14" height="14" viewBox="0 0 13 13" fill="none">
                  <path d="M8 3L5 6.5l3 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <button
                onClick={() => scroll(1)}
                aria-label="Scroll right"
                className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-9 h-9 rounded-full border border-[#E2E2E0] bg-white shadow-sm flex items-center justify-center hover:border-[#6EE646]/50 hover:text-[#6EE646] text-[#9A9A9A] transition-colors duration-150 z-10 hidden md:flex"
              >
                <svg width="14" height="14" viewBox="0 0 13 13" fill="none">
                  <path d="M5 3l3 3.5-3 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
