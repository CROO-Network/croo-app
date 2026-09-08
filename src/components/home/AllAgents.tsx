"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Search } from "lucide-react";
import AgentListItem from "@/components/shared/AgentListItem";
import FilterPills from "@/components/shared/FilterPills";
import { useInfiniteScroll } from "@/lib/useInfiniteScroll";
import { sortOptions, priceRangeOptions, type Agent } from "@/lib/mock-data";
import { getPublicTags, listPublicAgents } from "@/lib/api/discovery";
import { mapPublicAgentSummaryToAgent, uiSortToApiSort } from "@/lib/agent-mapper";
import { getAgentListPriceMicroBounds } from "@/lib/price-range";
import { useChain } from "@/lib/chain-context";

const PAGE_SIZE = 10;
const priceRangeFilterItems = priceRangeOptions.map((option) => ({
  key: option.label,
  label: option.label,
}));
export default function AllAgents() {
  const { chain, meta } = useChain();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [priceRange, setPriceRange] = useState("All");
  const [sortBy, setSortBy] = useState("popular");
  const [categoryItems, setCategoryItems] = useState<{ key: string; label: string }[]>([
    { key: "All", label: "All" },
  ]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [queryVersion, setQueryVersion] = useState(0);
  const filtersHydratedRef = useRef(false);
  const slugToName = useMemo(() => {
    const m = new Map<string, string>();
    for (const it of categoryItems) {
      if (it.key !== "All") m.set(it.key, it.label);
    }
    return m;
  }, [categoryItems]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
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
      setListError(null);
      setLoading(true);
      const { minMicro, maxMicro } = getAgentListPriceMicroBounds(
        showServicePriceChrome ? priceRange : "All",
      );
      const min_price = minMicro > 0 ? minMicro : undefined;
      const max_price = maxMicro > 0 ? maxMicro : undefined;
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
          setListError("Could not load agents.");
          if (page === 1) setAgents([]);
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

  const agentsForList = useMemo(
    () =>
      agents.map((a) => ({
        ...a,
        tags: a.tags.map((t) => slugToName.get(t) ?? t),
      })),
    [agents, slugToName]
  );

  const hasMore = agents.length < total;

  const loadMore = useCallback(() => {
    setPage((p) => p + 1);
  }, []);

  const sentinelRef = useInfiniteScroll(hasMore, loadMore);

  return (
    <section>
      {/* Search Bar */}
      <div className="relative mb-4">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9A9A9A]" />
        <input
          type="text"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
          }}
          placeholder="Search agents by name, skill, or description..."
          className="w-full bg-white border border-[#E2E2E0] rounded-xl pl-11 pr-4 py-2.5 text-sm text-[#0F0F0F] placeholder:text-[#9A9A9A] focus:outline-none focus:ring-2 focus:ring-[#6EE646]/40 focus:border-[#6EE646] transition-all"
        />
      </div>

      {listError && (
        <p className="text-xs text-amber-700 font-mono mb-2">{listError}</p>
      )}

      {/* Filter Bar */}
      <div className="mb-5 space-y-3">
        {showCategoryChrome ? (
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
          <span className="shrink-0 text-[10px] font-mono uppercase tracking-[0.24em] text-[#9A9A9A] lg:w-24">
            Category
          </span>
          <div className="max-w-full overflow-x-auto pb-1">
            <FilterPills
              items={categoryItems}
              activeKey={category}
              onSelect={(key) => {
                setCategory(key);
              }}
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
              items={sortFilterItems}
              activeKey={activeSort}
              onSelect={(key) => {
                setSortBy(key);
              }}
            />
          </div>
        </div>
      </div>

      {/* List */}
      {loading && page === 1 ? (
        <div className="text-center py-16 text-sm text-[#9A9A9A]">Loading agents…</div>
      ) : agents.length > 0 ? (
        <>
          <div className="flex flex-col gap-2">
            {agentsForList.map((agent) => (
              <AgentListItem key={agent.id} agent={agent} />
            ))}
          </div>

          <div ref={sentinelRef} className="h-1" />
        </>
      ) : (
        <div className="text-center py-20 text-[#6B6B6B]">
          <p className="text-lg mb-2">No agents match your filters.</p>
          <p className="text-sm">Try adjusting your search or filters.</p>
        </div>
      )}
    </section>
  );
}
