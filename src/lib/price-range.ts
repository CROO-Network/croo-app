/** USDC micro (6 decimals) per whole USD. */
const M = 1_000_000;

/**
 * Public agent list: backend filters MIN(service.price) in micro units.
 * Semantics: p<1, 1<=p<=10, 10<=p<=100, p>100 (USD).
 */
export function getAgentListPriceMicroBounds(label: string): { minMicro: number; maxMicro: number } {
  switch (label) {
    case "All":
      return { minMicro: 0, maxMicro: 0 };
    case "< $1":
      return { minMicro: 0, maxMicro: M - 1 };
    case "$1 - $10":
      return { minMicro: M, maxMicro: 10 * M };
    case "$10 - $100":
      return { minMicro: 10 * M, maxMicro: 100 * M };
    case "> $100":
      return { minMicro: 100 * M + 1, maxMicro: 0 };
    default:
      return { minMicro: 0, maxMicro: 0 };
  }
}

/** Client-side USD filter when filtering loaded rows (e.g. services page). */
export function usdPriceMatchesRangeLabel(usd: number, label: string): boolean {
  switch (label) {
    case "All":
      return true;
    case "< $1":
      return usd < 1;
    case "$1 - $10":
      return usd >= 1 && usd <= 10;
    case "$10 - $100":
      return usd >= 10 && usd <= 100;
    case "> $100":
      return usd > 100;
    default:
      return true;
  }
}
