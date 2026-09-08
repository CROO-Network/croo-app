"use client";

import { useCallback, useSyncExternalStore } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { getMyNavigatorInfo, type GetMyNavigatorInfoResponseJson } from "@/lib/api/agent";
import type { WalletBalanceResult } from "@/lib/navigator/api";

/* ───────────────────── dev-only balance override ─────────────────────
 * Lets you simulate "balance shortfall → Top Up" / "just topped up" flows
 * without touching the AI service or the chain. SchemaFormCard swaps its
 * primary CTA from "Confirm & Pay" to "Top Up" whenever balance < total
 * — toggling these helpers exercises that branch end-to-end.
 *
 * Usage in DevTools console:
 *   __setMockBalance("0")     // force balance = $0.00 (button → Top Up)
 *   __setMockBalance("0.50")  // force balance = $0.50
 *   __clearMockBalance()      // simulates a successful top-up — restores live balance
 *
 * The whole block is tree-shaken in production builds because
 * `process.env.NODE_ENV !== "production"` becomes a literal `false`. */

const MOCK_BALANCE_KEY = "__mock_navigator_balance";

function readMockBalance(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(MOCK_BALANCE_KEY);
}

function subscribeMockBalance(listener: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  // `storage` only fires across tabs — to react in the SAME tab we also
  // dispatch a custom event from the helper setters below.
  const onStorage = (e: StorageEvent) => {
    if (e.key === MOCK_BALANCE_KEY) listener();
  };
  const onCustom = () => listener();
  window.addEventListener("storage", onStorage);
  window.addEventListener("mock-balance-changed", onCustom);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener("mock-balance-changed", onCustom);
  };
}

if (process.env.NODE_ENV !== "production" && typeof window !== "undefined") {
  type DevWindow = Window & {
    __setMockBalance?: (value: string) => void;
    __clearMockBalance?: () => void;
  };
  const devWindow = window as DevWindow;
  devWindow.__setMockBalance = (value: string) => {
    window.localStorage.setItem(MOCK_BALANCE_KEY, value);
    window.dispatchEvent(new Event("mock-balance-changed"));
    console.info(`[dev] navigator balance mocked to "${value}"`);
  };
  devWindow.__clearMockBalance = () => {
    window.localStorage.removeItem(MOCK_BALANCE_KEY);
    window.dispatchEvent(new Event("mock-balance-changed"));
    console.info("[dev] navigator balance mock cleared — using live value");
  };
}

function useMockBalance(): string | null {
  return useSyncExternalStore(
    subscribeMockBalance,
    readMockBalance,
    () => null, // SSR: never use the mock during server render
  );
}

export interface UseBalanceResult {
  balanceUsdc: string | null;
  escrowUsdc: string | null;
  cached: boolean;
  updatedAt: string | null;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  refetch: () => Promise<string | null>;
}

/**
 * Fetch the Navigator wallet balance via `/backend/v1/me/navigator`.
 *
 * Event-driven (no automatic polling):
 * - Keyed by `session.userId` so balances stay scoped per account
 * - Shares the same BE source as Account Center, avoiding a second AI-side
 *   wallet-balance cache that can diverge from the global header
 * - `staleTime: 15_000` mirrors the BE balance cache TTL; explicit `refetch()` or
 *   `queryClient.invalidateQueries({ queryKey: ['navigator', 'balance'] })`
 *   always bypass it
 *
 * Triggers for `refetch()` / invalidate live at the call sites:
 *   - Header: refetch when the avatar dropdown opens
 *   - NavigatorFAB: refetch on each `isOpen === true` transition
 *   - TopUpModal: invalidate after the Confirm Transfer / modal close path
 *   - SchemaFormCard: explicit refetch inside `runOrderPipeline`'s balance
 *     pre-check + automatic reactivity via the TopUpModal invalidate above
 *     (drives the Top Up ↔ Confirm & Pay button switch)
 */
function mapNavigatorInfoToBalance(data: GetMyNavigatorInfoResponseJson): WalletBalanceResult {
  return {
    balanceUsdc: data.balance?.availableUsdc ?? "0",
    escrowUsdc: data.balance?.escrowUsdc ?? "0",
    cached: Boolean(data.balance?.cached),
    updatedAt: data.balance?.updatedAt,
  };
}

export function useBalance(): UseBalanceResult {
  const { session, status } = useAuth();
  const enabled = status === "authenticated" && Boolean(session?.userId);

  const query = useQuery<WalletBalanceResult>({
    queryKey: ["navigator", "balance", session?.userId ?? null],
    queryFn: async ({ signal }) => mapNavigatorInfoToBalance(await getMyNavigatorInfo({ signal })),
    enabled,
    staleTime: 15_000,
  });

  // Dev override: when set, masks the live query result so the rest of the
  // app sees the simulated balance. Toggle via console (see helpers above).
  const mock = useMockBalance();
  const balanceUsdc = mock ?? query.data?.balanceUsdc ?? null;
  const refetchQuery = query.refetch;
  const refetch = useCallback(async () => {
    const result = await refetchQuery();
    // Honor the mock here too so `refetchBalance()` callers see the same
    // value the UI sees.
    const live = result.data?.balanceUsdc ?? null;
    return readMockBalance() ?? live;
  }, [refetchQuery]);

  return {
    balanceUsdc,
    escrowUsdc: query.data?.escrowUsdc ?? null,
    cached: query.data?.cached ?? false,
    updatedAt: query.data?.updatedAt ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch,
  };
}
