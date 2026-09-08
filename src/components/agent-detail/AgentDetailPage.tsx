"use client";

import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import AgentHeader from "@/components/agent-detail/AgentHeader";
import AgentStats from "@/components/agent-detail/AgentStats";
import ServicesTab from "@/components/agent-detail/ServicesTab";
import ActivityTab from "@/components/agent-detail/ActivityTab";
import BackButton from "@/components/shared/BackButton";
import type { Agent } from "@/lib/mock-data";
import { agentDetailHref, agentIdFromRouteParams, getPublicAgent, getPublicTags } from "@/lib/api/discovery";
import { mapPublicAgentDetailToAgent } from "@/lib/agent-mapper";
import { ApiError } from "@/lib/http/errors";
import { useChain } from "@/lib/chain-context";
import { CHAINS, isChainId, type ChainId } from "@/lib/chains";

export default function AgentDetailPage({
  params,
}: {
  params: Promise<{ id: string | string[] }>;
}) {
  const fromProps = agentIdFromRouteParams(use(params).id);
  const fromRoute = agentIdFromRouteParams(useParams<{ id: string | string[] }>().id);
  // Client navigations update useParams first; prefer it so counterpart
  // jumps don't keep rendering the previous agent id.
  const id = fromRoute || fromProps;
  const pathname = usePathname();
  const router = useRouter();
  const { chain, meta, setChain, commitChain, registerSwitchHandler } = useChain();
  const chainRef = useRef(chain);
  chainRef.current = chain;
  const [agent, setAgent] = useState<Agent | null>(null);
  const [loadError, setLoadError] = useState<"notfound" | "other" | null>(null);

  useEffect(() => {
    if (!id || !pathname) return;
    const canonical = agentDetailHref(id);
    if (pathname.includes(":") && pathname !== canonical) {
      router.replace(canonical);
    }
  }, [id, pathname, router]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      setLoadError(null);
      setAgent(null);
      try {
        // Opaque id encodes the pool (`bsc:{token_id}` vs Base UUID). Do not
        // send the UI chain — a mismatch 404s a valid deep link.
        const [tagRes, agentRes] = await Promise.all([getPublicTags(), getPublicAgent(id)]);
        if (cancelled) return;
        const slugToName = new Map((tagRes.tags || []).map((t) => [t.slug, t.name]));
        const mapped = mapPublicAgentDetailToAgent(agentRes.agent, slugToName);
        setAgent(mapped);
        const loadedChain = mapped.chain && isChainId(mapped.chain) ? mapped.chain : undefined;
        if (loadedChain && loadedChain !== chainRef.current) {
          commitChain(loadedChain);
        }
      } catch (e) {
        if (cancelled) return;
        if (e instanceof ApiError && e.status === 404) setLoadError("notfound");
        else setLoadError("other");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, commitChain]);

  const displayAgent = agent && agent.id === id ? agent : null;
  const agentChain: ChainId | undefined =
    displayAgent?.chain && isChainId(displayAgent.chain) ? displayAgent.chain : undefined;
  const linkedId = displayAgent?.linkedAgentId?.trim() || "";
  const linkedChain = (displayAgent?.chains || []).find(
    (c): c is ChainId => isChainId(c) && c !== (agentChain ?? chain),
  );
  const followHref = linkedId && linkedChain ? agentDetailHref(linkedId) : "";
  // UI chain already matches the counterpart while this record is still the
  // old agent — the flash in "isn't deployed on {chain}". Follow instead.
  const shouldFollow = Boolean(followHref && linkedChain === chain && agentChain && agentChain !== chain);

  useEffect(() => {
    if (!followHref || !linkedChain) {
      registerSwitchHandler(null);
      return;
    }
    registerSwitchHandler((next) => {
      if (next !== linkedChain) return false;
      router.push(followHref);
      return true;
    });
    return () => registerSwitchHandler(null);
  }, [followHref, linkedChain, registerSwitchHandler, router]);

  useEffect(() => {
    if (!shouldFollow || !followHref) return;
    router.replace(followHref);
  }, [shouldFollow, followHref, router]);

  if (loadError === "notfound" && (!agent || agent.id === id)) {
    return (
      <main className="min-h-screen bg-[#F5F5F3]">
        <div className="mx-auto max-w-4xl px-6 pt-24">
          <div className="mb-6">
            <BackButton />
          </div>
          <p className="text-sm text-[#0F0F0F]">This agent could not be found.</p>
          <Link href="/agents" className="mt-3 inline-block text-sm text-[#3D8C1F] hover:underline">
            Browse agents
          </Link>
        </div>
      </main>
    );
  }

  if (!displayAgent || shouldFollow) {
    return (
      <main className="min-h-screen bg-[#F5F5F3]">
        <div className="mx-auto max-w-4xl px-6 pt-24">
          <p className="text-sm text-[#9A9A9A]">{loadError === "other" ? "Could not load agent." : "Loading…"}</p>
        </div>
      </main>
    );
  }

  const activeServicesCount = displayAgent.services.length;
  const onCurrentChain = !agentChain || agentChain === chain;

  return (
    <main className="min-h-screen bg-[#F5F5F3]">
      <div className="mx-auto max-w-4xl px-6 pb-16 pt-24">
        {/* Dynamic back button */}
        <div className="mb-6">
          <BackButton />
        </div>

        {!onCurrentChain && agentChain && (
          <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border border-[#E2E2E0] bg-white px-5 py-3">
            <p className="text-sm text-[#6B6B6B]">
              <span className="font-medium text-[#0F0F0F]">{displayAgent.name}</span> isn&apos;t
              deployed on {meta.label}.
            </p>
            <button
              type="button"
              onClick={() => setChain(agentChain)}
              className="text-sm font-medium text-[#3D8C1F] hover:underline"
            >
              Switch to {CHAINS[agentChain].label} →
            </button>
          </div>
        )}
        {onCurrentChain && linkedId && linkedChain && (
          <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border border-[#E2E2E0] bg-white px-5 py-3">
            <p className="text-sm text-[#6B6B6B]">Also on {CHAINS[linkedChain].label}.</p>
            <button
              type="button"
              onClick={() => router.push(followHref)}
              className="text-sm font-medium text-[#3D8C1F] hover:underline"
            >
              View on {CHAINS[linkedChain].label} →
            </button>
          </div>
        )}

        <AgentHeader agent={displayAgent} />
        <AgentStats agent={displayAgent} />

        {/* ── Services (flat, no tab) ───────────────────────────────── */}
        <div className="mt-8">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-4 h-px bg-[#6EE646]" />
            <span className="text-xs font-mono text-[#6EE646] uppercase tracking-widest">
              Services
            </span>
            <span className="text-xs text-[#9A9A9A] font-mono">
              ({activeServicesCount})
            </span>
          </div>
          <ServicesTab agent={displayAgent} />
        </div>

        {/* ── Activity (flat, paginated) ─────────────────────────────── */}
        <div id="activity-section" className="mt-10 scroll-mt-24">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-4 h-px bg-[#6EE646]" />
            <span className="text-xs font-mono text-[#6EE646] uppercase tracking-widest">
              Activity
            </span>
          </div>
          <ActivityTab
            key={`${displayAgent.id}:${agentChain ?? ""}`}
            agentId={displayAgent.id}
            agentName={displayAgent.name}
            chain={agentChain}
          />
        </div>
      </div>
    </main>
  );
}
