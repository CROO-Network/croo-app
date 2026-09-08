"use client";

import { useState, useMemo, Suspense, useCallback, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { priceRangeOptions } from "@/lib/mock-data";
import { getAgentListPriceMicroBounds, usdPriceMatchesRangeLabel } from "@/lib/price-range";
import ServiceCard from "@/components/shared/ServiceCard";
import FilterPills from "@/components/shared/FilterPills";
import BackButton from "@/components/shared/BackButton";
import { useInfiniteScroll } from "@/lib/useInfiniteScroll";
import { listPublicServices, getPublicAgent, type PublicServiceListItemJson } from "@/lib/api/discovery";
import type { ChainId } from "@/lib/chains";
import { usdcMicroToUsd, formatSlaMinutes } from "@/lib/currency";
import { useChain } from "@/lib/chain-context";

const PAGE_SIZE = 12;

const serviceSortOptions = [
  { label: "Most Orders", value: "popular" },
  { label: "Lowest Price", value: "price_asc" },
  { label: "Highest Price", value: "price_desc" },
  { label: "Newest", value: "newest" },
];
const serviceSortItems = serviceSortOptions.map((o) => ({ key: o.value, label: o.label }));
const priceRangeFilterItems = priceRangeOptions.map((o) => ({ key: o.label, label: o.label }));

type CardService = {
  id: string;
  name: string;
  description: string;
  price: number;
  sla: string;
  agentName: string;
  agentId: string;
  agentAvatar: string;
  orders7d: number;
  externalUrl?: string;
  chain?: string;
};

async function enrichServiceRows(
  items: PublicServiceListItemJson[],
  chain?: ChainId,
): Promise<CardService[]> {
  const ids = [...new Set(items.map((i) => i.agentId).filter(Boolean))];
  const loaded = await Promise.all(
    ids.map(async (id) => {
      try {
        const r = await getPublicAgent(id, chain);
        return [
          id,
          {
            name: r.agent?.name || id,
            avatar: r.agent?.avatar || "",
            externalUrl: r.agent?.externalUrl?.trim() || undefined,
          },
        ] as const;
      } catch {
        return [id, { name: id, avatar: "", externalUrl: undefined }] as const;
      }
    }),
  );
  const byAgent = new Map(loaded);
  return (items || []).map((i) => {
    const ag = byAgent.get(i.agentId) ?? { name: i.agentId, avatar: "", externalUrl: undefined };
    return {
      id: i.serviceId,
      name: i.name,
      description: i.description || "",
      price: usdcMicroToUsd(Number(i.price) || 0),
      sla: formatSlaMinutes(Number(i.slaMinutes) || 0),
      agentName: (i as { agentName?: string }).agentName || ag.name,
      agentId: i.agentId,
      agentAvatar: (i as { agentAvatar?: string }).agentAvatar || ag.avatar,
      orders7d: Number(i.orders7d) || 0,
      externalUrl: ag.externalUrl,
      chain: i.chain,
    };
  });
}

function ServicesPageInner() {
  const { chain, meta } = useChain();
  const showServicePriceChrome = meta.interactive;
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(searchParams.get("q") ?? "");
  const [priceRange, setPriceRange] = useState("All");
  const [sortBy, setSortBy] = useState("popular");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<CardService[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [queryVersion, setQueryVersion] = useState(0);
  const filtersHydratedRef = useRef(false);

  useEffect(() => {
    if (!filtersHydratedRef.current) {
      filtersHydratedRef.current = true;
      return;
    }
    setPage(1);
    setQueryVersion((v) => v + 1);
  }, [search, priceRange, chain]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setListError(null);
      const { minMicro, maxMicro } = getAgentListPriceMicroBounds(
        showServicePriceChrome ? priceRange : "All",
      );
      const min_price = minMicro > 0 ? minMicro : undefined;
      const max_price = maxMicro > 0 ? maxMicro : undefined;
      try {
        const res = await listPublicServices({
          chain,
          search: search.trim() || undefined,
          min_price,
          max_price,
          page,
          page_size: PAGE_SIZE,
        });
        if (cancelled) return;
        setTotal(Number(res.total) || 0);
        const enriched = await enrichServiceRows(res.items || [], chain);
        if (cancelled) return;
        setRows((prev) => (page === 1 ? enriched : [...prev, ...enriched]));
      } catch {
        if (!cancelled) {
          setListError("Could not load services.");
          if (page === 1) setRows([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, queryVersion]);

  const filteredServices = useMemo(() => {
    const services = rows.filter((s) =>
      !showServicePriceChrome || usdPriceMatchesRangeLabel(s.price, priceRange),
    );
    const sortKey =
      !showServicePriceChrome &&
      (sortBy === "popular" || sortBy === "price_asc" || sortBy === "price_desc")
        ? "newest"
        : sortBy;
    switch (sortKey) {
      case "popular":
        services.sort((a, b) => b.orders7d - a.orders7d);
        break;
      case "price_asc":
        services.sort((a, b) => a.price - b.price);
        break;
      case "price_desc":
        services.sort((a, b) => b.price - a.price);
        break;
      case "newest":
        break;
      default:
        break;
    }
    return services;
  }, [rows, sortBy, priceRange, showServicePriceChrome]);

  const hasMore = rows.length < total && (priceRange === "All" || filteredServices.length > 0);
  const loadMore = useCallback(() => {
    setPage((p) => p + 1);
  }, []);
  const sentinelRef = useInfiniteScroll(hasMore && !loading, loadMore);

  return (
    <div className="bg-[#F5F5F3] min-h-screen pt-24 pb-12">
      <div className="max-w-7xl mx-auto px-6">
        <div className="mb-4">
          <BackButton />
        </div>

        <div className="mb-6">
          <div className="inline-flex items-center gap-2 mb-2">
            <span className="w-4 h-[2px] bg-[#6EE646] rounded-full" />
            <span className="text-[10px] font-mono text-[#9A9A9A] uppercase tracking-widest">
              All Services
            </span>
          </div>
          <h1 className="text-2xl font-bold text-[#0F0F0F] tracking-tight">All Services</h1>
        </div>

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9A9A9A]" />
          <input
            type="text"
            placeholder="Search services by name, description, or agent..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
            }}
            className="w-full h-11 pl-10 pr-4 bg-white border border-[#E2E2E0] rounded-xl text-sm text-[#0F0F0F] placeholder:text-[#9A9A9A] focus:outline-none focus:ring-2 focus:ring-[#6EE646]/40 transition"
          />
        </div>

        <div className="mb-6 space-y-3">
          {showServicePriceChrome ? (
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
            <span className="shrink-0 text-[10px] font-mono uppercase tracking-[0.24em] text-[#9A9A9A] lg:w-24">
              Price
            </span>
            <div className="max-w-full overflow-x-auto pb-1">
              <FilterPills
                items={priceRangeFilterItems}
                activeKey={priceRange}
                onSelect={(key) => {
                  setPriceRange(key);
                }}
              />
            </div>
          </div>
          ) : null}

          <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
            <span className="shrink-0 text-[10px] font-mono uppercase tracking-[0.24em] text-[#9A9A9A] lg:w-24">
              Sort
            </span>
            <div className="max-w-full overflow-x-auto pb-1">
              <FilterPills
                items={
                  showServicePriceChrome
                    ? serviceSortItems
                    : serviceSortItems.filter((item) => item.key === "newest")
                }
                activeKey={
                  !showServicePriceChrome &&
                  (sortBy === "popular" || sortBy === "price_asc" || sortBy === "price_desc")
                    ? "newest"
                    : sortBy
                }
                onSelect={(key) => {
                  setSortBy(key);
                }}
              />
            </div>
          </div>

          <p className="w-full text-left text-xs text-[#9A9A9A] tabular-nums">
            Showing {filteredServices.length} of {total} services
          </p>
        </div>

        {listError && <p className="text-xs text-amber-700 font-mono mb-2">{listError}</p>}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {filteredServices.map((service) => (
            <ServiceCard
              key={service.id}
              service={{
                id: service.id,
                name: service.name,
                description: service.description,
                price: service.price,
                sla: service.sla,
                agentName: service.agentName,
                agentId: service.agentId,
                agentAvatar:
                  service.agentAvatar ||
                  `https://api.dicebear.com/9.x/identicon/svg?seed=${encodeURIComponent(service.agentId)}`,
                orders7d: service.orders7d,
                externalUrl: service.externalUrl,
                chain: service.chain,
              }}
            />
          ))}
        </div>

        {!loading && filteredServices.length === 0 && (
          <div className="text-center py-16">
            <p className="text-sm text-[#9A9A9A]">No services found matching your filters.</p>
          </div>
        )}

        {loading && page === 1 && (
          <p className="text-center py-8 text-sm text-[#9A9A9A]">Loading…</p>
        )}

        <div ref={sentinelRef} className="h-1" />
      </div>
    </div>
  );
}

export default function ServicesPage() {
  return (
    <Suspense>
      <ServicesPageInner />
    </Suspense>
  );
}
