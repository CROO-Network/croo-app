// CROO opens on BNB Smart Chain. The store discovers ERC-8004 identities
// published through BNB Agent Studio — search, Navigator, activity and
// leaderboards all run against it. Ordering is a hand-off: every "act on it"
// affordance opens the agent's own endpoint, and payment settles on BSC via
// x402 off-site, coming back into the activity feed as a BscScan link.
//
// A secondary chain mode runs the in-app CAP loop — wallet, escrow, orders and
// the personal center — against the same store and backend.

export type ChainId = "bsc" | "base";

export interface ChainMeta {
  id: ChainId;
  /** Full display name used in the switcher and copy */
  label: string;
  /** Compact label for badges */
  short: string;
  accent: string;
  /**
   * Whether this mode supports on-chain interaction — ordering, payments,
   * balances and the personal center. `false` means discovery + hand-off only.
   */
  interactive: boolean;
  /** Whether the chain reports a per-agent completion rate */
  hasCompletionRate: boolean;
}

export const CHAINS: Record<ChainId, ChainMeta> = {
  bsc: {
    id: "bsc",
    label: "BNB Chain",
    short: "BNB",
    accent: "#F0B90B",
    interactive: false,
    hasCompletionRate: false,
  },
  base: {
    id: "base",
    label: "Base",
    short: "Base",
    accent: "#0052FF",
    interactive: true,
    hasCompletionRate: true,
  },
};

export const CHAIN_ORDER: ChainId[] = ["bsc", "base"];

/** Users land on BNB Smart Chain. */
export const DEFAULT_CHAIN: ChainId = "bsc";

export const CHAIN_STORAGE_KEY = "croo_chain";

/** EVM numeric ids for the connected wallet (wagmi / RainbowKit). */
export const EVM_CHAIN_IDS: Record<ChainId, number> = {
  bsc: 56,
  base: 8453,
};

export function toWagmiChainId(chain: ChainId): number {
  return EVM_CHAIN_IDS[chain];
}

/** Third-party agent publishing flow agents are handed off to on BSC. */
export const BNB_AGENT_STUDIO_URL =
  "https://www.bnbchain.org/en/bnb-agent-studio";

export function isChainId(value: string | null | undefined): value is ChainId {
  return value === "bsc" || value === "base";
}

/** Backend `chain` query value. Matches UI ChainId. */
export function toApiChain(chain: ChainId): "base" | "bsc" {
  return chain;
}

/**
 * Record-level discovery-only check. Use this (not only the UI switcher) so a
 * deep-linked BSC agent stays read-only even when the switcher has moved.
 */
export function isDiscoveryChain(chain?: string | null): boolean {
  return chain === "bsc";
}

/**
 * Same gate as Rate / Live: BSC records, or a missing chain while the
 * switcher is on BNB. Keep this in one place so list, search, and detail
 * do not drift.
 */
export function isDiscoveryRecord(
  chain?: string | null,
  isInteractive = true,
): boolean {
  return isDiscoveryChain(chain) || (!chain && !isInteractive);
}

/**
 * BSC hand-off URL. Prefer the agent's `externalUrl` from the API; otherwise
 * fall back to BNB Agent Studio rather than inventing a per-agent page.
 */
export function getAgentHandoffUrl(
  input?: string | { id?: string; externalUrl?: string },
): string {
  if (input && typeof input === "object") {
    const url = input.externalUrl?.trim();
    if (url) return url;
  }
  return BNB_AGENT_STUDIO_URL;
}

/** BscScan transaction URL for BSC x402 payment hashes. */
export function bscScanTxUrl(hash: string): string {
  const h = hash.trim();
  if (!h) return "https://bscscan.com";
  return `https://bscscan.com/tx/${h}`;
}
