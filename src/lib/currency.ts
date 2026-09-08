/** USDC on-chain amounts use 6 decimals (smallest unit). */
export const USDC_DECIMALS = 6;
const MICRO = 10 ** USDC_DECIMALS;

export function usdcMicroFromUsd(usd: number): number {
  if (!Number.isFinite(usd) || usd <= 0) return 0;
  return Math.round(usd * MICRO);
}

/** Convert API/DB integer amounts in **USDC micro units** (6 decimals) to USD, e.g. `24950` → 0.02495. */
export function usdcMicroToUsd(micro: number): number {
  if (!Number.isFinite(micro) || micro <= 0) return 0;
  return micro / MICRO;
}

export function formatSlaMinutes(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return "—";
  if (minutes < 60) return `< ${minutes}min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (m === 0) return `< ${h}h`;
  return `< ${h}h ${m}min`;
}

export function formatSlaBadge(sla: string): string {
  const value = sla.trim();
  if (!value || value === "—") return "SLA —";
  if (value.toUpperCase().startsWith("SLA ")) return value;
  return `SLA ${value.startsWith("<") ? value : `< ${value}`}`;
}
