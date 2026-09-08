"use client";

import { useEffect, useState } from "react";
import { BookOpen, Clock } from "lucide-react";

type CampaignStatus = "upcoming" | "running" | "ended";

function diffParts(target: number, now: number) {
  const ms = Math.max(0, target - now);
  const totalMin = Math.floor(ms / 60000);
  const days = Math.floor(totalMin / (60 * 24));
  const hours = Math.floor((totalMin % (60 * 24)) / 60);
  const mins = totalMin % 60;
  return { days, hours, mins };
}

function Countdown({ endsAt }: { endsAt?: number }) {
  const [now, setNow] = useState<number | null>(null);
  const target = endsAt;

  useEffect(() => {
    const tick = () => setNow(Date.now());
    const firstTick = setTimeout(tick, 0);
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => {
      clearTimeout(firstTick);
      clearInterval(id);
    };
  }, []);

	// Keep the first client render stable before the timer mounts or config loads.
  if (now === null || typeof target !== "number" || !Number.isFinite(target)) {
		return (
			<span className="font-mono text-sm tabular-nums text-[#6B6B6B]">
				— d — h — m left
      </span>
    );
  }

  const { days, hours, mins } = diffParts(target, now);
  const cell = (v: number, unit: string) => (
    <span className="inline-flex items-baseline gap-0.5">
      <span className="font-mono text-base font-semibold tabular-nums text-[#0F0F0F]">
        {String(v).padStart(2, "0")}
      </span>
      <span className="text-[11px] text-[#9A9A9A]">{unit}</span>
    </span>
  );

  return (
    <span className="inline-flex items-center gap-2">
      {cell(days, "d")}
      {cell(hours, "h")}
      {cell(mins, "m")}
      <span className="text-xs text-[#9A9A9A]">left</span>
    </span>
  );
}

interface CampaignHeroProps {
  status?: CampaignStatus;
  endsAt?: number;
  onOpenRules?: () => void;
}

export default function CampaignHero({
	status = "running",
	endsAt,
	onOpenRules,
}: CampaignHeroProps) {
	return (
    <section className="relative overflow-hidden border-b border-[#E2E2E0] bg-[#F5F5F3]">
      {/* Dot-grid backdrop */}
      <div className="bg-dot-pattern pointer-events-none absolute inset-0 opacity-60" />
      {/* Lime radial highlight */}
      <div
        className="pointer-events-none absolute -right-32 -top-40 h-[420px] w-[420px] rounded-full blur-3xl"
        style={{
          background:
            "radial-gradient(circle, rgba(110,230,70,0.28) 0%, rgba(110,230,70,0.10) 40%, transparent 70%)",
        }}
      />
      {/* Secondary radial accent */}
      <div
        className="pointer-events-none absolute -bottom-32 -left-24 h-[320px] w-[320px] rounded-full blur-3xl"
        style={{
          background:
            "radial-gradient(circle, rgba(110,230,70,0.12) 0%, transparent 70%)",
        }}
      />

      <div className="relative mx-auto max-w-6xl px-6 pb-16 pt-28">
        {/* Campaign label */}
        <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#6EE646]/40 bg-[#F0FDE8] px-3 py-1">
          <span className="h-1.5 w-1.5 rounded-full bg-[#6EE646]" />
          <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#3A3A3A]">
            Campaign · Live
          </span>
        </div>

        {/* Main title */}
        <h1 className="max-w-3xl text-5xl font-bold leading-[1.05] tracking-tight text-[#0F0F0F] sm:text-6xl">
          My First{" "}
          <span className="relative text-[#5BC23A]">
            Agent
            <span className="text-glow-lime absolute inset-0 -z-10" aria-hidden>
              Agent
            </span>
          </span>
        </h1>

        {/* Lead subtitle */}
        <p className="mt-5 max-w-xl text-lg leading-snug text-[#3A3A3A] sm:text-xl">
          Your first Agent experience — step into the AI Agent economy.
        </p>

        {/* Supporting intro */}
        <p className="mt-2 max-w-xl text-sm font-medium text-[#0F0F0F]">
          One journey. One Agent. One reward.
        </p>
        <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-[#6B6B6B]">
          From sign-up to your first order, complete tasks to earn SBT tier
          badges plus up to{" "}
          <span className="font-medium text-[#0F0F0F]">100 USDC</span>.
        </p>

        {/* CTA + countdown */}
        <div className="mt-8 flex flex-wrap items-center gap-4">
          <button
            onClick={onOpenRules}
            className="inline-flex items-center gap-2 rounded-full bg-[#0F0F0F] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#252525]"
          >
            <BookOpen className="h-4 w-4" aria-hidden />
            Rules &amp; Rewards
          </button>

          <div className="inline-flex items-center gap-2 rounded-full border border-[#E2E2E0] bg-white px-4 py-2.5">
            <Clock className="h-4 w-4 text-[#9A9A9A]" aria-hidden />
            {status === "upcoming" ? (
              <span className="text-sm text-[#6B6B6B]">Starting soon</span>
            ) : status === "ended" ? (
              <span className="text-sm text-[#6B6B6B]">Campaign ended</span>
			) : (
				<Countdown endsAt={endsAt} />
			)}
          </div>
        </div>
      </div>
    </section>
  );
}
