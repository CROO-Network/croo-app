"use client";

import { useCallback } from "react";
import { useInteractCard } from "@/hooks/useInteractCard";
import {
  AgentRecommendationCard,
  FundTransferCard,
  OrderDetailCard,
  OrderListCard,
  OrderSuccessCard,
  SchemaFormCard,
  ServiceListCard,
  WelcomeCard,
} from "./cards";
import { BscAgentRecommendationCard } from "./cards/BscAgentRecommendationCard";
import type {
  AgentRecommendationCardPayload,
  BscAgentRecommendationCardPayload,
  CardPayload,
  ChatMessage,
  FundTransferCardPayload,
  OrderDetailCardPayload,
  OrderListCardPayload,
  OrderSuccessCardPayload,
  SchemaFormCardPayload,
  ServiceListCardPayload,
  UnknownCardPayload,
  WelcomeCardPayload,
} from "@/types/navigator";

export interface CardRendererProps {
  message: ChatMessage;
  card: CardPayload | UnknownCardPayload;
  /** Welcome quick actions; passed in from the conversation host */
  onQuickAction?: (text: string) => void;
  /** Wallet address for top-up flows (Navigator wallet) */
  walletAddress?: string;
  /**
   * Card belongs to a previous assistant turn. ConversationView sets this
   * so interactive controls (Select / Confirm & Pay / Top Up …) on stale
   * cards are externally disabled — only the latest assistant message keeps
   * its cards interactive.
   */
  isHistorical?: boolean;
  /** Optional close hook for cards that route away from Navigator. */
  onNavigateAway?: () => void;
}

/**
 * Dispatches a card payload to the matching card component based on cardType.
 * Unknown / not-yet-implemented types fall back to a JSON preview so that
 * future protocol additions never crash the conversation pane.
 */
export function CardRenderer({
  message,
  card,
  onQuickAction,
  walletAddress,
  isHistorical = false,
  onNavigateAway,
}: CardRendererProps) {
  const { interact } = useInteractCard();

  const onSelectAgent = useCallback(
    (agentId: string) => {
      void interact(
        message.id,
        card.cardId,
        "select",
        { agentId },
        {
          optimisticPatch: (c) => ({
            ...c,
            state: "selected",
            payload: {
              ...(c.payload as AgentRecommendationCardPayload),
              selectedAgentId: agentId,
            },
          }),
        },
      );
    },
    [interact, message.id, card.cardId],
  );

  const onSelectService = useCallback(
    (serviceId: string) => {
      void interact(
        message.id,
        card.cardId,
        "select",
        { serviceId },
        {
          optimisticPatch: (c) => ({
            ...c,
            state: "selected",
            payload: {
              ...(c.payload as ServiceListCardPayload),
              selectedServiceId: serviceId,
            },
          }),
        },
      );
    },
    [interact, message.id, card.cardId],
  );

  const onCancelForm = useCallback(() => {
    void interact(message.id, card.cardId, "cancel", undefined, {
      optimisticPatch: (c) => ({ ...c, state: "cancelled" }),
    });
  }, [interact, message.id, card.cardId]);

  const onSelectOrder = useCallback(
    (orderId: string) => {
      void interact(
        message.id,
        card.cardId,
        "select",
        { orderId },
        {
          optimisticPatch: (c) => ({
            ...c,
            state: "selected",
            payload: {
              ...(c.payload as OrderListCardPayload),
              selectedOrderId: orderId,
            },
          }),
        },
      );
    },
    [interact, message.id, card.cardId],
  );

  switch (card.cardType) {
    case "welcome": {
      const payload = card.payload as WelcomeCardPayload;
      return (
        <WelcomeCard
          greeting={payload.greeting}
          subtitle={payload.subtitle}
          quickActions={payload.quickActions}
          onSend={onQuickAction ?? (() => {})}
        />
      );
    }
    case "agent_recommendation":
      return (
        <AgentRecommendationCard
          payload={card.payload as AgentRecommendationCardPayload}
          state={card.state}
          onSelect={onSelectAgent}
          disabled={isHistorical}
        />
      );
    case "bsc_agent_recommendation":
      return (
        <BscAgentRecommendationCard
          payload={card.payload as BscAgentRecommendationCardPayload}
        />
      );
    case "service_list":
      return (
        <ServiceListCard
          payload={card.payload as ServiceListCardPayload}
          state={card.state}
          onSelect={onSelectService}
          disabled={isHistorical}
        />
      );
    case "schema_form":
      return (
        <SchemaFormCard
          payload={card.payload as SchemaFormCardPayload}
          state={card.state}
          onCancel={onCancelForm}
          cardId={card.cardId}
          messageId={message.id}
          disabled={isHistorical}
          walletAddress={walletAddress}
        />
      );
    case "fund_transfer":
      return (
        <FundTransferCard
          payload={card.payload as FundTransferCardPayload}
          state={card.state}
          onCancel={onCancelForm}
          cardId={card.cardId}
          messageId={message.id}
          disabled={isHistorical}
          walletAddress={walletAddress}
        />
      );
    case "order_success":
      return (
        <OrderSuccessCard
          payload={card.payload as OrderSuccessCardPayload}
          onNavigateAway={onNavigateAway}
          messageCreatedAt={message.createdAt}
          isHistorical={isHistorical}
        />
      );
    case "order_list":
      return (
        <OrderListCard
          payload={card.payload as OrderListCardPayload}
          state={card.state}
          onSelect={onSelectOrder}
        />
      );
    case "order_detail":
      return (
        <OrderDetailCard payload={card.payload as OrderDetailCardPayload} />
      );
    default:
      return <UnknownCardFallback card={card} />;
  }
}

function UnknownCardFallback({ card }: { card: CardPayload | UnknownCardPayload }) {
  return (
    <details className="rounded-xl border border-dashed border-[#E2E2E0] bg-[#FAFAF9] overflow-hidden w-full">
      <summary className="px-3 py-2 text-xs font-mono text-[#6B6B6B] cursor-pointer select-none">
        card · {card.cardType}
        {card.state ? ` · ${card.state}` : ""}
      </summary>
      <pre className="px-3 py-2 text-[11px] leading-relaxed text-[#3A3A3A] overflow-x-auto">
        {JSON.stringify(card.payload, null, 2)}
      </pre>
    </details>
  );
}
