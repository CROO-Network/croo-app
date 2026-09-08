import { useEffect, useRef } from "react";

/**
 * Attaches an IntersectionObserver to a sentinel element.
 * Calls onLoadMore whenever the sentinel scrolls into view (with 300px
 * bottom margin so loading feels instant).
 */
export function useInfiniteScroll(hasMore: boolean, onLoadMore: () => void) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  // Keep a stable ref so the effect doesn't need onLoadMore as a dep
  const onLoadMoreRef = useRef(onLoadMore);

  useEffect(() => {
    onLoadMoreRef.current = onLoadMore;
  }, [onLoadMore]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore) {
          onLoadMoreRef.current();
        }
      },
      { rootMargin: "300px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore]);

  return sentinelRef;
}
