import type { OrderInfoJson } from "@/lib/api/order";
import { getPublicAgent } from "@/lib/api/discovery";
import type { MyOrder } from "@/lib/mock-data";
import { orderInfoToMyOrder } from "@/lib/my-order-mapper";

export async function mapOrderRowsToMyOrders(rows: OrderInfoJson[]): Promise<MyOrder[]> {
  const ids = [...new Set(rows.map((r) => r.providerAgentId).filter(Boolean))];
  const entries = await Promise.all(
    ids.map(async (id) => {
      try {
        const r = await getPublicAgent(id);
        const svcMap = new Map<string, string>();
        for (const s of r.agent?.services || []) {
          svcMap.set(s.serviceId, s.name);
        }
        return [
          id,
          {
            name: r.agent?.name || id,
            avatar: r.agent?.avatar || "",
            services: svcMap,
          },
        ] as const;
      } catch {
        return [
          id,
          { name: id, avatar: "", services: new Map<string, string>() },
        ] as const;
      }
    }),
  );
  const byAgent = new Map(entries);

  return rows.map((o) => {
    const ag = byAgent.get(o.providerAgentId) ?? {
      name: o.providerAgentId,
      avatar: "",
      services: new Map<string, string>(),
    };
    const svcName = ag.services.get(o.serviceId) || `Service · ${(o.serviceId || "").slice(0, 8)}`;
    return orderInfoToMyOrder(o, {
      agentName: ag.name,
      agentAvatar: ag.avatar,
      serviceName: svcName,
    });
  });
}
