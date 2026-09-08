"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import {
  CHAINS,
  CHAIN_STORAGE_KEY,
  DEFAULT_CHAIN,
  isChainId,
  type ChainId,
  type ChainMeta,
} from "@/lib/chains";

interface ChainContextValue {
  /** Currently selected chain mode */
  chain: ChainId;
  /** Metadata for the current chain */
  meta: ChainMeta;
  /** Shorthand for `meta.interactive` — false in BNB Chain mode */
  isInteractive: boolean;
  /** False until the stored `croo_chain` choice (if any) has been applied. */
  ready: boolean;
  setChain: (chain: ChainId) => void;
  /** Write the UI chain without running a detail-page intercept. */
  commitChain: (chain: ChainId) => void;
  /**
   * Detail pages can intercept `setChain` and navigate to the counterpart
   * agent instead. Return true if the switch was handled.
   */
  registerSwitchHandler: (handler: ((next: ChainId) => boolean) | null) => void;
}

const Ctx = createContext<ChainContextValue | null>(null);

export function ChainProvider({ children }: { children: ReactNode }) {
  // Start on the default so server and first client render agree; the stored
  // choice is applied on mount (same pattern as the identity gate).
  const [chain, setChainState] = useState<ChainId>(DEFAULT_CHAIN);
  const [ready, setReady] = useState(false);
  const switchHandlerRef = useRef<((next: ChainId) => boolean) | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const raw = localStorage.getItem(CHAIN_STORAGE_KEY);
        if (isChainId(raw)) setChainState(raw);
      } catch {
        /* ignore */
      }
      setReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const commitChain = useCallback((next: ChainId) => {
    setChainState((prev) => {
      if (prev === next) return prev;
      try {
        localStorage.setItem(CHAIN_STORAGE_KEY, next);
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const setChain = useCallback((next: ChainId) => {
    if (switchHandlerRef.current?.(next)) return;
    commitChain(next);
  }, [commitChain]);

  const registerSwitchHandler = useCallback(
    (handler: ((next: ChainId) => boolean) | null) => {
      switchHandlerRef.current = handler;
    },
    [],
  );

  return (
    <Ctx.Provider
      value={{
        chain,
        meta: CHAINS[chain],
        isInteractive: CHAINS[chain].interactive,
        ready,
        setChain,
        commitChain,
        registerSwitchHandler,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useChain() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useChain must be used within ChainProvider");
  return ctx;
}
