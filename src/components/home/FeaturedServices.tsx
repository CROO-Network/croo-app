"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import ServiceCard from "@/components/shared/ServiceCard";
import { getPublicAgent, listPopularServices } from "@/lib/api/discovery";
import { formatSlaMinutes, usdcMicroToUsd } from "@/lib/currency";
import { useChain } from "@/lib/chain-context";

type CardService = {
  id: string;
  name: string;
  description: string;
  price: number;
  sla: string;
  orders7d: number;
  agentName: string;
  agentId: string;
  agentAvatar: string;
  chain?: string;
  externalUrl?: string;
};

export default function FeaturedServices() {
  const { chain, isInteractive } = useChain();
  const [services, setServices] = useState<CardService[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await listPopularServices(12, chain);
        if (cancelled) return;
        let rows: CardService[] = (res.items || []).map((i) => ({
          id: i.serviceId,
          name: i.serviceName,
          description: (i.description ?? "").trim(),
          price: usdcMicroToUsd(Number(i.price) || 0),
          sla: formatSlaMinutes(Number(i.slaMinutes) || 0),
          orders7d: Math.trunc(Number(i.orders7d ?? 0)) || 0,
          agentName: i.agentName,
          agentId: i.agentId,
          agentAvatar: i.agentAvatar || "",
          chain: i.chain,
        }));
        if (!isInteractive) {
          const ids = [...new Set(rows.map((r) => r.agentId).filter(Boolean))];
          const loaded = await Promise.all(
            ids.map(async (id) => {
              try {
                const r = await getPublicAgent(id, chain);
                return [id, r.agent?.externalUrl?.trim() || ""] as const;
              } catch {
                return [id, ""] as const;
              }
            }),
          );
          if (cancelled) return;
          const urls = new Map(loaded);
          rows = rows.map((r) => ({
            ...r,
            externalUrl: urls.get(r.agentId) || undefined,
          }));
        }
        if (cancelled) return;
        setServices(rows);
      } catch {
        if (!cancelled) setServices([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [chain, isInteractive]);

  return (
    <section className="py-12">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-center gap-2 mb-2">
          <span className="w-4 h-0.5 bg-[#6EE646] rounded-full" />
          <span className="text-[10px] font-mono text-[#9A9A9A] uppercase tracking-widest">
            Popular Services
          </span>
        </div>

        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-[#0F0F0F] tracking-tight">
            Popular Services
          </h2>
          <Link href="/services" className="text-sm text-[#6EE646] hover:underline">
            View All &rarr;
          </Link>
        </div>

        {loading ? (
          <p className="text-sm text-[#9A9A9A]">Loading…</p>
        ) : services.length === 0 ? (
          <p className="text-sm text-[#9A9A9A]">No popular services yet.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {services.map((service) => (
              <ServiceCard key={service.id} service={service} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
