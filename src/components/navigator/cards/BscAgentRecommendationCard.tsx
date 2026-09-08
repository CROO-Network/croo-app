import { ArrowUpRight } from "lucide-react";
import { ResolvedAgentAvatar } from "@/components/shared/ResolvedAgentAvatar";
import { CardShell } from "../primitives";
import { formatNumber } from "@/lib/formatters";
import { usdcMicroToUsd } from "@/lib/currency";
import type { BscAgentRecommendationCardPayload } from "@/types/navigator";

function formatCompactUsd(microUsd: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(usdcMicroToUsd(microUsd));
}

export function BscAgentRecommendationCard({
  payload,
}: {
  payload: BscAgentRecommendationCardPayload;
}) {
  return (
    <div data-card-kind="bsc_agent_recommendation" className="space-y-2 w-full">
      {payload.pretext && (
        <p className="text-xs text-[#6B6B6B] leading-relaxed">{payload.pretext}</p>
      )}
      <CardShell>
        {payload.agents.map((agent, index) => {
          const visibleTags = agent.tags.slice(0, 3);
          const extraTags = agent.tags.length - visibleTags.length;
          return (
            <div
              key={agent.agentId}
              className={`px-4 py-3.5 ${index < payload.agents.length - 1 ? "border-b border-[#F0F0EE]" : ""}`}
            >
              <div className="flex items-start gap-3">
                <ResolvedAgentAvatar
                  avatar={agent.avatar}
                  name={agent.name}
                  className="w-10 h-10 rounded-[0.7rem] ring-1 ring-black/10 bg-[#F5F5F3] object-cover shrink-0"
                />
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <span className="font-semibold text-sm text-[#0F0F0F] truncate">
                        {agent.name}
                      </span>
                    </div>
                    <a
                      href={agent.externalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-lg border border-[#0F0F0F] text-[#0F0F0F] hover:bg-[#0F0F0F] hover:text-white transition-colors"
                    >
                      Open
                      <ArrowUpRight className="h-3 w-3" />
                    </a>
                  </div>
                  <p className="text-xs text-[#6B6B6B] leading-snug line-clamp-2">
                    {agent.description || agent.recommendationReason}
                  </p>
                  {visibleTags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {visibleTags.map((tag) => (
                        <span
                          key={tag}
                          className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#EBEBEA] text-[#3A3A3A] font-medium"
                        >
                          {tag}
                        </span>
                      ))}
                      {extraTags > 0 && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#EBEBEA] text-[#9A9A9A] font-medium">
                          +{extraTags}
                        </span>
                      )}
                    </div>
                  )}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-0.5">
                    <span className="text-[10px] font-mono text-[#9A9A9A]">
                      <span className="text-[#6B6B6B]">Orders</span>{" "}
                      <span className="font-semibold text-[#0F0F0F]">
                        {formatNumber(agent.paymentCount)}
                      </span>
                    </span>
                    <span className="text-[10px] font-mono text-[#9A9A9A]">
                      <span className="text-[#6B6B6B]">Volume</span>{" "}
                      <span className="font-semibold text-[#0F0F0F]">
                        {formatCompactUsd(agent.totalRevenueMicroUsd)}
                      </span>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </CardShell>
      {payload.footer && (
        <p className="text-xs text-[#6B6B6B] leading-relaxed">{payload.footer}</p>
      )}
    </div>
  );
}
