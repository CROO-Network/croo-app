import { Check } from "lucide-react";
import UsdcIcon from "@/components/shared/UsdcIcon";
import { formatSlaBadge } from "@/lib/currency";
import { CardShell } from "../primitives";
import type {
  CardState,
  ServiceListCardPayload,
} from "@/types/navigator";

export interface ServiceListCardProps {
  payload: ServiceListCardPayload;
  state?: CardState;
  onSelect?: (serviceId: string) => void;
  /**
   * External lock — set by ConversationView when this card belongs to a
   * historical assistant message (i.e. the conversation has moved on).
   * Disables Select buttons regardless of the card's own selection state.
   */
  disabled?: boolean;
}

export function ServiceListCard({
  payload,
  state,
  onSelect,
  disabled,
}: ServiceListCardProps) {
  const { services, footer, pretext, selectedServiceId } = payload;
  const isLocked = disabled || !!selectedServiceId || state === "cancelled";

  return (
    <div data-card-kind="service_list" className="space-y-2 w-full">
      {pretext && (
        <p className="text-xs text-[#6B6B6B] leading-relaxed">{pretext}</p>
      )}
      <CardShell className={disabled ? "opacity-60" : ""}>
        {services.map((s, i) => {
          const isSelected = selectedServiceId === s.serviceId;
          const isDimmed = isLocked && !isSelected;
          return (
            <div
              key={s.serviceId ?? `service-${i}`}
              className={`px-4 py-3.5 transition-colors ${i < services.length - 1 ? "border-b border-[#F0F0EE]" : ""} ${
                isDimmed ? "opacity-40" : ""
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1.5 min-w-0 flex-1">
                  <p className="font-semibold text-sm text-[#0F0F0F]">{s.name}</p>
                  <p className="text-xs text-[#6B6B6B] leading-snug line-clamp-2">
                    {s.description}
                  </p>
                  <div className="flex items-center gap-2 pt-0.5">
                    {s.price ? (
                      <span className="flex items-center gap-1 font-mono font-semibold text-xs text-[#0F0F0F]">
                        <UsdcIcon size={11} />
                        {s.price.replace(/^\$/, "")}
                        <span className="text-[#9A9A9A] font-normal text-[10px]">/ call</span>
                      </span>
                    ) : null}
                    {s.sla ? (
                      <span className="text-[9px] font-mono text-[#9A9A9A] bg-[#F5F5F3] px-1.5 py-0.5 rounded-full">
                        {formatSlaBadge(s.sla)}
                      </span>
                    ) : null}
                  </div>
                </div>
                {isSelected ? (
                  <span className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-lg bg-[#6EE646]/10 text-[#3D8C1F] border border-[#6EE646]/30">
                    <Check className="h-3 w-3" />
                    Selected
                  </span>
                ) : (
                  <button
                    onClick={() => !isLocked && onSelect?.(s.serviceId)}
                    disabled={isLocked}
                    className="shrink-0 px-2.5 py-1 text-[11px] font-medium rounded-lg border border-[#0F0F0F] text-[#0F0F0F] hover:bg-[#0F0F0F] hover:text-white transition-colors disabled:opacity-35 disabled:cursor-not-allowed"
                  >
                    Select
                  </button>
                )}
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
