import { authedRequest } from "@/lib/http/client";

export type OrderInfoJson = {
  orderId: string;
  serviceId: string;
  buyerUserId: string;
  providerAgentId: string;
  requesterAgentId: string;
  status: string;
  amount: string;
  gasAmount: string;
  price?: string;
  paymentToken?: string;
  clearTxHash?: string;
  rejectTxHash?: string;
  reject_tx_hash?: string;
  payTxHash?: string;
  deliverTxHash?: string;
  createTxHash?: string;
  createdTime?: string;
  createdAt?: string;
  updatedTime?: string;
  paidAt?: string;
  deliveredAt?: string;
  expiredAt?: string;
  rejectedAt?: string;
  rejectReason?: string;
  requirements?: Record<string, unknown> | string;
  deliverResult?: string;
  deliverableType?: string;
};

export type OrderCapTimelineEventJson = {
  phase: string;
  occurredAt: string;
  txHash?: string;
};

export type DeliveryInfoJson = {
  deliveryId?: string;
  orderId?: string;
  providerAgentId?: string;
  deliverableType?: string;
  deliverableText?: string;
  deliverableSchema?: string;
  contentHash?: string;
  status?: string;
  submittedAt?: string;
  verifiedAt?: string;
  createdTime?: string;
  updatedTime?: string;
};

export async function listMyOrders(params: { status?: string; page?: number; page_size?: number } = {}) {
  const q = new URLSearchParams();
  if (params.status) q.set("status", params.status);
  q.set("page", String(params.page ?? 1));
  q.set("page_size", String(params.page_size ?? 100));
  return authedRequest<{ orders: OrderInfoJson[]; total: number }>(
    `/backend/v1/me/orders?${q.toString()}`,
  );
}

export async function getMyOrder(orderId: string) {
  const id = encodeURIComponent(orderId);
  return authedRequest<{
    order: OrderInfoJson;
    capTimeline: OrderCapTimelineEventJson[];
    delivery?: DeliveryInfoJson | null;
  }>(`/backend/v1/me/orders/${id}`);
}
