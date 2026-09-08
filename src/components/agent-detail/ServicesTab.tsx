"use client";

import { useState } from "react";
import type { Agent, SchemaField, Service } from "@/lib/mock-data";
import PriceValue from "@/components/shared/PriceValue";
import { useNavigator } from "@/lib/navigator-context";
import { useChain } from "@/lib/chain-context";
import { getAgentHandoffUrl, isDiscoveryChain, isDiscoveryRecord } from "@/lib/chains";
import { schemaFieldTypeLabel } from "@/lib/schema-fields";
import { formatSlaBadge } from "@/lib/currency";
import { hasDiscoveryMoney } from "@/lib/formatters";

interface ServicesTabProps {
  agent: Agent;
}

function hasContent(value: string | Record<string, string> | undefined | null): boolean {
  if (typeof value === "string") {
    return value.trim().length > 0;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  return Object.keys(value).length > 0;
}

function ServiceItem({
  service,
  agent,
}: {
  service: Service;
  agent: Agent;
}) {
  const [showReq, setShowReq] = useState(false);
  const [showDel, setShowDel] = useState(false);
  const { openNavigator } = useNavigator();
  const { isInteractive } = useChain();
  const canOrder = isInteractive && !isDiscoveryChain(agent.chain);
  const discovery = isDiscoveryRecord(agent.chain, isInteractive);

  const handleTryThis = () => {
    openNavigator({
      type: "try_this",
      agentId: agent.id,
      agentName: agent.name,
      serviceId: service.id,
      serviceName: service.name,
    });
  };

  const renderText = (text: string) => {
    if (!text.trim()) {
      return <p className="text-sm text-[#9A9A9A]">—</p>;
    }
    return <p className="text-sm text-[#6B6B6B] leading-relaxed whitespace-pre-wrap">{text}</p>;
  };

  const renderSchemaFields = (fields: SchemaField[] | undefined) => {
    if (!fields?.length) {
      return <p className="text-sm text-[#9A9A9A]">—</p>;
    }
    return (
      <div className="space-y-1.5">
        {fields.map((f) => (
          <div key={f.name} className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="text-xs font-mono text-[#0F0F0F] bg-[#F5F5F3] px-2 py-0.5 rounded">
              {f.name}
            </span>
            <span className="text-xs text-[#9A9A9A]">
              {schemaFieldTypeLabel(f)}
              {f.description ? ` (${f.description})` : ""}
            </span>
          </div>
        ))}
      </div>
    );
  };

  const renderRecordFields = (fields: Record<string, string>) => (
    <div className="space-y-1.5">
      {Object.entries(fields).map(([key, value]) => (
        <div key={key} className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="text-xs font-mono text-[#0F0F0F] bg-[#F5F5F3] px-2 py-0.5 rounded">
            {key}
          </span>
          <span className="text-xs text-[#9A9A9A]">{value}</span>
        </div>
      ))}
    </div>
  );

  const renderRequirements = () => {
    if (service.requirementType === "schema" && service.requirementsSchema?.length) {
      return renderSchemaFields(service.requirementsSchema);
    }
    if (typeof service.requirements !== "string") {
      return renderRecordFields(service.requirements);
    }
    return renderText(typeof service.requirements === "string" ? service.requirements : "");
  };

  const renderDeliverable = () => {
    if (service.deliverableType === "schema" && service.deliverableSchema?.length) {
      return renderSchemaFields(service.deliverableSchema);
    }
    if (typeof service.deliverable !== "string") {
      return renderRecordFields(service.deliverable);
    }
    return renderText(typeof service.deliverable === "string" ? service.deliverable : "");
  };

  const ordersLabel = `${(service.orders7d ?? 0).toLocaleString("en-US")} orders`;
  const hasRequirements =
    (service.requirementType === "schema" && !!service.requirementsSchema?.length)
    || hasContent(service.requirements);
  const hasDeliverable =
    (service.deliverableType === "schema" && !!service.deliverableSchema?.length)
    || hasContent(service.deliverable);

  return (
    <div className="rounded-2xl border border-[#E2E2E0] bg-white p-5">
      {/* Top row: Name + Price/SLA */}
      <div className="flex items-center justify-between gap-3 mb-1">
        <h3 className="text-sm font-semibold text-[#0F0F0F] truncate">
          {service.name}
        </h3>
        <div className="flex items-center gap-2.5 shrink-0">
          {discovery ? (
            hasDiscoveryMoney(service.price) ? (
              <PriceValue
                amount={service.price}
                className="font-mono font-semibold text-sm text-[#0F0F0F]"
              />
            ) : null
          ) : (
            <>
              <PriceValue
                amount={service.price}
                className="font-mono font-semibold text-sm text-[#0F0F0F]"
              />
              <span className="text-[10px] font-mono text-[#9A9A9A] bg-[#F5F5F3] px-1.5 py-0.5 rounded-full">
                {formatSlaBadge(service.sla)}
              </span>
              <span className="text-[10px] font-mono text-[#6B6B6B] bg-[#F5F5F3] px-1.5 py-0.5 rounded-full">
                {ordersLabel}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Description */}
      <p className="text-xs text-[#9A9A9A] leading-relaxed mb-2">
        {service.description}
      </p>

      {/* Bottom row: toggles left + Try this right */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {hasRequirements && (
            <button
              onClick={() => setShowReq(!showReq)}
              className={`text-[10px] font-medium px-2 py-0.5 rounded-full border transition-all duration-150 ${
                showReq
                  ? "bg-[#0F0F0F] text-white border-[#0F0F0F]"
                  : "bg-white text-[#6B6B6B] border-[#E2E2E0] hover:border-[#9A9A9A]"
              }`}
            >
              Requirements {showReq ? "▲" : "▼"}
            </button>
          )}
          {hasDeliverable && (
            <button
              onClick={() => setShowDel(!showDel)}
              className={`text-[10px] font-medium px-2 py-0.5 rounded-full border transition-all duration-150 ${
                showDel
                  ? "bg-[#0F0F0F] text-white border-[#0F0F0F]"
                  : "bg-white text-[#6B6B6B] border-[#E2E2E0] hover:border-[#9A9A9A]"
              }`}
            >
              Deliverable {showDel ? "▲" : "▼"}
            </button>
          )}
        </div>
        {canOrder ? (
          <button
            type="button"
            onClick={handleTryThis}
            className="inline-flex items-center gap-0.5 text-xs text-[#6EE646] hover:text-[#5DD835] font-medium transition-colors shrink-0 cursor-pointer"
          >
            Try this
            <svg width="11" height="11" viewBox="0 0 14 14" fill="none">
              <path d="M3 7h8M8 4l3 3-3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        ) : (
          <a
            href={getAgentHandoffUrl(agent)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-0.5 text-xs text-[#6EE646] hover:text-[#5DD835] font-medium transition-colors shrink-0"
          >
            Try this
            <svg width="11" height="11" viewBox="0 0 14 14" fill="none">
              <path d="M3 7h8M8 4l3 3-3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
        )}
      </div>

      {/* Requirements expanded */}
      {hasRequirements && showReq && (
        <div className="mt-2 p-2.5 bg-[#FAFAF9] rounded-lg border border-[#F0F0EE]">
          <p className="text-[10px] font-mono text-[#9A9A9A] uppercase tracking-wider mb-1">
            Requirements
          </p>
          {renderRequirements()}
        </div>
      )}

      {/* Deliverable expanded */}
      {hasDeliverable && showDel && (
        <div className="mt-2 p-2.5 bg-[#FAFAF9] rounded-lg border border-[#F0F0EE]">
          <p className="text-[10px] font-mono text-[#9A9A9A] uppercase tracking-wider mb-1">
            Deliverable
          </p>
          {renderDeliverable()}
        </div>
      )}
    </div>
  );
}

export default function ServicesTab({ agent }: ServicesTabProps) {
  const activeServices = agent.services;

  if (activeServices.length === 0) {
    return (
      <div className="rounded-2xl border border-[#E2E2E0] bg-white p-6 text-center">
        <p className="text-sm text-[#9A9A9A]">No services available</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {activeServices.map((service) => (
        <ServiceItem
          key={service.id}
          service={service}
          agent={agent}
        />
      ))}
    </div>
  );
}
