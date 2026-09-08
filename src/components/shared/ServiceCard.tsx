"use client";

import Link from "next/link";
import PriceValue from "@/components/shared/PriceValue";
import { ResolvedAgentAvatar } from "@/components/shared/ResolvedAgentAvatar";
import { useNavigator } from "@/lib/navigator-context";
import { useChain } from "@/lib/chain-context";
import { getAgentHandoffUrl, isDiscoveryChain, isDiscoveryRecord } from "@/lib/chains";
import { agentDetailHref } from "@/lib/api/discovery";
import { formatSlaBadge } from "@/lib/currency";
import { hasDiscoveryMoney } from "@/lib/formatters";

interface ServiceCardProps {
  service: {
    id: string;
    name: string;
    description: string;
    price: number;
    sla: string;
    orders7d?: number;
    agentName: string;
    agentId: string;
    agentAvatar: string;
    externalUrl?: string;
    chain?: string;
  };
  /** Close a parent overlay (search modal) before routing to the agent. */
  onOpenAgent?: (href: string) => void;
}

export default function ServiceCard({ service, onOpenAgent }: ServiceCardProps) {
  const { openNavigator } = useNavigator();
  const { isInteractive } = useChain();
  const canOrder = isInteractive && !isDiscoveryChain(service.chain);
  const discovery = isDiscoveryRecord(service.chain, isInteractive);
  const detailHref = agentDetailHref(service.agentId);

  const handleTryThis = () => {
    openNavigator({
      type: "try_this",
      agentId: service.agentId,
      agentName: service.agentName,
      serviceId: service.id,
      serviceName: service.name,
    });
  };

  const tryThisClass =
    "inline-flex items-center gap-1 text-xs text-[#6EE646] hover:text-[#5DD835] font-medium transition-colors shrink-0 pointer-events-auto";
  const tryThisArrow = (
    <svg width="12" height="12" viewBox="0 0 14 14" fill="none" className="mt-px">
      <path
        d="M3 7h8M8 4l3 3-3 3"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );

  return (
    <div className="relative flex h-full flex-col rounded-2xl border border-[#E2E2E0] bg-white p-5 hover:border-[#C2C2C0] hover:shadow-sm transition-all duration-150 group">
      <Link
        href={detailHref}
        onClick={
          onOpenAgent
            ? (e) => {
                e.preventDefault();
                onOpenAgent(detailHref);
              }
            : undefined
        }
        className="absolute inset-0 z-10 rounded-2xl"
        aria-label={`${service.name} by ${service.agentName}`}
      />

      <h3 className="text-sm font-semibold text-[#0F0F0F] mb-1.5 line-clamp-1 group-hover:text-[#3D8C1F] transition-colors">
        {service.name}
      </h3>

      <p className="text-xs text-[#9A9A9A] leading-relaxed line-clamp-2 mb-4 min-h-[2.25rem]">
        {service.description}
      </p>

      {discovery ? (
        hasDiscoveryMoney(service.price) ? (
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <span className="flex items-center gap-1 font-mono font-semibold text-sm text-[#0F0F0F]">
              <PriceValue amount={service.price ?? 0} iconSize={14} />
            </span>
          </div>
        ) : null
      ) : (
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <span className="flex items-center gap-1 font-mono font-semibold text-sm text-[#0F0F0F]">
            <PriceValue amount={service.price ?? 0} iconSize={14} />
            <span className="text-[#9A9A9A] font-normal text-xs">/ call</span>
          </span>
          <span className="text-[10px] font-mono text-[#9A9A9A] bg-[#F5F5F3] px-2 py-0.5 rounded-full">
            {formatSlaBadge(service.sla)}
          </span>
          <span className="text-[10px] font-mono text-[#6B6B6B] bg-[#F5F5F3] px-2 py-0.5 rounded-full">
            {(service.orders7d ?? 0).toLocaleString("en-US")} orders
          </span>
        </div>
      )}

      <div className="mt-auto" />

      <div className="relative z-20 flex items-center justify-between pt-3 border-t border-[#F0F0EE] pointer-events-none">
        <div className="flex items-center gap-2 min-w-0">
          <ResolvedAgentAvatar
            avatar={service.agentAvatar}
            name={service.agentName}
            className="w-5 h-5 rounded-md ring-1 ring-black/5 bg-[#F5F5F3] object-cover shrink-0"
          />
          <span className="text-[11px] text-[#9A9A9A] truncate">
            {service.agentName}
          </span>
        </div>
        {canOrder ? (
          <button type="button" onClick={handleTryThis} className={`${tryThisClass} cursor-pointer`}>
            Try this
            {tryThisArrow}
          </button>
        ) : (
          <a
            href={getAgentHandoffUrl({ id: service.agentId, externalUrl: service.externalUrl })}
            target="_blank"
            rel="noopener noreferrer"
            className={tryThisClass}
          >
            Try this
            {tryThisArrow}
          </a>
        )}
      </div>
    </div>
  );
}
