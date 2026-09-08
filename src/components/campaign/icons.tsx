import {
  Trophy,
  Medal,
  Award,
  Star,
  type LucideIcon,
} from "lucide-react";
import type { Tier } from "@/lib/campaign-static";

/** Modern X (Twitter) wordmark logo. */
export function XLogo({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

/** Refined leading-icon tile used on task cards — subtle bordered square,
 *  thin-stroke monochrome icon. Gives a more designed, premium feel than a
 *  bare inline icon. */
export function IconTile({
  icon: Icon,
  state = "default",
  children,
}: {
  icon?: LucideIcon;
  state?: "default" | "done" | "locked";
  children?: React.ReactNode;
}) {
  const tone =
    state === "done"
      ? "border-[#6EE646]/40 bg-[#F0FDE8] text-[#3A3A3A]"
      : state === "locked"
        ? "border-[#EBEBEA] bg-[#F5F5F3] text-[#9A9A9A]"
        : "border-[#E2E2E0] bg-[#F5F5F3] text-[#0F0F0F]";
  return (
    <span
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${tone}`}
    >
      {Icon ? <Icon className="h-[18px] w-[18px]" strokeWidth={1.6} aria-hidden /> : children}
    </span>
  );
}

const TIER_ICON: Record<Tier, LucideIcon> = {
  Master: Trophy,
  Expert: Medal,
  Journeyman: Award,
  Apprentice: Star,
};

const TIER_COLOR: Record<Tier, string> = {
  Master: "text-[#B8902B]", // refined gold
  Expert: "text-[#9AA0A6]", // refined silver
  Journeyman: "text-[#A9744F]", // refined bronze
  Apprentice: "text-[#9A9A9A]",
};

export function TierIcon({
  tier,
  className = "h-3.5 w-3.5",
}: {
  tier: Tier;
  className?: string;
}) {
  const Icon = TIER_ICON[tier];
  return (
    <Icon
      className={`${className} ${TIER_COLOR[tier]}`}
      strokeWidth={1.6}
      aria-hidden
    />
  );
}
