export type MessageRole = "user" | "assistant" | "system" | "tool";

export type RunStatus = "idle" | "running" | "done" | "error";

export const CARD_TYPES = [
  "welcome",
  "agent_recommendation",
  "bsc_agent_recommendation",
  "service_list",
  "schema_form",
  "order_success",
  "order_list",
  "order_detail",
  "fund_transfer",
] as const;

export type CardType = (typeof CARD_TYPES)[number];

export type CardState = "idle" | "selected" | "confirmed" | "cancelled";

export interface QuickAction {
  icon: string;
  text: string;
}

export interface WelcomeCardPayload {
  greeting?: string;
  subtitle?: string;
  quickActions?: QuickAction[];
}

export interface AgentRecommendationItem {
  agentId: string;
  name: string;
  avatar: string;
  status: "online" | "offline";
  description: string;
  tags: string[];
  orders: string;
  completion: string;
  volume: string;
  lowestPrice: string;
  fundTransferRequired?: boolean;
}

export interface AgentRecommendationCardPayload {
  pretext?: string;
  footer?: string;
  agents: AgentRecommendationItem[];
  selectedAgentId?: string;
}

export interface BscAgentRecommendationItem {
  agentId: string;
  name: string;
  avatar: string;
  description: string;
  tags: string[];
  protocols: string[];
  capabilitySummary: string[];
  score: number;
  feedbackCount: number;
  paymentCount: number;
  totalRevenueMicroUsd: number;
  externalUrl: string;
  recommendationReason: string;
}

export interface BscAgentRecommendationCardPayload {
  pretext?: string;
  footer?: string;
  agents: BscAgentRecommendationItem[];
}

export interface ServiceItem {
  serviceId: string;
  name: string;
  description: string;
  price: string;
  sla: string;
  fundTransferRequired?: boolean;
}

export interface ServiceListCardPayload {
  pretext?: string;
  footer?: string;
  agentId: string;
  agentName: string;
  services: ServiceItem[];
  selectedServiceId?: string;
}

export type SchemaFieldType =
  | "string"
  | "url"
  | "address"
  | "number"
  | "bool"
  | "object"
  | "array";

export interface SchemaField {
  key: string;
  label: string;
  type: SchemaFieldType;
  required: boolean;
  placeholder?: string;
  description?: string;
}

export interface SchemaFormCardPayload {
  pretext?: string;
  agentId: string;
  agentName: string;
  serviceId: string;
  serviceName: string;
  fields: SchemaField[];
  price: string;
  gas: string;
  total: string;
  balance?: string;
  negotiationId?: string;
  requirements?: Record<string, unknown>;
}

export interface OrderSuccessCardPayload {
  orderId?: string | null;
  negotiationId?: string;
  agentName: string;
  status: string;
  note?: string;
}

export type FundTransferFeeMode = "flat" | "percentage";

export interface FundTransferCardPayload {
  pretext?: string;
  agentId: string;
  agentName: string;
  serviceId: string;
  serviceName: string;
  fields?: SchemaField[];
  principalAmount: string;
  principalToken: string;
  principalUsdcEquivalent: string;
  serviceFeeMode: FundTransferFeeMode;
  serviceFeeValue: string;
  serviceFeeAmountUsdc: string;
  gasEstimateUsdc: string;
  totalUsdc: string;
  balance?: string;
}

export type OrderRefStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "failed"
  | "expired";

export interface OrderRef {
  orderId: string;
  agentName: string;
  serviceName: string;
  priceUsdc: string;
  status: OrderRefStatus;
  createdAt: string;
}

export interface OrderListCardPayload {
  pretext?: string;
  footer?: string;
  orders: OrderRef[];
  selectedOrderId?: string;
}

export interface CapStep {
  txHash?: string;
  ts?: string;
  amountUsdc?: string;
  priceUsdc?: string;
  gasUsdc?: string;
}

export interface CapTimeline {
  lock?: CapStep;
  deliver?: CapStep;
  clear?: CapStep;
}

export interface OrderDetailCardPayload {
  pretext?: string;
  footer?: string;
  orderId: string;
  agentName: string;
  serviceName: string;
  status: string;
  capTimeline: CapTimeline;
  requirements?: Record<string, unknown>;
}

export type CardPayloadMap = {
  welcome: WelcomeCardPayload;
  agent_recommendation: AgentRecommendationCardPayload;
  bsc_agent_recommendation: BscAgentRecommendationCardPayload;
  service_list: ServiceListCardPayload;
  schema_form: SchemaFormCardPayload;
  order_success: OrderSuccessCardPayload;
  order_list: OrderListCardPayload;
  order_detail: OrderDetailCardPayload;
  fund_transfer: FundTransferCardPayload;
};

export interface CardPayload<T extends CardType = CardType> {
  cardId: string;
  cardType: T;
  payload: CardPayloadMap[T];
  state?: CardState;
}

export interface UnknownCardPayload {
  cardId: string;
  cardType: string;
  payload: unknown;
  state?: CardState;
}

export interface ChatMessageMetadata {
  cards?: CardPayload[];
  [key: string]: unknown;
}

export interface ChatMessage {
  id: string;
  sequence: number;
  runId?: string;
  role: MessageRole;
  content: string;
  createdAt: string;
  metadata?: ChatMessageMetadata;
}

export interface ActiveRun {
  runId: string;
}

export interface SnapshotPage {
  sessionId: string;
  messages: ChatMessage[];
  hasMore: boolean;
  activeRun: ActiveRun | null;
}

export type InjectedContextType = "fab" | "hire" | "try_this" | "order_now";

export interface InjectedContext {
  type: InjectedContextType;
  agentId?: string;
  agentName?: string;
  serviceId?: string;
  serviceName?: string;
  walletAddress?: string;
}

export type SSEEventType =
  | "tool_start"
  | "tool_end"
  | "assistant_message"
  | "card"
  | "done"
  | "error";

export interface SSEEventEnvelope<T extends SSEEventType = SSEEventType> {
  id: string;
  runId: string;
  sequence: number;
  type: T;
  payload: SSEEventPayloadMap[T];
}

export interface ToolStartPayload {
  toolName: string;
  input?: unknown;
}

export interface ToolEndPayload {
  toolName: string;
  output?: unknown;
  error?: string;
}

export interface AssistantMessagePayload {
  messageId: string;
  content: string;
  delta?: boolean;
}

export interface CardEventPayload {
  messageId: string;
  card: CardPayload | UnknownCardPayload;
}

export interface DonePayload {
  messageId?: string;
}

export interface ErrorPayload {
  code?: string;
  message: string;
}

export type SSEEventPayloadMap = {
  tool_start: ToolStartPayload;
  tool_end: ToolEndPayload;
  assistant_message: AssistantMessagePayload;
  card: CardEventPayload;
  done: DonePayload;
  error: ErrorPayload;
};

export type SSEEvent =
  | SSEEventEnvelope<"tool_start">
  | SSEEventEnvelope<"tool_end">
  | SSEEventEnvelope<"assistant_message">
  | SSEEventEnvelope<"card">
  | SSEEventEnvelope<"done">
  | SSEEventEnvelope<"error">;
