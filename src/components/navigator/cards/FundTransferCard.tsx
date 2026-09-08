"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import { FormProvider, useForm, useWatch, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import TopUpModal from "@/components/shared/TopUpModal";
import UsdcIcon from "@/components/shared/UsdcIcon";
import { type StartOrderResult } from "@/lib/navigator/api";
import { startOrderWithReadiness } from "@/lib/navigator/startOrderWithReadiness";
import { isApiError } from "@/lib/http/errors";
import { useNavigator } from "@/lib/navigator-context";
import { useAuth } from "@/lib/auth";
import { useBalance } from "@/hooks/useBalance";
import { useWalletDeploy } from "@/hooks/useWalletDeploy";
import { BASE_MAINNET_USDC } from "@/lib/agent-service-payload";
import { usdcMicroFromUsd } from "@/lib/currency";
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
  FundTransferCardPayload,
  OrderSuccessCardPayload,
  SchemaField,
} from "@/types/navigator";

export interface FundTransferCardProps {
  payload: FundTransferCardPayload;
  state?: CardState;
  /** Called when the user clicks Cancel — interactCard('cancel') happens upstream */
  onCancel?: () => void;
  /** Disable buttons while a submit is in-flight */
  busy?: boolean;
  /**
   * External lock — set by ConversationView when this card belongs to a
   * historical assistant message. Folded into `isLocked`, so Confirm &
   * Pay / Cancel become unclickable.
   */
  disabled?: boolean;
  /** Card ID + host message ID — used for locally appending success card */
  cardId?: string;
  messageId?: string;
  /**
   * Navigator AA wallet address — forwarded by ConversationView via
   * CardRenderer. Used to anchor the in-card TopUpModal when the live
   * `balanceUsdc < total` shortfall flips the primary CTA from
   * "Confirm & Pay" to "Top Up". Same plumbing as SchemaFormCard.
   */
  walletAddress?: string;
}

function actionFromState(state?: CardState): "confirmed" | "cancelled" | undefined {
  if (state === "confirmed") return "confirmed";
  if (state === "cancelled") return "cancelled";
  return undefined;
}

function makeLocalId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function toUsdcNumber(raw: string | number | undefined | null): number {
  if (raw === undefined || raw === null) return NaN;
  const n = Number(String(raw).replace(/^\$/, "").replace(/[, ]/g, ""));
  return Number.isFinite(n) ? n : NaN;
}

function formatUsdc(value: number, fallback = "—"): string {
  if (!Number.isFinite(value)) return fallback;
  return `$${value.toFixed(2)}`;
}

/**
 * Heuristic: pick the principal field from the schema fields.
 *
 * The AI side (`_build_fund_transfer_artifact`) reuses the schema_form
 * field parser as-is, so the principal lives among the same `fields`
 * array as any other requirement. We match common naming conventions
 * (`principal_amount`, `principalAmount`, `amount`, `principal`) and fall
 * back to the first numeric field so a typo in the BE config doesn't
 * silently break the live breakdown.
 */
const PRINCIPAL_KEY_CANDIDATES = [
  "principal_amount",
  "principalAmount",
  "principal",
  "amount",
];

function findPrincipalKey(fields: SchemaField[]): string | undefined {
  for (const key of PRINCIPAL_KEY_CANDIDATES) {
    if (fields.some((f) => f.key === key)) return key;
  }
  const firstNumber = fields.find((f) => f.type === "number");
  return firstNumber?.key;
}

export function FundTransferCard({
  payload,
  state,
  onCancel,
  busy,
  disabled,
  cardId,
  messageId,
  walletAddress,
}: FundTransferCardProps) {
  const {
    pretext,
    agentName,
    serviceId,
    serviceName,
    fields = [],
    principalAmount,
    principalToken,
    principalUsdcEquivalent,
    serviceFeeMode,
    serviceFeeValue,
    serviceFeeAmountUsdc,
    gasEstimateUsdc,
    totalUsdc,
    balance,
  } = payload;

  const schema = useMemo(() => buildSchemaFor(fields), [fields]);
  const defaults = useMemo(() => {
    const base = defaultsFor(fields);
    const principalKey = findPrincipalKey(fields);
    if (principalKey && principalAmount) {
      base[principalKey] = principalAmount;
    }
    return base;
  }, [fields, principalAmount]);

  const form = useForm<FormShape>({
    resolver: zodResolver(schema as never) as Resolver<FormShape>,
    defaultValues: defaults,
    mode: "onBlur",
  });

  const principalKey = useMemo(() => findPrincipalKey(fields), [fields]);
  // Watch principal so the 4-row breakdown recomputes live for percentage
  // fee mode. When the field is absent we fall back to the payload value.
  const watchedPrincipal = useWatch({
    control: form.control,
    name: principalKey ?? "__none__",
    defaultValue: principalAmount ?? "",
  });

  const { balanceUsdc, refetch: refetchBalance } = useBalance();
  const { dispatch, messages } = useNavigator();
  const { session } = useAuth();
  const { deployWallet } = useWalletDeploy();

  // Plan C3 mirrors SchemaFormCard's v2 phase names. Fund-transfer
  // flows reuse the same `checking_balance → starting` pipeline so we
  // can refuse to negotiate orders the requester can't fund — the
  // resulting batch UserOp would either revert (USDC balance < total)
  // or, worse, leave the negotiation locked while the user scrambles
  // to top up. The insufficient-balance case is *not* a phase: we
  // render a TopUp CTA whenever live `balanceUsdc < total`.
  type Phase =
    | "idle"
    | "checking_balance"
    | "starting"
    | "succeeded"
    | "start_failed"
    | "user_cancelled";
  const [phase, setPhase] = useState<Phase>("idle");
  const [startError, setStartError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  useEffect(() => () => abortRef.current?.abort(), []);

  const messagesRef = useRef<ChatMessage[]>(messages);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const stateAction = actionFromState(state);
  const localAction: "confirmed" | "cancelled" | undefined =
    phase === "succeeded"
      ? "confirmed"
      : phase === "user_cancelled"
        ? "cancelled"
        : undefined;
  const action = stateAction ?? localAction;
  const pipelineBusy = phase === "checking_balance" || phase === "starting";
  const isLocked = action !== undefined || busy || disabled || pipelineBusy;

  /* ───────── live 4-row breakdown ──────────
   *
   *   Principal       = user-entered principal (or payload default)
   *   Service fee     = flat → service_fee_value
   *                   = percentage → principal * (value / 100)
   *   Gas (estimate)  = from payload (BE preview lands later)
   *   Total           = principal_usdc_equivalent + service_fee_amount + gas
   */
  const breakdown = useMemo(() => {
    const principalRaw =
      typeof watchedPrincipal === "string" || typeof watchedPrincipal === "number"
        ? watchedPrincipal
        : principalAmount;
    const principalN = toUsdcNumber(principalRaw);

    // Assume USDC pegged 1:1 until a real-time quoter lands.
    const principalUsdcN =
      toUsdcNumber(principalUsdcEquivalent) ||
      (Number.isFinite(principalN) ? principalN : NaN);

    let feeUsdcN: number;
    if (serviceFeeMode === "percentage") {
      const pct = toUsdcNumber(serviceFeeValue);
      feeUsdcN =
        Number.isFinite(pct) && Number.isFinite(principalUsdcN)
          ? (principalUsdcN * pct) / 100
          : NaN;
    } else {
      feeUsdcN =
        toUsdcNumber(serviceFeeAmountUsdc) ||
        toUsdcNumber(serviceFeeValue) ||
        NaN;
    }

    const gasUsdcN = toUsdcNumber(gasEstimateUsdc);
    const totalUsdcN =
      Number.isFinite(principalUsdcN) || Number.isFinite(feeUsdcN) || Number.isFinite(gasUsdcN)
        ? (Number.isFinite(principalUsdcN) ? principalUsdcN : 0) +
          (Number.isFinite(feeUsdcN) ? feeUsdcN : 0) +
          (Number.isFinite(gasUsdcN) ? gasUsdcN : 0)
        : toUsdcNumber(totalUsdc);

    return {
      principal:
        Number.isFinite(principalN) && principalN > 0
          ? `${principalN} ${principalToken || "USDC"}${
              principalToken && principalToken !== "USDC" && Number.isFinite(principalUsdcN)
                ? ` ≈ ${formatUsdc(principalUsdcN)}`
                : ""
            }`
          : "—",
      serviceFee: Number.isFinite(feeUsdcN) ? formatUsdc(feeUsdcN) : "—",
      serviceFeeLabel:
        serviceFeeMode === "percentage"
          ? `Service fee (${serviceFeeValue}%)`
          : "Service fee (flat)",
      gas: Number.isFinite(gasUsdcN) ? formatUsdc(gasUsdcN) : "—",
      total: Number.isFinite(totalUsdcN) ? formatUsdc(totalUsdcN) : "—",
      totalN: Number.isFinite(totalUsdcN) ? totalUsdcN : NaN,
    };
  }, [
    watchedPrincipal,
    principalAmount,
    principalToken,
    principalUsdcEquivalent,
    serviceFeeMode,
    serviceFeeValue,
    serviceFeeAmountUsdc,
    gasEstimateUsdc,
    totalUsdc,
  ]);

  /* ───────── live insufficient-balance derivation ─────────
   *
   * Mirrors SchemaFormCard's `isInsufficient` so the primary CTA flips
   * to Top Up the instant `balanceUsdc < total`. Pure derivation — no
   * phase state. When `useBalance` refetches (TopUpModal close/confirm
   * invalidates that query), this re-evaluates on next render so the
   * button switches back to Confirm & Pay without remounting the form.
   * Falls back to payload `totalUsdc` if the live breakdown couldn't
   * compute a finite total (e.g. principal empty before first keystroke).
   */
  const isInsufficient = useMemo(() => {
    const totalN = Number.isFinite(breakdown.totalN)
      ? breakdown.totalN
      : toUsdcNumber(totalUsdc);
    const balanceN = toUsdcNumber(balanceUsdc ?? undefined);
    if (!Number.isFinite(totalN) || !Number.isFinite(balanceN)) return false;
    return balanceN < totalN;
  }, [balanceUsdc, breakdown.totalN, totalUsdc]);

  // Gate Confirm & Pay on a positive principal. BE rejects fund_amount<=0,
  // and a 0/empty principal would create a zero-value transfer that
  // wastes a UserOp. RHF validation only fires on submit; this disables
  // the button up-front so the user sees the requirement live.
  const isPrincipalInvalid = useMemo(() => {
    const raw =
      typeof watchedPrincipal === "string" || typeof watchedPrincipal === "number"
        ? watchedPrincipal
        : "";
    if (raw === "" || raw === null || raw === undefined) return true;
    const n = toUsdcNumber(raw);
    return !Number.isFinite(n) || n <= 0;
  }, [watchedPrincipal]);

  /* ───────── card synthesis ───────── */

  const appendCardToHostMessage = useCallback(
    (card: CardPayload) => {
      if (!messageId) {
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

  const emitOrderSuccess = useCallback(
    (result: StartOrderResult) => {
      // `result.orderId` is null until the provider SDK accepts the
      // negotiation. We pass `negotiationId` along so the OrderSuccess
      // card can poll for the real `order_id` and only render
      // "Order #<id>" once it lands. Surfacing the negotiation_id as
      // an order_id placeholder is explicitly banned (see the hotfix
      // notes in SchemaFormCard.tsx).
      const success: OrderSuccessCardPayload = {
        orderId: result.orderId,
        negotiationId: result.negotiationId,
        agentName,
        status: "pending",
        note: "Order created — track payment and delivery on your orders page.",
      };
      appendCardToHostMessage({
        cardId: makeLocalId("card"),
        cardType: "order_success",
        payload: success,
      });
    },
    [appendCardToHostMessage, agentName],
  );

  /* ───────── start-order pipeline ───────── */

  // Plan C3 / D-NAV-START: fund-transfer cards share the same v2 start
  // endpoint as SchemaFormCard. We don't run a pre-check here (the AI side
  // already decided the principal/route and there's no quote round-trip).
  // 409 navigator_not_ready recovery is fully delegated to
  // `startOrderWithReadiness` (wallet+agent_creating → deployWallet, else
  // poll-only; 90s budget, retry once).
  const runConfirm = useCallback(
    async (values: Record<string, unknown>) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setStartError(null);

      // 1) Refetch latest balance and re-check against current total
      //    before opening a negotiation. Fund-transfer pay is a single
      //    atomic batch UserOp (approve + payOrder + transfer(fund));
      //    if the requester is short USDC the whole thing reverts and
      //    the negotiation gets stuck. Bail out early — keeps the user's
      //    form values intact and flips the CTA back to Top Up via the
      //    live `isInsufficient` derivation. Mirrors SchemaFormCard.
      setPhase("checking_balance");
      let latestBalance: string | null = balanceUsdc;
      try {
        latestBalance = await refetchBalance();
      } catch {
        // Non-fatal — fall through to whatever the hook last reported.
      }
      if (controller.signal.aborted) return;

      const preCheckTotalN = Number.isFinite(breakdown.totalN)
        ? breakdown.totalN
        : toUsdcNumber(totalUsdc);
      const preCheckBalanceN = toUsdcNumber(latestBalance ?? undefined);
      if (
        Number.isFinite(preCheckTotalN)
        && Number.isFinite(preCheckBalanceN)
        && preCheckBalanceN < preCheckTotalN
      ) {
        setPhase("idle");
        setStartError("Balance is still insufficient. Please top up first.");
        return;
      }

      setPhase("starting");

      const idempotencyKey =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

      const principalRaw = principalKey ? values[principalKey] : undefined;
      const principalUsd = parseFloat(String(principalRaw ?? ""));
      const fundAmount = usdcMicroFromUsd(principalUsd).toString();

      let res: StartOrderResult;
      try {
        res = await startOrderWithReadiness(
          {
            serviceId,
            requirements: pruneOptionalEmpty(values, fields),
            idempotencyKey,
            fundAmount,
            fundToken: BASE_MAINNET_USDC,
            cardId,
          },
          {
            loginMethod: session?.loginMethod,
            deployWallet,
            signal: controller.signal,
            // Intentionally no onUserMessage handler — the spinning
            // Confirm button is the sole "working" indicator.
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

      setPhase("succeeded");
      emitOrderSuccess(res);
    },
    [
      serviceId,
      principalKey,
      fields,
      balanceUsdc,
      refetchBalance,
      breakdown.totalN,
      totalUsdc,
      emitOrderSuccess,
      session?.loginMethod,
      deployWallet,
      cardId,
    ],
  );

  const handleFormSubmit = useCallback(
    (values: Record<string, unknown>) => {
      if (isLocked) return;
      void runConfirm(values);
    },
    [isLocked, runConfirm],
  );

  // eslint-disable-next-line react-hooks/refs
  const handleSubmit = form.handleSubmit(handleFormSubmit);

  const handleUserCancel = useCallback(() => {
    if (isLocked) return;
    abortRef.current?.abort();
    setPhase("user_cancelled");
    setStartError(null);
    onCancel?.();
  }, [isLocked, onCancel]);

  const handleRetry = useCallback(() => {
    setPhase("idle");
    setStartError(null);
  }, []);

  /* ───────── render ───────── */

  const resolvedPretext =
    pretext ??
    `your principal is sent through ${agentName || "this agent"}'s wallet to be swapped on-chain`;

  const breakdownRows: Array<{ label: string; value: string; bold?: boolean }> = [
    { label: `Principal (${principalToken || "USDC"})`, value: breakdown.principal },
    { label: breakdown.serviceFeeLabel, value: breakdown.serviceFee },
    { label: "Estimated Gas", value: breakdown.gas },
  ];

  return (
    <div data-card-kind="fund_transfer" className="space-y-2 w-full">
      <p className="text-xs text-[#6B6B6B] leading-relaxed">{resolvedPretext}</p>

      <CardShell
        className={disabled ? "opacity-60 pointer-events-none select-none" : ""}
      >
        <CardHeader>
          <p className="text-xs font-semibold text-[#0F0F0F]">
            Fund Transfer Order
          </p>
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
              {fields.length > 0 && (
                <div className="px-4 py-3 space-y-3.5">
                  {fields.map((field) => (
                    <SchemaFieldRenderer key={field.key} field={field} />
                  ))}
                </div>
              )}

              <div className="px-4 py-3 border-t border-[#E2E2E0] space-y-1.5">
                {breakdownRows.map((r) => (
                  <div key={r.label} className="flex justify-between text-xs">
                    <span className="text-[#9A9A9A]">{r.label}</span>
                    <span className="text-[#3A3A3A]">{r.value}</span>
                  </div>
                ))}
                <div className="flex justify-between text-xs font-semibold pt-1 border-t border-[#F0F0EE]">
                  <span className="text-[#0F0F0F]">Total</span>
                  <span className="text-[#0F0F0F]">{breakdown.total}</span>
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

              {phase === "start_failed" && (
                <div className="px-4 py-3 border-t border-[#E2E2E0] space-y-2 bg-[#FFF4F2]">
                  <p className="text-[11px] text-red-500 leading-snug">
                    {startError ?? "Failed to create the order. Please retry."}
                  </p>
                  <div className="flex gap-2 justify-end">
                    <button
                      type="button"
                      onClick={handleUserCancel}
                      className="px-4 py-2 text-xs font-medium text-[#6B6B6B] border border-[#E2E2E0] rounded-lg hover:bg-[#F5F5F3] transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleRetry}
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
                       the Confirm & Pay button without remounting the form.
                       Mirrors SchemaFormCard so users see the same recovery
                       path across schema_form and fund_transfer flows. */
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
                      confirmDisabled={
                        action === undefined ? isPrincipalInvalid : undefined
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
