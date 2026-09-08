"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import { FormProvider, useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import TopUpModal from "@/components/shared/TopUpModal";
import UsdcIcon from "@/components/shared/UsdcIcon";
import { getNegotiation, type StartOrderResult } from "@/lib/navigator/api";
import { startOrderWithReadiness } from "@/lib/navigator/startOrderWithReadiness";
import { isApiError } from "@/lib/http/errors";
import { useAuth } from "@/lib/auth";
import { useNavigator } from "@/lib/navigator-context";
import { useBalance } from "@/hooks/useBalance";
import { useWalletDeploy } from "@/hooks/useWalletDeploy";
import { ActionRow, CardHeader, CardShell } from "../primitives";
import {
  SchemaFieldRenderer,
  buildSchemaFor,
  defaultsFor,
  pruneOptionalEmpty,
  type FormShape,
} from "./SchemaFieldRenderer";
import type {
  CardPayload,
  CardState,
  ChatMessage,
  ChatMessageMetadata,
  OrderSuccessCardPayload,
  SchemaFormCardPayload,
} from "@/types/navigator";

export interface SchemaFormCardProps {
  payload: SchemaFormCardPayload;
  state?: CardState;
  /**
   * Optional override — when omitted, SchemaFormCard runs the v2
   * Confirm&Pay pipeline internally (balance check → startOrder →
   * OrderSuccess). The intermediate preview round-trip and on-chain
   * pay polling are gone (plan D-NAV-START); the AI service returns
   * once the negotiation is written and the backend pay coroutine
   * drives accept→pay→deliver.
   */
  onConfirm?: (values: Record<string, unknown>) => void;
  /** Called when the user clicks Cancel — interactCard('cancel') happens upstream */
  onCancel?: () => void;
  /** Disable both buttons while a submit is in-flight. */
  busy?: boolean;
  /**
   * External lock — set by ConversationView when this card belongs to a
   * historical assistant message. Folded into `isLocked`, so all
   * interactive controls (Confirm & Pay / Cancel) go disabled.
   */
  disabled?: boolean;
  /** Card ID + host message ID — used for locally appending alt/success cards */
  cardId?: string;
  messageId?: string;
  /**
   * Navigator wallet address — plumbed from ConversationView. The card renders
   * Top Up instead of Confirm & Pay whenever live balance < total, and wraps
   * the Top Up button in a TopUpModal targeted at this address.
   */
  walletAddress?: string;
}

function actionFromState(state?: CardState): "confirmed" | "cancelled" | undefined {
  if (state === "confirmed") return "confirmed";
  if (state === "cancelled") return "cancelled";
  return undefined;
}

/* ───────────────────────── local id helpers ─────────────────────────── */

function makeLocalId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/* ───────────────────────── numeric coercion ─────────────────────────── */

function toUsdcNumber(raw: string | undefined): number {
  if (!raw) return NaN;
  const n = Number(String(raw).replace(/^\$/, "").replace(/[, ]/g, ""));
  return Number.isFinite(n) ? n : NaN;
}

/* ───────────────────────── Component ────────────────────────────────── */

export function SchemaFormCard({
  payload,
  state,
  onConfirm,
  onCancel,
  busy,
  disabled,
  cardId,
  messageId,
  walletAddress,
}: SchemaFormCardProps) {
  const {
    fields,
    agentName,
    serviceId,
    serviceName,
    price,
    gas,
    total,
    balance,
    pretext,
    negotiationId,
    requirements: requirementsSnapshot,
  } = payload;

  const schema = useMemo(() => buildSchemaFor(fields), [fields]);
  const defaults = useMemo(() => defaultsFor(fields), [fields]);

  const form = useForm<FormShape>({
    // Cast: @hookform/resolvers v5.2 + zod v4.3 mismatch on the schema brand
    // version (resolver overload pins minor=0). Runtime resolver duck-types
    // and works fine for both v3 and v4 schemas.
    resolver: zodResolver(schema as never) as Resolver<FormShape>,
    defaultValues: defaults,
    mode: "onBlur",
  });

  const { balanceUsdc, refetch: refetchBalance } = useBalance();
  const { dispatch, messages } = useNavigator();
  const { session } = useAuth();
  const { deployWallet } = useWalletDeploy();

  // Local lifecycle state for the v2 Confirm&Pay pipeline.
  // `idle → checking_balance → starting → succeeded | start_failed`.
  // The insufficient-balance case is no longer a discrete phase: the
  // primary CTA renders as Top Up (wrapped in TopUpModal) whenever the
  // live wallet balance is below `total`. Confirming on a stale UI
  // re-verifies the balance and bounces back to `idle` if the user is
  // still short, so we never start an order we know would underfund the
  // pay coroutine.
  type Phase =
    | "idle"
    | "checking_balance"
    | "starting"
    | "succeeded"
    | "start_failed"
    | "user_cancelled";
  const [phase, setPhase] = useState<Phase>("idle");
  const [startError, setStartError] = useState<string | null>(null);
  // The payload-provided price/gas/total are the source of truth for the
  // breakdown; the BE preview round-trip is gone, so no live overrides
  // are needed any more.
  const livePrice = price;
  const liveGas = gas;
  const liveTotal = total;

  // Re-fire start after a failure uses the same form values.
  const [lastSubmittedValues, setLastSubmittedValues] = useState<
    Record<string, unknown> | null
  >(null);
  const abortRef = useRef<AbortController | null>(null);
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  // Messages ref so we can patch the host message metadata without
  // re-creating `runOrderPipeline` on every message-list update.
  const messagesRef = useRef<ChatMessage[]>(messages);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const stateAction = actionFromState(state);
  // Card considered locked from a state-machine perspective when
  // upstream marked it confirmed/cancelled, when an external busy
  // is set, OR when the pipeline is mid-flight (balance check or
  // start-order request).
  const pipelineBusy =
    phase === "checking_balance" || phase === "starting";
  // Locally-driven terminal action (so an in-component Cancel click doesn't
  // depend on an upstream reducer round-trip to show the "Cancelled" row).
  const localAction: "confirmed" | "cancelled" | undefined =
    phase === "succeeded"
      ? "confirmed"
      : phase === "user_cancelled"
        ? "cancelled"
        : undefined;
  const action = stateAction ?? localAction;
  const isLocked =
    action !== undefined
    || busy
    || disabled
    || pipelineBusy;

  // Live insufficient-balance check — pure derivation from `useBalance` +
  // payload `total`. When true, the primary CTA renders as Top Up instead
  // of Confirm & Pay; the moment a top-up lands, useBalance refetches and
  // this flips false on next render so the button switches back. No phase
  // state is needed for this — we never "lock" the form on shortfall; the
  // user keeps their requirement inputs intact across the top-up trip.
  const isInsufficient = useMemo(() => {
    const totalN = toUsdcNumber(liveTotal ?? total);
    const balanceN = toUsdcNumber(balanceUsdc ?? undefined);
    if (!Number.isFinite(totalN) || !Number.isFinite(balanceN)) return false;
    return balanceN < totalN;
  }, [balanceUsdc, liveTotal, total]);

  // After Confirm & Pay: rehydrate disabled inputs from the snapshot
  // baked into the persisted card payload. Requirements are immutable
  // post-order so the AI side writes them into payload.requirements at
  // confirm time — refreshes can use them directly with zero network.
  //
  // Fallback: pre-snapshot cards (orders created before the snapshot
  // landed) still have `negotiationId` but no `requirements`. For those
  // we keep the legacy proxy call (`GET /ai/negotiations/{id}`), gated
  // on `!disabled` so a snapshot reload doesn't thundering-herd the AI
  // service — only the live (most-recent) card fetches.
  const hasSnapshot = Boolean(
    requirementsSnapshot && Object.keys(requirementsSnapshot).length > 0,
  );
  const negotiationQuery = useQuery({
    queryKey: ["navigator", "negotiation", negotiationId],
    queryFn: ({ signal }) => getNegotiation(negotiationId as string, { signal }),
    enabled:
      action === "confirmed"
      && Boolean(negotiationId)
      && !disabled
      && !hasSnapshot,
    staleTime: Infinity,
  });

  useEffect(() => {
    if (action !== "confirmed") return;
    // Prefer the inline snapshot — no fetch, no flicker.
    if (hasSnapshot) {
      form.reset({ ...defaults, ...(requirementsSnapshot as Record<string, unknown>) });
      return;
    }
    const data = negotiationQuery.data?.requirements;
    if (data && Object.keys(data).length > 0) {
      form.reset({ ...defaults, ...data });
    }
  }, [
    action,
    hasSnapshot,
    requirementsSnapshot,
    negotiationQuery.data,
    defaults,
    form,
  ]);

  /* ───────── local card synthesis helpers ───────── */

  const appendCardToHostMessage = useCallback(
    (card: CardPayload) => {
      if (!messageId) {
        // Fallback: emit a fresh assistant message with just this card.
        dispatch({
          type: "append_message",
          message: {
            id: makeLocalId("local"),
            sequence: Date.now(),
            role: "assistant",
            content: "",
            createdAt: new Date().toISOString(),
            metadata: { cards: [card] },
          },
        });
        return;
      }
      const host = messagesRef.current.find((m) => m.id === messageId);
      const existingCards = host?.metadata?.cards ?? [];
      // Avoid double-appends if Retry fires twice for the same cardId.
      if (existingCards.some((c) => c.cardId === card.cardId)) return;
      const nextMetadata: ChatMessageMetadata = {
        ...(host?.metadata ?? {}),
        cards: [...existingCards, card],
      };
      dispatch({
        type: "update_message",
        id: messageId,
        patch: { metadata: nextMetadata },
      });
    },
    [dispatch, messageId],
  );

  /* ───────── pipeline runner ───────── */

  // Plan D-NAV-START / C2: front-end is now the *only* balance pre-check
  // (backend `ConfirmOrderForUser` is gone, so the AI start endpoint
  // doesn't ladder a quote either). We refetch the wallet balance and
  // compare it to the payload's `total`. If the user is still short, we
  // revert to `idle` so the CTA renders as Top Up — keeping their filled
  // form intact. Otherwise we call `startOrderWithReadiness` (which
  // internally handles 409 navigator_not_ready: wallet+agent_creating →
  // deployWallet, otherwise poll-only; both branches wait ≤ 90s for
  // navigator to become active, then retry once).
  const runOrderPipeline = useCallback(
    async (values: Record<string, unknown>) => {
      setStartError(null);

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      // 1) Refetch latest balance and do FE pre-check BEFORE start.
      //    Backend no longer carries a balance pre-check; this is the
      //    sole fast-fail gate before the negotiation/pay coroutine.
      setPhase("checking_balance");
      let latestBalance: string | null = balanceUsdc;
      try {
        latestBalance = await refetchBalance();
      } catch {
        // Non-fatal — fall through to whatever the hook last reported.
      }
      if (controller.signal.aborted) return;

      const preCheckTotal = liveTotal ?? total;
      const preCheckTotalN = toUsdcNumber(preCheckTotal);
      const preCheckBalanceN = toUsdcNumber(latestBalance ?? undefined);
      if (
        Number.isFinite(preCheckTotalN)
        && Number.isFinite(preCheckBalanceN)
        && preCheckBalanceN < preCheckTotalN
      ) {
        // Balance is still short after refetch — revert to idle so the
        // CTA flips back to Top Up. Do NOT call startOrder; we'd otherwise
        // create a negotiation the pay coroutine would never be able to
        // fund. The user's filled form values stay intact across this.
        setPhase("idle");
        setStartError("Balance is still insufficient. Please top up first.");
        return;
      }

      // 2) Start order with built-in 409 navigator_not_ready recovery.
      //    See `startOrderWithReadiness` for the deploy + 90s poll + retry
      //    contract. The orchestrator's (user_id, idempotency_key) SETNX
      //    keeps the retry idempotent.
      setPhase("starting");
      const idempotencyKey =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

      let result: StartOrderResult;
      try {
        result = await startOrderWithReadiness(
          {
            serviceId,
            requirements: pruneOptionalEmpty(values, fields),
            idempotencyKey,
            cardId,
          },
          {
            loginMethod: session?.loginMethod,
            deployWallet,
            signal: controller.signal,
            // Intentionally no onUserMessage handler — the spinning
            // Confirm & Pay button is the sole "working" indicator;
            // inline status copy was redundant and tended to linger.
          },
        );
      } catch (err) {
        if (controller.signal.aborted) return;
        setPhase("start_failed");
        setStartError(
          isApiError(err)
            ? err.message
              || "Navigator agent is still preparing. Please try again shortly."
            : err instanceof Error
              ? err.message
              : "Failed to start the order. Please try again.",
        );
        return;
      }

      // 3) start returned 200 → AI service has written the negotiation
      //    and kicked off the background pay coroutine. Emit success
      //    immediately; the user tracks accept→pay→deliver on the orders
      //    page. AI side will mirror the success card into the persisted
      //    conversation when `cardId` is passed, so a refresh recovers
      //    the same UI state.
      //
      // NOTE: `result.orderId` is intentionally `null` at this moment —
      // the on-chain createOrder hasn't run yet. We pass `negotiationId`
      // into the success card so it can poll the AI service for the real
      // order_id and ONLY surface it once it materializes. We MUST NOT
      // smuggle `negotiationId` into the `orderId` field as a fallback
      // — that misled users into thinking the negotiation id was their
      // order id (the hotfix this commit addresses).
      setPhase("succeeded");
      const successPayload: OrderSuccessCardPayload = {
        orderId: result.orderId,
        negotiationId: result.negotiationId,
        agentName,
        status: "pending",
        note: "Order created — track payment and delivery on your orders page.",
      };
      const card: CardPayload<"order_success"> = {
        cardId: makeLocalId("card"),
        cardType: "order_success",
        payload: successPayload,
      };
      appendCardToHostMessage(card);
    },
    [
      serviceId,
      cardId,
      fields,
      total,
      liveTotal,
      balanceUsdc,
      refetchBalance,
      agentName,
      appendCardToHostMessage,
      session?.loginMethod,
      deployWallet,
    ],
  );

  const handleFormSubmit = useCallback(
    (values: Record<string, unknown>) => {
      if (isLocked) return;
      setLastSubmittedValues(values);
      if (onConfirm) {
        // Backwards-compatible escape hatch: tests / other callers can still
        // intercept the form values before the network pipeline runs.
        onConfirm(values);
        return;
      }
      void runOrderPipeline(values);
    },
    [isLocked, onConfirm, runOrderPipeline],
  );

  // `react-hooks/refs` flags any callback that transitively reads refs
  // when passed to a render-time function. `handleFormSubmit` only fires
  // on user click (form submission), so the ref access is safe.
  // eslint-disable-next-line react-hooks/refs
  const handleSubmit = form.handleSubmit(handleFormSubmit);

  const handleRetryStart = useCallback(() => {
    if (!lastSubmittedValues) return;
    void runOrderPipeline(lastSubmittedValues);
  }, [lastSubmittedValues, runOrderPipeline]);

  const handleCancelStart = () => {
    setPhase("idle");
    setStartError(null);
    onCancel?.();
  };

  const handleUserCancel = useCallback(() => {
    if (isLocked) return;
    abortRef.current?.abort();
    setPhase("user_cancelled");
    setStartError(null);
    onCancel?.();
  }, [isLocked, onCancel]);

  /* ───────────────────────── render ───────────────────────── */

  // Visual lock only for historical (disabled) cards. Insufficient-balance
  // no longer dims the shell — the form must stay editable so the user's
  // filled values survive the top-up round-trip.
  const shellClassName = disabled
    ? "opacity-60 pointer-events-none select-none"
    : "";

  return (
    <div data-card-kind="schema_form" className="space-y-2 w-full">
      {pretext && (
        <p className="text-xs text-[#6B6B6B] leading-relaxed">{pretext}</p>
      )}
      <CardShell className={shellClassName}>
        <CardHeader>
          <p className="text-xs font-semibold text-[#0F0F0F]">Order Details</p>
          <p className="text-[10px] text-[#9A9A9A] mt-0.5">
            {agentName} · {serviceName}
          </p>
        </CardHeader>

        <FormProvider {...form}>
          <form onSubmit={handleSubmit} noValidate>
            <fieldset
              disabled={isLocked}
              className="contents"
              aria-disabled={isLocked || undefined}
            >
              <div className="px-4 py-3 space-y-3.5">
                {fields.map((field) => (
                  <SchemaFieldRenderer key={field.key} field={field} />
                ))}
              </div>

              <div className="px-4 py-3 border-t border-[#E2E2E0] space-y-1.5">
                {[
                  { label: "Price", value: livePrice ?? price },
                  { label: "Estimated Gas", value: liveGas ?? gas },
                ].map((r) => (
                  <div key={r.label} className="flex justify-between text-xs">
                    <span className="text-[#9A9A9A]">{r.label}</span>
                    <span className="text-[#3A3A3A]">{r.value}</span>
                  </div>
                ))}
                <div className="flex justify-between text-xs font-semibold pt-1 border-t border-[#F0F0EE]">
                  <span className="text-[#0F0F0F]">Total</span>
                  <span className="text-[#0F0F0F]">{liveTotal ?? total}</span>
                </div>
              </div>

              <div className="px-4 py-2.5 border-t border-[#E2E2E0] bg-[#FAFAF9] flex items-center justify-between gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-[#6B6B6B]">Balance</span>
                  {balanceUsdc != null ? (
                    <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-[#0F0F0F]">
                      <UsdcIcon size={11} />
                      {String(balanceUsdc).replace(/^\$/, "")}
                    </span>
                  ) : balance ? (
                    <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-[#0F0F0F]">
                      <UsdcIcon size={11} />
                      {balance.replace(/^\$/, "")}
                    </span>
                  ) : (
                    <span className="text-xs text-[#9A9A9A]">—</span>
                  )}
                </div>
              </div>

              {/* Start-order failure recovery row — Retry / Cancel inline.
                  Covers both transient errors (network / 5xx) and the
                  post-retry 409 path (`navigator_not_ready` family). */}
              {phase === "start_failed" && (
                <div className="px-4 py-3 border-t border-[#E2E2E0] space-y-2 bg-[#FFF4F2]">
                  <p className="text-[11px] text-red-500 leading-snug">
                    {startError ?? "Failed to create the order. Please retry."}
                  </p>
                  <div className="flex gap-2 justify-end">
                    <button
                      type="button"
                      onClick={handleCancelStart}
                      className="px-4 py-2 text-xs font-medium text-[#6B6B6B] border border-[#E2E2E0] rounded-lg hover:bg-[#F5F5F3] transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleRetryStart}
                      className="px-4 py-2 text-xs font-medium text-white bg-[#0F0F0F] rounded-lg hover:bg-[#1A1A1A] transition-colors"
                    >
                      Retry
                    </button>
                  </div>
                </div>
              )}

              {phase !== "start_failed" && (
                <>
                  {pipelineBusy ? (
                    <div className="px-4 py-3 border-t border-[#E2E2E0] flex gap-2 justify-end">
                      <button
                        type="button"
                        disabled
                        aria-disabled
                        className="px-4 py-2 text-xs font-medium text-[#9A9A9A] border border-[#E2E2E0] rounded-lg cursor-not-allowed"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled
                        aria-disabled
                        aria-busy
                        className="px-4 py-2 text-xs font-medium text-white bg-[#1A1A1A] rounded-lg cursor-not-allowed opacity-80"
                      >
                        Processing…
                      </button>
                    </div>
                  ) : action === undefined && isInsufficient ? (
                    /* Balance < total → swap Confirm & Pay for Top Up. The
                       button is wrapped in TopUpModal which invalidates the
                       balance query on close/confirm — useBalance refetches
                       and `isInsufficient` flips back to false, restoring
                       the Confirm & Pay button without remounting the form. */
                    <div className="px-4 py-3 border-t border-[#E2E2E0] flex gap-2 justify-end">
                      <button
                        type="button"
                        onClick={handleUserCancel}
                        className="px-4 py-2 text-xs font-medium text-[#6B6B6B] border border-[#E2E2E0] rounded-lg hover:bg-[#F5F5F3] transition-colors"
                      >
                        Cancel
                      </button>
                      <TopUpModal
                        walletLabel="Navigator Wallet"
                        walletAddress={walletAddress ?? ""}
                      >
                        <button
                          type="button"
                          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-[#0F0F0F] rounded-lg hover:bg-[#1A1A1A] transition-colors cursor-pointer"
                        >
                          Top Up
                          <ArrowRight className="h-3 w-3" />
                        </button>
                      </TopUpModal>
                    </div>
                  ) : (
                    <ActionRow
                      action={action}
                      onConfirm={
                        action === undefined
                          ? () => {
                              void handleSubmit();
                            }
                          : undefined
                      }
                      onCancel={
                        action === undefined ? handleUserCancel : undefined
                      }
                    />
                  )}
                </>
              )}
            </fieldset>
          </form>
        </FormProvider>
      </CardShell>
    </div>
  );
}
