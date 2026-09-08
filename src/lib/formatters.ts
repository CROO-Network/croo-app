import { USDC_DECIMALS } from "@/lib/currency";

const USDC_MICRO = 10 ** USDC_DECIMALS;
/** One USDC cent in micro units. Dust below this is `<$0.01` on BNB. */
const USDC_CENT_MICRO = USDC_MICRO / 100;

function usdAbsMicros(amount: number): number {
  return Math.round(Math.abs(amount) * USDC_MICRO);
}

function formatUsd2(amount: number): string {
  return amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function fmtUsd(amount: number): string {
  if (!Number.isFinite(amount)) return "$0.00";
  return `$${formatUsd2(amount)}`;
}

export function formatDate(value: string | number | Date): string {
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatSla(hours: string | number, minutes: string | number): string {
  const parsedHours = Number.parseInt(String(hours), 10) || 0;
  const parsedMinutes = Number.parseInt(String(minutes), 10) || 0;

  if (parsedHours === 0 && parsedMinutes === 0) {
    return "—";
  }

  if (parsedHours === 0) {
    return `${parsedMinutes}min`;
  }

  if (parsedMinutes === 0) {
    return `${parsedHours}hr`;
  }

  return `${parsedHours}hr ${parsedMinutes}min`;
}

export function formatUsdc(amount: number): string {
  return amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Hair space so `<$` does not collide, without a full mono-width gap. */
const DUST_GAP = "\u200A";

/** BNB store: missing / 0 API money is not a price — don't render it. */
export function hasDiscoveryMoney(amount: number | null | undefined): amount is number {
  return amount != null && Number.isFinite(amount) && amount > 0;
}

export function isDiscoveryDust(amount: number | null | undefined): boolean {
  return hasDiscoveryMoney(amount) && usdAbsMicros(amount) < USDC_CENT_MICRO;
}

/**
 * BNB / discovery amounts: empty is not formatted; dust under $0.01 is
 * `<0.01`; otherwise two decimals.
 */
export function formatDiscoveryUsdNumber(amount: number): string {
  if (!hasDiscoveryMoney(amount)) return "";
  if (isDiscoveryDust(amount)) return `<${DUST_GAP}0.01`;
  return formatUsd2(Math.abs(amount));
}

/**
 * Prefixed BNB / discovery amount. Empty → `""`; dust under $0.01 → `<$0.01`
 * with a hair space so mono fonts do not blow the gap open.
 */
export function fmtDiscoveryUsd(amount: number): string {
  if (!hasDiscoveryMoney(amount)) return "";
  const sign = amount < 0 ? "-" : "";
  if (isDiscoveryDust(amount)) return `${sign}<${DUST_GAP}$0.01`;
  return `${sign}$${formatUsd2(Math.abs(amount))}`;
}

/** `null` when the API has no money so callers can hide the whole price. */
export function discoveryMoneyText(amount: number | null | undefined): string | null {
  if (!hasDiscoveryMoney(amount)) return null;
  return fmtDiscoveryUsd(amount);
}

export function formatVolume(amount: number): string {
  if (!Number.isFinite(amount) || amount <= 0) return "$0.00";
  return fmtUsd(amount);
}

/** BNB volume: hide when empty; dust uses a hair-spaced `<$0.01`. */
export function formatDiscoveryVolume(amount: number): string {
  return fmtDiscoveryUsd(amount);
}

export function formatNumber(num: number): string {
  return num.toLocaleString("en-US");
}

/** completionRate from API is 0–100; show two decimals, except exact 100 → `100%`. */
export function formatCompletionRatePct(rate: number): string {
  if (!Number.isFinite(rate) || rate <= 0) return "0.00%";
  const rounded = Math.round(rate * 100) / 100;
  if (rounded >= 100) return "100%";
  return `${rounded.toFixed(2)}%`;
}

/** 8004scan composite score (BSC). Missing / zero → em dash. */
export function formatScore(score?: number): string {
  if (score == null || !Number.isFinite(score) || score <= 0) return "—";
  return Number.isInteger(score) ? String(score) : score.toFixed(1);
}

/** Order timeline timestamps (UTC, from API RFC3339). */
export function formatOrderTimelineTime(iso: string): string {
  if (!iso || iso === "—") return "—";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
}

export function truncateAddress(addr: string): string {
  if (!addr || addr.length < 12) return addr || "";
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

/** Mask a full `croo_sk_…` API key for display (same shape as backend GetAgent `sdkKey`). */
export function maskSdkKeyForDisplay(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  const pref = "croo_sk_";
  if (!t.startsWith(pref)) return "croo_sk_****";
  const secret = t.slice(pref.length);
  if (secret.length < 4) return `${pref}****`;
  return `${pref}****${secret.slice(-4)}`;
}
