import { Check } from "lucide-react";
import UsdcIcon from "@/components/shared/UsdcIcon";
import { CardShell } from "../primitives";
import type {
  AgentRecommendationCardPayload,
  CardState,
} from "@/types/navigator";

const COS_HOST = (
  process.env.NEXT_PUBLIC_COS_HOST ?? "https://object.croo.network"
).replace(/\/+$/, "");

function avatarSrc(avatar: string | undefined): string {
  const t = (avatar ?? "").trim();
  if (!t) return "/logo-croo.png";
  if (/^https?:\/\//i.test(t) || t.startsWith("data:")) return t;
  return COS_HOST ? `${COS_HOST}/${t.replace(/^\/+/, "")}` : "/logo-croo.png";
}

export interface AgentRecommendationCardProps {
  payload: AgentRecommendationCardPayload;
  state?: CardState;
  onSelect?: (agentId: string) => void;
  /**
   * External lock — set by ConversationView when this card belongs to a
   * historical assistant message (i.e. the conversation has moved on).
   * Disables Select buttons regardless of the card's own selection state.
   */
  disabled?: boolean;
}

export function AgentRecommendationCard({
  payload,
  state,
  onSelect,
  disabled,
}: AgentRecommendationCardProps) {
  const { agents, footer, pretext, selectedAgentId } = payload;
  const isLocked = disabled || !!selectedAgentId || state === "cancelled";
  const onlineAgents = agents.filter((a) => a.status !== "offline");

  if (onlineAgents.length === 0) {
    return (
      <div data-card-kind="agent_recommendation" className="space-y-2 w-full">
        <p className="text-xs text-[#6B6B6B] leading-relaxed">
          No matching online services found. Try searching for another service.
        </p>
      </div>
    );
  }

  return (
    <div data-card-kind="agent_recommendation" className="space-y-2 w-full">
      {pretext && (
        <p className="text-xs text-[#6B6B6B] leading-relaxed">{pretext}</p>
      )}
      <CardShell className={disabled ? "opacity-60" : ""}>
        {onlineAgents.map((a, i) => {
          const isSelected = selectedAgentId === a.agentId;
          const isDimmed = isLocked && !isSelected;
          const visibleTags = a.tags.slice(0, 3);
          const extraTags = a.tags.length - 3;
          const isOnline = a.status === "online";
          return (
            <div
              key={a.agentId ?? `agent-${i}`}
              className={`px-4 py-3.5 transition-colors ${i < onlineAgents.length - 1 ? "border-b border-[#F0F0EE]" : ""} ${
                isDimmed ? "opacity-40" : ""
              }`}
            >
              <div className="flex items-start gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={avatarSrc(a.avatar)}
                  alt={a.name}
                  className="w-10 h-10 rounded-[0.7rem] ring-1 ring-black/10 bg-[#F5F5F3] object-cover shrink-0"
                />

                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0 flex-wrap">
                      <span className="font-semibold text-sm text-[#0F0F0F] truncate">
                        {a.name}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full ${isOnline ? "bg-[#6EE646]/10" : "bg-[#E2E2E0]/50"}`}
                      >
                        <span
                          className={`w-1 h-1 rounded-full ${isOnline ? "bg-[#6EE646] animate-pulse" : "bg-[#9A9A9A]"}`}
                        />
                        <span
                          className={`text-[8px] font-mono uppercase tracking-wider ${isOnline ? "text-[#3D8C1F]" : "text-[#9A9A9A]"}`}
                        >
                          {isOnline ? "Live" : "Offline"}
                        </span>
                      </span>
                    </div>
                    {isSelected ? (
                      <span className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-lg bg-[#6EE646]/10 text-[#3D8C1F] border border-[#6EE646]/30">
                        <Check className="h-3 w-3" />
                        Selected
                      </span>
                    ) : (
                      <button
                        onClick={() =>
                          !isLocked && a.status !== "offline" && onSelect?.(a.agentId)
                        }
                        disabled={isLocked || a.status === "offline"}
                        className="shrink-0 px-2.5 py-1 text-[11px] font-medium rounded-lg border border-[#0F0F0F] text-[#0F0F0F] hover:bg-[#0F0F0F] hover:text-white transition-colors disabled:opacity-35 disabled:cursor-not-allowed"
                      >
                        Select
                      </button>
                    )}
                  </div>

                  <p className="text-xs text-[#6B6B6B] leading-snug line-clamp-2">
                    {a.description}
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

                  <div className="flex items-center gap-3 pt-0.5">
                    <span className="text-[10px] font-mono text-[#9A9A9A]">
                      <span className="text-[#6B6B6B]">Orders</span>{" "}
                      <span className="text-[#0F0F0F] font-semibold">{a.orders}</span>
                    </span>
                    <span className="text-[10px] font-mono text-[#9A9A9A]">
                      <span className="text-[#6B6B6B]">Completion</span>{" "}
                      <span className="text-[#3D8C1F] font-semibold">{a.completion}</span>
                    </span>
                    <span className="text-[10px] font-mono text-[#9A9A9A]">
                      <span className="text-[#6B6B6B]">Volume</span>{" "}
                      <span className="text-[#0F0F0F] font-semibold">{a.volume}</span>
                    </span>
                  </div>

                  <p className="text-[11px] text-[#6B6B6B] flex items-center gap-1">
                    From{" "}
                    <span className="font-semibold text-[#0F0F0F] inline-flex items-center gap-0.5">
                      {/^\$?\d/.test(a.lowestPrice ?? "") && <UsdcIcon size={11} />}
                      {(a.lowestPrice ?? "—").replace(/^\$/, "")}
                    </span>
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </CardShell>
      {footer && (
        <p className="text-xs text-[#6B6B6B] leading-relaxed">{footer}</p>
      )}
    </div>
  );
}
