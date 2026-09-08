"use client";

import { useState, useEffect, Suspense, useCallback, useRef, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { sortOptions, priceRangeOptions, type Agent } from "@/lib/mock-data";
import { getPublicTags, listPublicAgents } from "@/lib/api/discovery";
import { mapPublicAgentSummaryToAgent, uiSortToApiSort } from "@/lib/agent-mapper";
import { getAgentListPriceMicroBounds, usdPriceMatchesRangeLabel } from "@/lib/price-range";
import { useChain } from "@/lib/chain-context";
import AgentListItem from "@/components/shared/AgentListItem";
import FilterPills from "@/components/shared/FilterPills";
import BackButton from "@/components/shared/BackButton";
import { useInfiniteScroll } from "@/lib/useInfiniteScroll";

const PAGE_SIZE = 20;
const priceRangeFilterItems = priceRangeOptions.map((option) => ({
  key: option.label,
  label: option.label,
}));


function sortParamToValue(param: string | null): string {
  if (param === "volume") return "volume";
  if (param === "orders") return "popular";
  if (param === "newest") return "newest";
  return "popular";
}

function AgentsPageInner() {
  const { chain, meta } = useChain();
  const searchParams = useSearchParams();
  const initialSort = sortParamToValue(searchParams.get("sort"));

  const [search, setSearch] = useState(searchParams.get("q") ?? "");
  const [category, setCategory] = useState("All");
  const [priceRange, setPriceRange] = useState("All");
  const [sortBy, setSortBy] = useState(initialSort);
  const [categoryItems, setCategoryItems] = useState<{ key: string; label: string }[]>([
    { key: "All", label: "All" },
  ]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [listLoading, setListLoading] = useState(true);
  const [queryVersion, setQueryVersion] = useState(0);
  const filtersHydratedRef = useRef(false);
  const showServicePriceChrome = meta.interactive;
  const showCategoryChrome = meta.interactive;
  const sortFilterItems = useMemo(
    () =>
      sortOptions
        .filter((option) => meta.hasCompletionRate || option.value !== "completion")
        .filter((option) => showServicePriceChrome || option.value !== "price_asc")
        .map((option) => ({ key: option.value, label: option.label })),
    [meta.hasCompletionRate, showServicePriceChrome],
  );
  const activeSort =
    (!meta.hasCompletionRate && sortBy === "completion") ||
    (!showServicePriceChrome && sortBy === "price_asc")
      ? "popular"
      : sortBy;

  const slugToName = useMemo(() => {
    const m = new Map<string, string>();
    for (const it of categoryItems) {
      if (it.key !== "All") m.set(it.key, it.label);
    }
    return m;
  }, [categoryItems]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await getPublicTags();
        if (cancelled) return;
        const tags = (res.tags || [])
          .filter((t) => t.parentId === 0)
          .sort((a, b) =>
            a.sortOrder !== b.sortOrder ? a.sortOrder - b.sortOrder : a.name.localeCompare(b.name)
          );
        setCategoryItems([{ key: "All", label: "All" }, ...tags.map((t) => ({ key: t.slug, label: t.name }))]);
      } catch {
        if (!cancelled) setCategoryItems([{ key: "All", label: "All" }]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!filtersHydratedRef.current) {
      filtersHydratedRef.current = true;
      return;
    }
    setPage(1);
    setQueryVersion((v) => v + 1);
  }, [search, category, priceRange, activeSort, chain]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { minMicro, maxMicro } = getAgentListPriceMicroBounds(
        showServicePriceChrome ? priceRange : "All",
      );
      const min_price = minMicro > 0 ? minMicro : undefined;
      const max_price = maxMicro > 0 ? maxMicro : undefined;
      if (page === 1) setListLoading(true);
      try {
        const res = await listPublicAgents({
          chain,
          tags: showCategoryChrome && category !== "All" ? category : undefined,
          min_price,
          max_price,
          search: search.trim() || undefined,
          sort: uiSortToApiSort(activeSort),
          page,
          page_size: PAGE_SIZE,
        });
        if (cancelled) return;
        setTotal(Number(res.total) || 0);
        const mapped = (res.agents || []).map((r) => mapPublicAgentSummaryToAgent(r, slugToName));
        if (page === 1) setAgents(mapped);
        else setAgents((prev) => [...prev, ...mapped]);
      } catch {
        if (!cancelled) {
          setTotal(0);
          if (page === 1) setAgents([]);
        }
      } finally {
        if (!cancelled) setListLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // Filters are applied via queryVersion bump; listing search/category/sort here would run the
    // effect twice per filter change (sortBy + queryVersion both change).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, queryVersion]);

  const agentsForList = useMemo(() => {
    const mapped = agents.map((a) => ({
      ...a,
      tags: a.tags.map((t) => slugToName.get(t) ?? t),
    }));
    if (!showServicePriceChrome || priceRange === "All") return mapped;
    return mapped.filter((a) => usdPriceMatchesRangeLabel(a.lowestPrice, priceRange));
  }, [agents, slugToName, priceRange, showServicePriceChrome]);

  const hasMore = agents.length < total && (priceRange === "All" || agentsForList.length > 0);

  const loadMore = useCallback(() => {
    setPage((p) => p + 1);
  }, []);

  const sentinelRef = useInfiniteScroll(hasMore, loadMore);

  return (
    <div className="bg-[#F5F5F3] min-h-screen pt-24 pb-12">
      <div className="max-w-7xl mx-auto px-6">
        {/* Dynamic back button */}
        <div className="mb-4">
          <BackButton />
        </div>

        {/* Header */}
        <div className="mb-6">
          <div className="inline-flex items-center gap-2 mb-2">
            <span className="w-4 h-[2px] bg-[#6EE646] rounded-full" />
            <span className="text-[10px] font-mono text-[#9A9A9A] uppercase tracking-widest">
              All Agents
            </span>
          </div>
          <h1 className="text-2xl font-bold text-[#0F0F0F] tracking-tight">All Agents</h1>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9A9A9A]" />
          <input
            type="text"
            placeholder="Search agents by name or description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-11 pl-10 pr-4 bg-white border border-[#E2E2E0] rounded-xl text-sm text-[#0F0F0F] placeholder:text-[#9A9A9A] focus:outline-none focus:ring-2 focus:ring-[#6EE646]/40 transition"
          />
        </div>

        {/* Filter Row */}
        <div className="mb-6 space-y-3">
          {showCategoryChrome ? (
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
            <span className="shrink-0 text-[10px] font-mono uppercase tracking-[0.24em] text-[#9A9A9A] lg:w-24">
              Category
            </span>
            <div className="max-w-full overflow-x-auto pb-1">
              <FilterPills
                items={categoryItems}
                activeKey={category}
                onSelect={(key) => setCategory(key)}
              />
            </div>
          </div>
          ) : null}

          {showServicePriceChrome ? (
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
            <span className="shrink-0 text-[10px] font-mono uppercase tracking-[0.24em] text-[#9A9A9A] lg:w-24">
              Price
            </span>
            <div className="max-w-full overflow-x-auto pb-1">
              <FilterPills
                items={priceRangeFilterItems}
                activeKey={priceRange}
                onSelect={(key) => setPriceRange(key)}
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
                items={sortFilterItems}
                activeKey={activeSort}
                onSelect={(key) => setSortBy(key)}
              />
            </div>
          </div>
        </div>

        {/* Agent List */}
        <div className="flex flex-col gap-3">
          {agentsForList.map((agent) => (
            <AgentListItem key={agent.id} agent={agent} />
          ))}
        </div>

        {listLoading && agentsForList.length === 0 && (
          <div className="text-center py-16">
            <p className="text-sm text-[#9A9A9A]">Loading…</p>
          </div>
        )}

        {!listLoading && agentsForList.length === 0 && (
          <div className="text-center py-16">
            <p className="text-sm text-[#9A9A9A]">
              No agents found matching your filters.
            </p>
          </div>
        )}

        {/* Infinite scroll sentinel */}
        <div ref={sentinelRef} className="h-1" />
      </div>
    </div>
  );
}

export default function AgentsPage() {
  return (
    <Suspense>
      <AgentsPageInner />
    </Suspense>
  );
}
