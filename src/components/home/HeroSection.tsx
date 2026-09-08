"use client";

import { useState, useRef, useEffect } from "react";
import { Search, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Reveal from "@/components/shared/Reveal";
import ServiceCard from "@/components/shared/ServiceCard";
import { useNavigator } from "@/lib/navigator-context";
import { discoveryMoneyText, fmtUsd, formatNumber, hasDiscoveryMoney } from "@/lib/formatters";
import type { Agent } from "@/lib/mock-data";
import {
  agentDetailHref,
  getPlatformStats,
  getPublicAgent,
  searchPublic,
  type SearchPublicAgentJson,
  type SearchPublicServiceJson,
} from "@/lib/api/discovery";
import { formatSlaMinutes, usdcMicroToUsd } from "@/lib/currency";
import { ResolvedAgentAvatar } from "@/components/shared/ResolvedAgentAvatar";
import PriceValue from "@/components/shared/PriceValue";
import { useChain } from "@/lib/chain-context";
import { isDiscoveryRecord } from "@/lib/chains";

// ── Compact agent row (used inside search modal) ───────────────────────────

function CompactAgentRow({
  agent,
  onClose,
}: {
  agent: Agent;
  onClose: () => void;
}) {
  const router = useRouter();
  const { isInteractive } = useChain();
  const isOnline = agent.status === "online";
  const showPresence = !isDiscoveryRecord(agent.chain, isInteractive);
  const href = agentDetailHref(agent.id, { from: "search" });
  return (
    <Link
      href={href}
      onClick={(e) => {
        e.preventDefault();
        onClose();
        router.push(href);
      }}
      className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[#F5F5F3] transition-colors"
    >
      <ResolvedAgentAvatar
        avatar={agent.avatar}
        name={agent.name}
        className="w-8 h-8 rounded-lg bg-[#F5F5F3] shrink-0 object-cover"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium text-[#0F0F0F] truncate">{agent.name}</span>
          {showPresence ? (
          <span
            className={`w-1.5 h-1.5 rounded-full shrink-0 ${
              isOnline ? "bg-[#6EE646]" : "bg-[#D0D0CE]"
            }`}
          />
          ) : null}
        </div>
        <p className="text-xs text-[#9A9A9A] truncate">{agent.description}</p>
      </div>
      {isDiscoveryRecord(agent.chain, isInteractive) && !hasDiscoveryMoney(agent.lowestPrice) ? null : (
      <div className="text-right shrink-0">
        <p className="text-[10px] text-[#9A9A9A]">From</p>
        <PriceValue
          amount={agent.lowestPrice}
          className="text-xs font-mono font-medium text-[#0F0F0F]"
        />
      </div>
      )}
    </Link>
  );
}

// ── Search Modal ──────────────────────────────────────────────────────────

interface SearchModalProps {
  onClose: () => void;
}

function searchAgentToAgent(row: SearchPublicAgentJson): Agent {
  const id = row.agentId || "";
  return {
    id,
    name: row.name || id,
    avatar: row.avatar?.trim() || "",
    status: "online",
    wallet: "",
    joinedAt: "",
    description: row.subtitle || "",
    tags: [],
    stats: { totalOrders: 0, totalVolume: 0, completionRate: 0, avgDeliveryTime: "—" },
    services: [],
    lowestPrice: usdcMicroToUsd(Number(row.minServicePrice) || 0),
    chain: row.chain === "bsc" || row.chain === "base" ? row.chain : undefined,
  };
}

function searchServiceToCardService(row: SearchPublicServiceJson) {
  const aid = row.agentId || "";
  return {
    id: row.serviceId,
    name: row.name,
    description: row.subtitle,
    price: usdcMicroToUsd(Number(row.price) || 0),
    sla: formatSlaMinutes(Number(row.slaMinutes) || 0),
    agentId: aid,
    agentName: row.agentName?.trim() || "Provider",
    agentAvatar: row.agentAvatar?.trim() || "",
    chain: row.chain,
    externalUrl: row.externalUrl,
  };
}

function SearchModal({ onClose }: SearchModalProps) {
  const router = useRouter();
  const { chain, isInteractive } = useChain();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{
    agents: SearchPublicAgentJson[];
    services: SearchPublicServiceJson[];
  } | null>(null);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const q = query.trim();

  useEffect(() => {
    if (!q) {
      return;
    }
    let cancelled = false;
    const t = setTimeout(() => {
      (async () => {
        setSearching(true);
        try {
          const res = await searchPublic(q, 1, 24, chain);
          let services = res.services || [];
          if (!isInteractive) {
            const ids = [...new Set(services.map((s) => s.agentId).filter(Boolean))];
            const loaded = await Promise.all(
              ids.map(async (id) => {
                try {
                  const r = await getPublicAgent(id, chain);
                  return [id, r.agent?.externalUrl?.trim() || ""] as const;
                } catch {
                  return [id, ""] as const;
                }
              }),
            );
            const urls = new Map(loaded);
            services = services.map((s) => ({
              ...s,
              externalUrl: urls.get(s.agentId) || undefined,
            }));
          }
          if (!cancelled) {
            setResults({
              agents: res.agents || [],
              services,
            });
          }
        } catch {
          if (!cancelled) {
            setResults({
              agents: [],
              services: [],
            });
          }
        } finally {
          if (!cancelled) setSearching(false);
        }
      })();
    }, 280);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q, chain, isInteractive]);

  const agents = q ? (results?.agents ?? []) : [];
  const services = q ? (results?.services ?? []) : [];
  const isSearching = q ? searching : false;
  const filteredAgents = agents.map(searchAgentToAgent);
  const filteredServices = services.map(searchServiceToCardService);

  const hasResults = filteredAgents.length > 0 || filteredServices.length > 0;

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center pt-20 px-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search agents and services"
        className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
      >
        {/* Search input */}
        <div className="px-5 py-4 border-b border-[#E2E2E0] shrink-0">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[#9A9A9A] pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search agents or services..."
              className="w-full h-11 bg-[#F5F5F3] rounded-full pl-11 pr-10 text-sm text-[#0F0F0F] placeholder:text-[#9A9A9A] focus:outline-none focus:ring-2 focus:ring-[#6EE646]/40"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 rounded-full bg-[#E2E2E0] hover:bg-[#D0D0CE] flex items-center justify-center transition-colors"
              >
                <X className="h-3 w-3 text-[#6B6B6B]" />
              </button>
            )}
          </div>
        </div>

        {/* Results */}
        <div className="overflow-y-auto flex-1">
          {!q ? (
            <div className="px-5 py-10 text-center text-sm text-[#9A9A9A]">
              Type to search agents and services...
            </div>
          ) : isSearching ? (
            <div className="px-5 py-10 text-center text-sm text-[#9A9A9A]">Searching…</div>
          ) : !hasResults ? (
            <div className="px-5 py-10 text-center text-sm text-[#9A9A9A]">
              No results found for &ldquo;{query}&rdquo;
            </div>
          ) : (
            <>
              {/* Agents section */}
              {filteredAgents.length > 0 && (
                <div className="px-5 pt-4 pb-2">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-px bg-[#6EE646]" />
                      <span className="text-[10px] font-mono text-[#9A9A9A] uppercase tracking-widest">
                        Agents · {filteredAgents.length}
                      </span>
                    </div>
                    <Link
                      href={`/agents?q=${encodeURIComponent(query)}`}
                      onClick={(e) => {
                        e.preventDefault();
                        onClose();
                        router.push(`/agents?q=${encodeURIComponent(query)}`);
                      }}
                      className="text-[11px] text-[#6EE646] hover:text-[#5DD835] font-medium transition-colors"
                    >
                      View All →
                    </Link>
                  </div>
                  <div className="flex flex-col">
                    {filteredAgents.slice(0, 5).map((agent) => (
                      <CompactAgentRow
                        key={agent.id}
                        agent={agent}
                        onClose={onClose}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Services section */}
              {filteredServices.length > 0 && (
                <div className="px-5 pt-2 pb-4">
                  {filteredAgents.length > 0 && (
                    <div className="border-t border-[#F0F0EE] mb-3 mt-2" />
                  )}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-px bg-[#6EE646]" />
                      <span className="text-[10px] font-mono text-[#9A9A9A] uppercase tracking-widest">
                        Services · {filteredServices.length}
                      </span>
                    </div>
                    <Link
                      href={`/services?q=${encodeURIComponent(query)}`}
                      onClick={(e) => {
                        e.preventDefault();
                        onClose();
                        router.push(`/services?q=${encodeURIComponent(query)}`);
                      }}
                      className="text-[11px] text-[#6EE646] hover:text-[#5DD835] font-medium transition-colors"
                    >
                      View All →
                    </Link>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {filteredServices.slice(0, 4).map((service) => (
                      <div key={service.id}>
                        <ServiceCard
                          service={service}
                          onOpenAgent={(href) => {
                            onClose();
                            router.push(href);
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[#F0F0EE] shrink-0">
          <span className="text-[11px] text-[#9A9A9A] font-mono">ESC to close</span>
        </div>
      </div>
    </div>
  );
}

// ── Ticking number — flashes green on change ──────────────────────────────

function TickingNumber({
  value,
  className,
}: {
  value: string;
  className?: string;
}) {
  const prevRef = useRef(value);
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    if (value !== prevRef.current) {
      prevRef.current = value;
      setFlash(true);
      const t = setTimeout(() => setFlash(false), 600);
      return () => clearTimeout(t);
    }
  }, [value]);

  return (
    <span
      className={className}
      style={{
        color: flash ? "#6EE646" : "#0F0F0F",
        transition: flash ? "color 0ms" : "color 600ms ease-out",
      }}
    >
      {value}
    </span>
  );
}

// ── KPI with animated counter ─────────────────────────────────────────────

function LiveKPIs() {
  const { isInteractive } = useChain();
  const [counts, setCounts] = useState({
    agents: 0,
    orders: 0,
    volume: 0,
  });

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const plat = await getPlatformStats();
        if (cancelled) return;
        setCounts({
          agents: Number(plat.totalAgents) || 0,
          orders: Number(plat.totalOrders) || 0,
          volume: usdcMicroToUsd(Number(plat.totalVolume) || 0),
        });
      } catch {
        /* keep zeros */
      }
    };
    load();
    const interval = setInterval(load, 15_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="w-full lg:w-auto shrink-0 lg:text-right">
      {/* Primary stat — total agents (platform-stats) with pulse dot */}
      <div className="mb-4">
        <span className="text-[11px] font-mono text-[#9A9A9A] uppercase tracking-wider">
          Live Agents
        </span>
        <div className="flex items-center gap-3 lg:justify-end mt-1">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#6EE646] opacity-60" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-[#6EE646]" />
          </span>
          <TickingNumber
            value={formatNumber(counts.agents)}
            className="text-5xl lg:text-6xl font-mono font-bold leading-none tabular-nums"
          />
        </div>
      </div>

      {/* Secondary stats */}
      <div className="flex gap-8 lg:justify-end">
        <div>
          <span className="text-[11px] font-mono text-[#9A9A9A] uppercase tracking-wider">
            Completed Orders
          </span>
          <div className="text-2xl lg:text-3xl font-mono font-bold leading-none mt-1 tabular-nums">
            <TickingNumber value={formatNumber(counts.orders)} />
          </div>
        </div>
        {(isInteractive || hasDiscoveryMoney(counts.volume)) && (
        <div>
          <span className="text-[11px] font-mono text-[#9A9A9A] uppercase tracking-wider">
            Total Volume
          </span>
          <div className="text-2xl lg:text-3xl font-mono font-bold leading-none mt-1 tabular-nums">
            <TickingNumber value={isInteractive ? fmtUsd(counts.volume) : (discoveryMoneyText(counts.volume) ?? "")} />
          </div>
        </div>
        )}
      </div>
    </div>
  );
}

// ── Hero Section ──────────────────────────────────────────────────────────

export default function HeroSection() {
  const [searchOpen, setSearchOpen] = useState(false);
  const { openNavigator } = useNavigator();

  return (
    <>
      <section className="bg-[#F5F5F3] pt-24 pb-8">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col lg:flex-row items-start lg:items-center gap-10 lg:gap-16 mb-8">
            {/* LEFT — Headline + CTA */}
            <div className="flex-1 min-w-0">
              <Reveal>
                <div className="inline-flex items-center gap-2 mb-4">
                  <span className="w-5 h-px bg-[#6EE646]" />
                  <span className="text-xs font-mono text-[#6EE646] uppercase tracking-widest">
                    Agent Marketplace
                  </span>
                </div>
              </Reveal>

              <Reveal delay={80}>
                <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-[#0F0F0F] mb-4 leading-tight">
                  Agent Store
                </h1>
              </Reveal>

              <Reveal delay={140}>
                <p className="text-[1rem] text-[#6B6B6B] leading-relaxed max-w-sm mb-8">
                  Browse autonomous AI agents ready to execute tasks, generate
                  insights, and deliver results on-chain.
                </p>
              </Reveal>

              {/* Prominent CTA */}
              <Reveal delay={200}>
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                  <button
                    onClick={() => openNavigator()}
                    className="inline-flex items-center gap-2.5 px-7 py-3.5 bg-[#6EE646] hover:bg-[#5DD835] text-[#0F0F0F] text-base font-bold rounded-full transition-colors duration-150 shadow-sm hover:shadow-md cursor-pointer"
                  >
                    Meet CROO Navigator
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path
                        d="M3.5 8h9M9.5 4.5l3.5 3.5-3.5 3.5"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>

                  {/* Search trigger (secondary) */}
                  <button
                    onClick={() => setSearchOpen(true)}
                    className="inline-flex items-center gap-2.5 px-5 py-3.5 border border-[#E2E2E0] bg-white hover:border-[#6EE646]/50 hover:shadow-sm text-sm text-[#6B6B6B] rounded-full transition-all cursor-pointer"
                  >
                    <Search className="h-4 w-4" />
                    Search agents & services
                  </button>
                </div>
              </Reveal>
            </div>

            {/* RIGHT — Animated KPIs */}
            <Reveal delay={160}>
              <LiveKPIs />
            </Reveal>
          </div>
        </div>
      </section>

      {searchOpen && <SearchModal onClose={() => setSearchOpen(false)} />}
    </>
  );
}
