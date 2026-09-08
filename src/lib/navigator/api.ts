/**
 * Navigator V2 API Client
 *
 * Wraps the full set of `/ai/*` endpoints; every call goes through
 * `authedRequest`, which injects the Bearer token.
 * Responses use snake_case (Python convention) and are normalized at the
 * boundary into the camelCase contract (see `@/types/navigator`). Request
 * bodies are likewise sent in snake_case.
 */

import { authedRequest } from "@/lib/http/client";
import type {
  ActiveRun,
  CardPayload,
  CardState,
  ChatMessage,
  InjectedContext,
  SnapshotPage,
  UnknownCardPayload,
} from "@/types/navigator";
import type { ChainId } from "@/lib/chains";

/* ───────────────────────── Raw response shapes ─────────────────────────── */

interface RawSessionResponse {
  session_id?: string;
  sessionId?: string;
  mode?: ChainId;
}

interface RawActiveRun {
  run_id?: string;
  runId?: string;
}

interface RawCard {
  card_id?: string;
  cardId?: string;
  card_type?: string;
  cardType?: string;
  payload?: unknown;
  state?: CardState;
}

interface RawMessage {
  id: string;
  sequence?: number;
  run_id?: string | null;
  runId?: string | null;
  role: ChatMessage["role"];
  content: string;
  created_at?: string;
  createdAt?: string;
  metadata?: {
    cards?: RawCard[];
    [key: string]: unknown;
  } | null;
}

interface RawSnapshotResponse {
  session_id?: string;
  sessionId?: string;
  messages: RawMessage[];
  has_more?: boolean;
  hasMore?: boolean;
  active_run?: RawActiveRun | null;
  activeRun?: RawActiveRun | null;
}

interface RawChatResponse {
  run_id?: string;
  runId?: string;
}

interface RawInteractResponse {
  ok: boolean;
  state?: CardState;
  run_id?: string | null;
  runId?: string | null;
  appended_messages?: RawMessage[] | null;
  appendedMessages?: RawMessage[] | null;
}

/**
 * Result of `POST /ai/navigator/order/start`.
 *
 * The new flow returns immediately once the AI service has written a
 * negotiation in Backend; `order_id` is intentionally `null` because
 * the on-chain createOrder + pay are driven by a background pay coroutine
 * (see plan D-NAV-START decision). Front-end emits the
 * OrderSuccessCard right away and lets the user track the rest from
 * `/account/orders`.
 */
export interface StartOrderResult {
  negotiationId: string;
  /** Always `null` in the v2 start flow — see plan G1. */
  orderId: string | null;
  status: "pending";
  /** ISO 8601 timestamp from the AI service. */
  createdAt: string;
}

interface RawStartOrderResponse {
  negotiation_id?: string;
  negotiationId?: string;
  order_id?: string | null;
  orderId?: string | null;
  status?: string;
  created_at?: string;
  createdAt?: string;
}

export interface OrderStatusResult {
  status: string;
  capTimeline?: unknown;
}

interface RawStatusResponse {
  status: string;
  cap_timeline?: unknown;
  capTimeline?: unknown;
}

/* ───────────────────────── Normalizers ─────────────────────────────────── */

function normalizeCard(raw: RawCard): CardPayload | UnknownCardPayload {
  const cardId = raw.card_id ?? raw.cardId ?? "";
  const cardType = raw.card_type ?? raw.cardType ?? "";
  return {
    cardId,
    cardType,
    payload: raw.payload,
    state: raw.state,
  } as CardPayload | UnknownCardPayload;
}

function normalizeMessage(raw: RawMessage): ChatMessage {
  const cards = raw.metadata?.cards?.map(normalizeCard);
  return {
    id: raw.id,
    sequence: typeof raw.sequence === "number" ? raw.sequence : 0,
    runId: raw.run_id ?? raw.runId ?? undefined,
    role: raw.role,
    content: raw.content,
    createdAt: raw.created_at ?? raw.createdAt ?? new Date().toISOString(),
    metadata: raw.metadata
      ? {
          ...raw.metadata,
          cards: cards as CardPayload[] | undefined,
        }
      : undefined,
  };
}

function normalizeActiveRun(raw: RawActiveRun | null | undefined): ActiveRun | null {
  if (!raw) return null;
  const runId = raw.run_id ?? raw.runId;
  if (!runId) return null;
  return { runId };
}

/* ───────────────────────── API surface ─────────────────────────────────── */

export interface NavigatorSessionResult {
  sessionId: string;
  mode: ChainId;
}

export interface WalletBalanceResult {
  /** Spendable USDC balance (string per FE Decimal-as-string convention) */
  balanceUsdc: string;
  /** Locked-in-escrow USDC, complementary to balanceUsdc */
  escrowUsdc: string;
  /** True when AI service served from its 30s TTL cache (or stale 5xx fallback) */
  cached: boolean;
  /** ISO timestamp when the underlying balance was last fetched from BE */
  updatedAt?: string;
}

interface RawWalletBalanceResponse {
  balance_usdc?: string;
  balanceUsdc?: string;
  escrow_usdc?: string;
  escrowUsdc?: string;
  cached?: boolean;
  updated_at?: string;
  updatedAt?: string;
}

export async function getWalletBalance(
  options?: { signal?: AbortSignal },
): Promise<WalletBalanceResult> {
  const raw = await authedRequest<RawWalletBalanceResponse>(
    "/ai/navigator/wallet/balance",
    { signal: options?.signal },
  );
  return {
    balanceUsdc: raw.balance_usdc ?? raw.balanceUsdc ?? "0",
    escrowUsdc: raw.escrow_usdc ?? raw.escrowUsdc ?? "0",
    cached: Boolean(raw.cached),
    updatedAt: raw.updated_at ?? raw.updatedAt,
  };
}

export async function getNavigatorSession(
  mode: ChainId = "base",
  options?: { signal?: AbortSignal },
): Promise<NavigatorSessionResult> {
  const raw = await authedRequest<RawSessionResponse>(
    `/ai/me/navigator-session?mode=${encodeURIComponent(mode)}`,
    { signal: options?.signal },
  );
  const sessionId = raw.session_id ?? raw.sessionId;
  if (!sessionId) {
    throw new Error("Navigator session response missing session_id");
  }
  return { sessionId, mode: raw.mode ?? mode };
}

export interface GetSnapshotOptions {
  /** Page size, 1-100 (defaults to backend default of 20). */
  limit?: number;
  /**
   * Cursor for waterfall pagination: returns the latest `limit` messages
   * whose `sequence < beforeSequence`. Omit for the first (most recent) page.
   * Pass `messages[0].sequence` of the currently earliest page to fetch older
   * history.
   */
  beforeSequence?: number;
  signal?: AbortSignal;
}

/**
 * `GET /ai/conversations/{id}/snapshot?limit=&before_sequence=` — cursor-based
 * waterfall pagination over the persisted message history. Messages within
 * a page are ASC by `sequence` (oldest → newest); page-of-pages order is
 * decided by the caller (typically: first page is the newest).
 *
 * `activeRun` is only populated on the first page (`beforeSequence` omitted);
 * older pages always return `activeRun: null` because the field describes
 * "current session state", not the historical slice being paged in.
 */
export async function getSnapshot(
  sessionId: string,
  options?: GetSnapshotOptions,
): Promise<SnapshotPage> {
  const query = new URLSearchParams();
  if (typeof options?.limit === "number") {
    query.set("limit", String(options.limit));
  }
  if (typeof options?.beforeSequence === "number") {
    query.set("before_sequence", String(options.beforeSequence));
  }
  const qs = query.toString();
  const path =
    `/ai/conversations/${encodeURIComponent(sessionId)}/snapshot`
    + (qs ? `?${qs}` : "");
  const raw = await authedRequest<RawSnapshotResponse>(path, {
    signal: options?.signal,
  });
  return {
    sessionId: raw.session_id ?? raw.sessionId ?? sessionId,
    messages: (raw.messages ?? []).map(normalizeMessage),
    hasMore: Boolean(raw.has_more ?? raw.hasMore ?? false),
    activeRun: normalizeActiveRun(raw.active_run ?? raw.activeRun ?? null),
  };
}

export interface PostChatResult {
  runId: string;
}

export async function postChat(
  sessionId: string,
  message: string,
  options?: { signal?: AbortSignal },
): Promise<PostChatResult> {
  const raw = await authedRequest<RawChatResponse>("/ai/chat", {
    method: "POST",
    body: {
      session_id: sessionId,
      message,
    },
    signal: options?.signal,
  });
  const runId = raw.run_id ?? raw.runId;
  if (!runId) {
    throw new Error("Chat response missing run_id");
  }
  return { runId };
}

export interface InteractCardResult {
  ok: boolean;
  state?: CardState;
  /** Set when the interaction triggered a follow-up LLM run on the AI side. */
  runId?: string;
  /**
   * Newly persisted messages returned inline on the deterministic shortcut
   * path (`service_list` SELECT → `schema_form`). FE appends these directly
   * to local state, skipping a snapshot refetch. Absent on LLM-run paths
   * (where the new message arrives via SSE + snapshot) and on CANCEL.
   */
  appendedMessages?: ChatMessage[];
}

export async function interactCard(
  cardId: string,
  action: string,
  payload?: Record<string, unknown>,
  options?: { signal?: AbortSignal },
): Promise<InteractCardResult> {
  const raw = await authedRequest<RawInteractResponse>(
    `/ai/cards/${encodeURIComponent(cardId)}/interact`,
    {
      method: "POST",
      body: {
        action,
        payload: payload ?? {},
      },
      signal: options?.signal,
    },
  );
  const runId = raw.run_id ?? raw.runId ?? undefined;
  const rawAppended = raw.appended_messages ?? raw.appendedMessages ?? null;
  const appendedMessages = rawAppended
    ? rawAppended.map(normalizeMessage)
    : undefined;
  return {
    ok: raw.ok,
    state: raw.state,
    runId: runId ?? undefined,
    appendedMessages,
  };
}

export interface StartOrderInput {
  serviceId: string;
  requirements: Record<string, unknown>;
  idempotencyKey: string;
  cardId?: string;
  fundAmount?: string;
  fundToken?: string;
}

export async function startOrder(
  input: StartOrderInput,
  options?: { signal?: AbortSignal },
): Promise<StartOrderResult> {
  const body: Record<string, unknown> = {
    service_id: input.serviceId,
    requirements: input.requirements ?? {},
    idempotency_key: input.idempotencyKey,
  };
  if (input.cardId) {
    body.card_id = input.cardId;
  }
  if (input.fundAmount) {
    body.fund_amount = input.fundAmount;
  }
  if (input.fundToken) {
    body.fund_token = input.fundToken;
  }
  const raw = await authedRequest<RawStartOrderResponse>(
    "/ai/navigator/order/start",
    {
      method: "POST",
      body,
      signal: options?.signal,
    },
  );
  const negotiationId = raw.negotiation_id ?? raw.negotiationId;
  if (!negotiationId) {
    throw new Error("Start-order response missing negotiation_id");
  }
  return {
    negotiationId,
    orderId: raw.order_id ?? raw.orderId ?? null,
    status: "pending",
    createdAt: raw.created_at ?? raw.createdAt ?? new Date().toISOString(),
  };
}

export interface NegotiationRequirementsResult {
  requirements: Record<string, unknown>;
}

interface RawNegotiationProxyResponse {
  requirements?: Record<string, unknown> | null;
}

export async function getNegotiation(
  negotiationId: string,
  options?: { signal?: AbortSignal },
): Promise<NegotiationRequirementsResult> {
  const raw = await authedRequest<RawNegotiationProxyResponse>(
    `/ai/negotiations/${encodeURIComponent(negotiationId)}`,
    { signal: options?.signal },
  );
  const requirements = raw.requirements;
  if (
    requirements
    && typeof requirements === "object"
    && !Array.isArray(requirements)
  ) {
    return { requirements };
  }
  return { requirements: {} };
}

export async function pollOrderStatus(
  orderId: string,
  options?: { signal?: AbortSignal },
): Promise<OrderStatusResult> {
  const raw = await authedRequest<RawStatusResponse>(
    `/ai/orders/${encodeURIComponent(orderId)}/status`,
    { signal: options?.signal },
  );
  return {
    status: raw.status,
    capTimeline: raw.cap_timeline ?? raw.capTimeline,
  };
}

export interface NegotiationOrderResult {
  negotiationId: string;
  orderId: string | null;
  agentName: string | null;
  status: string | null;
}

interface RawNegotiationOrderResponse {
  negotiation_id?: string;
  negotiationId?: string;
  order_id?: string | null;
  orderId?: string | null;
  agent_name?: string | null;
  agentName?: string | null;
  status?: string | null;
}

export async function getOrderIdByNegotiation(
  negotiationId: string,
  options?: { signal?: AbortSignal },
): Promise<NegotiationOrderResult> {
  const raw = await authedRequest<RawNegotiationOrderResponse>(
    `/ai/navigator/negotiations/${encodeURIComponent(negotiationId)}/order`,
    { signal: options?.signal },
  );
  return {
    negotiationId: raw.negotiation_id ?? raw.negotiationId ?? negotiationId,
    orderId: raw.order_id ?? raw.orderId ?? null,
    agentName: raw.agent_name ?? raw.agentName ?? null,
    status: raw.status ?? null,
  };
}

export interface PostContextResult {
  ok: boolean;
  sessionId?: string;
  pinnedFacts?: Record<string, unknown>;
  runId?: string;
}

interface RawPostContextResponse {
  ok: boolean;
  session_id?: string;
  sessionId?: string;
  pinned_facts?: Record<string, unknown>;
  pinnedFacts?: Record<string, unknown>;
  run_id?: string;
  runId?: string;
}

export async function postContext(
  ctx: InjectedContext,
  options?: { signal?: AbortSignal },
): Promise<PostContextResult> {
  const raw = await authedRequest<RawPostContextResponse>(
    "/ai/navigator/context",
    {
      method: "POST",
      body: {
        type: ctx.type,
        agent_id: ctx.agentId,
        agent_name: ctx.agentName,
        service_id: ctx.serviceId,
        service_name: ctx.serviceName,
        wallet_address: ctx.walletAddress,
      },
      signal: options?.signal,
    },
  );
  return {
    ok: Boolean(raw?.ok),
    sessionId: raw?.session_id ?? raw?.sessionId,
    pinnedFacts: raw?.pinned_facts ?? raw?.pinnedFacts,
    runId: raw?.run_id ?? raw?.runId,
  };
}
