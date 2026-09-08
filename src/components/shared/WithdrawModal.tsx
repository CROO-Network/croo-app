"use client";

import { useState, useRef, useEffect, useCallback, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import SectionHeader from "@/components/shared/SectionHeader";
import UsdcIcon from "@/components/shared/UsdcIcon";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatUsdc } from "@/lib/formatters";
import { useAuth } from "@/lib/auth";
import { getHttpAccessToken } from "@/lib/http/auth";
import { useToast } from "@/components/shared/Toast";
import { getMyNavigatorInfo, isNavigatorAgentType, listMyAgents } from "@/lib/api/agent";
import { ApiError } from "@/lib/http/errors";
import { agentInfoToMyAgentListItem } from "@/lib/my-agent-mapper";
import { executeNavigatorWithdraw } from "@/lib/navigator-withdraw";
import { useSignMessage } from "wagmi";
import {
  deployAgentUntilActive,
  deployNavigatorUntilActive,
  isNavigatorAaActive,
  NavigatorDeployFailedError,
  NavigatorDeployTimeoutError,
  type NavigatorDeployPhase,
} from "@/hooks/useNavigatorDeployUntilActive";
import { useWalletDeploy } from "@/hooks/useWalletDeploy";
import { invalidateNavigatorWallet } from "@/lib/query/invalidate";

interface WithdrawModalProps {
  children: ReactNode;
  /** Agent ID for withdraw API flow. */
  agentId?: string;
  /** The source AA lifecycle to inspect when deployment is required. */
  sourceKind: "navigator" | "agent";
  /** Disable loading agent wallet list. */
  disableAgentWalletLookup?: boolean;
  /** Source wallet label, e.g. "Main Wallet" or agent name */
  walletLabel: string;
  /** Source wallet address */
  walletAddress: string;
  /** Source wallet balance */
  balance: number;
  /** Called after the withdraw request has been submitted until the source balance changes. */
  onWithdrawSubmitted?: (previousBalance: number) => boolean | Promise<boolean>;
}

interface WalletOption {
  label: string;
  address: string;
  balance?: number;
}

interface NavigatorMainOption {
  agentId: string;
  address: string;
  balance: number;
}

/** USDC reserved for Pimlico ERC-20 paymaster gas. The AA wallet must keep at
 * least this much USDC after the transfer or sponsor will reject. */
const GAS_RESERVE_USDC = 0.01;
const WITHDRAW_BALANCE_POLL_INTERVAL_MS = 3_000;
const WITHDRAW_BALANCE_POLL_MAX_ATTEMPTS = 20;

type WithdrawFlowPhase = NavigatorDeployPhase | "withdrawing" | "sign_withdraw" | "idle";

function isWithdrawDeployRequired(err: unknown): boolean {
  return (
    err instanceof ApiError &&
    err.reason === "AA_DEPLOY_REQUIRED"
  );
}

function confirmButtonLabel(phase: WithdrawFlowPhase, submitting: boolean): string {
  if (!submitting) return "Confirm Withdraw";
  switch (phase) {
    case "sign_deploy":
      return "Sign in wallet to deploy…";
    case "deploying":
      return "Deploying wallet…";
    case "confirming_on_chain":
      return "Confirming wallet on chain…";
    case "sign_withdraw":
      return "Sign in wallet to withdraw…";
    case "withdrawing":
      return "Submitting withdrawal…";
    default:
      return "Processing…";
  }
}

export default function WithdrawModal({
  children,
  agentId,
  sourceKind,
  disableAgentWalletLookup = false,
  walletLabel,
  walletAddress,
  balance,
  onWithdrawSubmitted,
}: WithdrawModalProps) {
  const { session, status: authStatus } = useAuth();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const { signMessageAsync } = useSignMessage();
  const { deployWallet } = useWalletDeploy();
  const [open, setOpen] = useState(false);
  const [selectedTo, setSelectedTo] = useState<string | null>(null);
  const [manualAddress, setManualAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [flowPhase, setFlowPhase] = useState<WithdrawFlowPhase>("idle");
  const abortRef = useRef<AbortController | null>(null);
  const balancePollTimeoutRef = useRef<number | null>(null);
  const balancePollRunIdRef = useRef(0);
  const [agentWallets, setAgentWallets] = useState<
    { name: string; address: string; balance: number }[]
  >([]);
  const [navigatorMain, setNavigatorMain] = useState<NavigatorMainOption | null>(null);
  const canLoadWalletDestinations =
    !disableAgentWalletLookup &&
    open &&
    authStatus === "authenticated" &&
    !!getHttpAccessToken();

  const invalidateNavigatorBalance = useCallback(() => {
    invalidateNavigatorWallet(queryClient);
  }, [queryClient]);

  const stopBalancePolling = useCallback(() => {
    balancePollRunIdRef.current += 1;
    if (balancePollTimeoutRef.current !== null) {
      window.clearTimeout(balancePollTimeoutRef.current);
      balancePollTimeoutRef.current = null;
    }
  }, []);

  const notifyWithdrawSubmitted = useCallback(() => {
    stopBalancePolling();

    if (!onWithdrawSubmitted) {
      invalidateNavigatorBalance();
      return;
    }

    let attempts = 0;
    const runId = balancePollRunIdRef.current;
    const pollBalance = () => {
      balancePollTimeoutRef.current = window.setTimeout(() => {
        if (runId !== balancePollRunIdRef.current) return;
        attempts += 1;
        invalidateNavigatorBalance();
        void (async () => {
          let changed = false;
          try {
            changed = await onWithdrawSubmitted(balance);
          } catch {
            changed = false;
          }
          if (runId !== balancePollRunIdRef.current) return;
          if (changed || attempts >= WITHDRAW_BALANCE_POLL_MAX_ATTEMPTS) {
            balancePollTimeoutRef.current = null;
            return;
          }
          pollBalance();
        })();
      }, WITHDRAW_BALANCE_POLL_INTERVAL_MS);
    };

    pollBalance();
  }, [balance, invalidateNavigatorBalance, onWithdrawSubmitted, stopBalancePolling]);

  useEffect(() => stopBalancePolling, [stopBalancePolling]);

  useEffect(() => {
    if (!canLoadWalletDestinations) {
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await listMyAgents({ page: 1, page_size: 50 });
        if (cancelled) return;
        setAgentWallets(
          (res.agents || [])
            .filter((a) => !isNavigatorAgentType(a.agentType))
            .map((a) => {
            const m = agentInfoToMyAgentListItem(a);
            return { name: m.name, address: m.wallet.address, balance: m.wallet.balance };
          }),
        );
      } catch {
        if (!cancelled) setAgentWallets([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canLoadWalletDestinations]);

  useEffect(() => {
    if (!canLoadWalletDestinations) {
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const nav = await getMyNavigatorInfo();
        if (cancelled) return;
        const w = nav.navigator?.walletAddress?.trim();
        if (!w || w.toLowerCase() === walletAddress.toLowerCase()) {
          setNavigatorMain(null);
          return;
        }
        const balRaw = nav.balance?.availableUsdc;
        const bal = balRaw != null && balRaw !== "" ? Number(balRaw) : 0;
        const agentId = nav.navigator?.agentId?.trim();
        if (!agentId) {
          setNavigatorMain(null);
          return;
        }
        setNavigatorMain({
          agentId,
          address: w,
          balance: Number.isFinite(bal) ? bal : 0,
        });
      } catch {
        if (!cancelled) setNavigatorMain(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canLoadWalletDestinations, walletAddress]);

  const parsedAmount = Number(amount || 0);
  const maxWithdrawable = Math.max(0, balance - GAS_RESERVE_USDC);
  const exceedsMax = parsedAmount > maxWithdrawable + 1e-9;
  const insufficientBalance = balance <= GAS_RESERVE_USDC;

  const quickWallets: WalletOption[] = [];

  const visibleNavigatorMain = canLoadWalletDestinations ? navigatorMain : null;
  const visibleAgentWallets = canLoadWalletDestinations ? agentWallets : [];

  if (visibleNavigatorMain) {
    quickWallets.push({
      label: "Main Wallet",
      address: visibleNavigatorMain.address,
      balance: visibleNavigatorMain.balance,
    });
  }

  if (session?.loginMethod === "wallet" && session.userInfo.walletAddr) {
    const addr = session.userInfo.walletAddr;
    if (addr !== walletAddress) {
      quickWallets.push({
        label: "Owner Wallet",
        address: addr,
      });
    }
  }

  [...visibleAgentWallets]
    .filter((agent) => agent.address && agent.address !== walletAddress)
    .sort((a, b) => {
      const aHas = a.balance > 0 ? 1 : 0;
      const bHas = b.balance > 0 ? 1 : 0;
      if (aHas !== bHas) return bHas - aHas;
      return b.balance - a.balance;
    })
    .forEach((agent) => {
      quickWallets.push({
        label: `${agent.name} Wallet`,
        address: agent.address,
        balance: agent.balance,
      });
    });

  const isManual = selectedTo === "__manual__";
  const manualInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isManual) {
      // Wait for the input to mount before focusing
      setTimeout(() => manualInputRef.current?.focus(), 0);
    }
  }, [isManual]);
  const destinationValid = isManual
    ? /^0x[a-fA-F0-9]{40}$/.test(manualAddress.trim())
    : !!selectedTo;

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      abortRef.current?.abort();
      abortRef.current = null;
      setFlowPhase("idle");
    }
    setOpen(nextOpen);
    if (!nextOpen) {
      setSelectedTo(null);
      setManualAddress("");
      setAmount("");
      setAgentWallets([]);
      setNavigatorMain(null);
    }
  };

  const handleMax = () => {
    setAmount(maxWithdrawable.toFixed(2));
  };

  const toAddress = isManual ? manualAddress.trim() : (selectedTo || "");

  const deployOptions = (signal: AbortSignal) => ({
    loginMethod: session?.loginMethod,
    deployWallet,
    signal,
    onPhase: (p: NavigatorDeployPhase) => setFlowPhase(p),
  });

  const ensureSourceDeployed = async (targetAgentId: string, signal: AbortSignal) => {
    if (sourceKind === "navigator") {
      const nav = await getMyNavigatorInfo();
      if (isNavigatorAaActive(nav.navigator?.status)) {
        return;
      }
      await deployNavigatorUntilActive(targetAgentId, deployOptions(signal));
      return;
    }

    await deployAgentUntilActive(targetAgentId, deployOptions(signal));
  };

  const runWithdraw = async (targetAgentId: string, amountMicro: string) => {
    setFlowPhase("withdrawing");
    await executeNavigatorWithdraw({
      agentId: targetAgentId,
      toAddress,
      amountMicro,
      loginMethod: session?.loginMethod,
      signMessageAsync: (args) => signMessageAsync(args),
      onSignWithdraw: () => setFlowPhase("sign_withdraw"),
    });
  };

  const handleConfirm = async () => {
    if (!destinationValid || !amount || parsedAmount <= 0) return;
    if (!agentId) {
      showToast("Missing agent id for withdraw.");
      return;
    }
    if (exceedsMax) {
      showToast(`Keep at least ${formatUsdc(GAS_RESERVE_USDC)} USDC in the wallet to cover gas.`);
      return;
    }

    abortRef.current?.abort();
    const abort = new AbortController();
    abortRef.current = abort;

    setSubmitting(true);
    setFlowPhase("idle");
    const amountMicro = String(Math.round(parsedAmount * 1_000_000));

    try {
      // Main Wallet readiness is known from `/me/navigator`. Custom Agent
      // wallets have an independent lifecycle, so try their withdrawal first
      // and only deploy after the backend explicitly says it is required.
      if (sourceKind === "navigator") {
        await ensureSourceDeployed(agentId, abort.signal);
      }
      try {
        await runWithdraw(agentId, amountMicro);
      } catch (err) {
        if (!isWithdrawDeployRequired(err)) {
          throw err;
        }
        await ensureSourceDeployed(agentId, abort.signal);
        await runWithdraw(agentId, amountMicro);
      }
      showToast("Withdraw submitted.");
      setOpen(false);
      notifyWithdrawSubmitted();
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return;
      }
      if (err instanceof NavigatorDeployFailedError) {
        showToast(err.message);
        return;
      }
      if (err instanceof NavigatorDeployTimeoutError) {
        showToast(err.message);
        return;
      }
      if (err instanceof ApiError) {
        showToast(err.message || err.reason || "Withdraw failed.");
      } else if (err instanceof Error && err.message) {
        showToast(err.message);
      } else {
        showToast("Withdraw failed.");
      }
    } finally {
      if (abortRef.current === abort) {
        abortRef.current = null;
      }
      setSubmitting(false);
      setFlowPhase("idle");
    }
  };

  const truncateAddr = (addr: string) =>
    addr.length > 12 ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : addr;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <div className="contents" onClick={() => setOpen(true)}>{children}</div>
      <DialogContent
        showCloseButton
        className="flex max-h-[min(90dvh,40rem)] flex-col overflow-hidden gap-0 rounded-2xl border-[#E2E2E0] bg-white p-0 sm:max-w-md"
      >
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-6 pt-6 pb-4">
          <DialogTitle className="sr-only">Withdraw</DialogTitle>
          <SectionHeader label="Withdraw" />

          <div className="space-y-4">
            {/* From (fixed) */}
            <div className="space-y-2">
              <label className="text-[10px] font-mono uppercase tracking-[0.22em] text-[#9A9A9A]">
                From
              </label>
              <div className="flex items-center gap-3 rounded-2xl border border-[#E2E2E0] bg-[#FCFCFB] px-4 py-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#F5F5F3] text-[10px] font-semibold text-[#6B6B6B]">
                  {walletLabel.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#0F0F0F]">{walletLabel}</p>
                </div>
                <span className="text-xs font-mono text-[#6B6B6B] tabular-nums">
                  ${formatUsdc(balance)} USDC
                </span>
              </div>
            </div>

            {/* To (quick select + manual) */}
            <div className="space-y-2">
              <label className="text-[10px] font-mono uppercase tracking-[0.22em] text-[#9A9A9A]">
                To
              </label>
              <div className="overflow-hidden rounded-2xl border border-[#E2E2E0] bg-white">
                {quickWallets.map((w, i) => (
                  <button
                    key={w.address}
                    type="button"
                    onClick={() => setSelectedTo(w.address)}
                    className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-[#FAFAF9] ${
                      i > 0 ? "border-t border-[#F0F0EE]" : ""
                    }`}
                  >
                    <span className={`flex h-4 w-4 items-center justify-center rounded-full border-2 ${
                      selectedTo === w.address
                        ? "border-[#6EE646] bg-[#6EE646]"
                        : "border-[#D0D0CE]"
                    }`}>
                      {selectedTo === w.address && (
                        <span className="h-1.5 w-1.5 rounded-full bg-white" />
                      )}
                    </span>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm text-[#0F0F0F]">{w.label}</span>
                    </div>
                    {w.balance !== undefined && (
                      <span className="text-[11px] font-mono text-[#9A9A9A] tabular-nums">${formatUsdc(w.balance)}</span>
                    )}
                    <span className="text-[11px] font-mono text-[#9A9A9A]">{truncateAddr(w.address)}</span>
                  </button>
                ))}

                {/* Divider */}
                <div className="mx-4 h-px bg-[#E2E2E0]" />

                {/* Enter manually */}
                <button
                  type="button"
                  onClick={() => setSelectedTo("__manual__")}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-[#FAFAF9]"
                >
                  <span className={`flex h-4 w-4 items-center justify-center rounded-full border-2 ${
                    isManual
                      ? "border-[#6EE646] bg-[#6EE646]"
                      : "border-[#D0D0CE]"
                  }`}>
                    {isManual && (
                      <span className="h-1.5 w-1.5 rounded-full bg-white" />
                    )}
                  </span>
                  <span className="text-sm text-[#6B6B6B]">Enter address manually</span>
                </button>
              </div>

              {/* Manual address input */}
              {isManual && (
                <div className="space-y-1.5">
                  <label className="text-[10px] font-mono uppercase tracking-[0.22em] text-[#9A9A9A]">
                    Address
                  </label>
                  <input
                    ref={manualInputRef}
                    type="text"
                    value={manualAddress}
                    onChange={(e) => setManualAddress(e.target.value)}
                    placeholder="0x..."
                    className={`h-12 w-full rounded-2xl border px-4 text-sm text-[#0F0F0F] outline-none transition-colors placeholder:text-[#9A9A9A] focus:border-[#6EE646] focus:bg-white ${
                      manualAddress && !destinationValid
                        ? "border-[#E54D2E] bg-[#FFF5F3]"
                        : "border-[#E2E2E0] bg-[#F5F5F3]"
                    }`}
                  />
                  {manualAddress && !destinationValid && (
                    <p className="text-[11px] text-[#E54D2E]">Invalid wallet address</p>
                  )}
                </div>
              )}
            </div>

            {/* Amount */}
            <div className="space-y-2">
              <label className="text-[10px] font-mono uppercase tracking-[0.22em] text-[#9A9A9A]">
                Amount
              </label>
              <div className="flex h-12 items-center gap-3 rounded-2xl border border-[#E2E2E0] bg-[#F5F5F3] px-4 transition-colors focus-within:border-[#6EE646] focus-within:bg-white">
                <UsdcIcon size={18} />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="h-full w-full bg-transparent text-sm text-[#0F0F0F] outline-none placeholder:text-[#9A9A9A]"
                />
                <button
                  type="button"
                  onClick={handleMax}
                  className="rounded-full border border-[#E2E2E0] px-2.5 py-1 text-[10px] font-mono uppercase tracking-[0.18em] text-[#6B6B6B] transition-colors hover:border-[#9A9A9A] hover:text-[#0F0F0F]"
                >
                  Max
                </button>
              </div>
              <p className="text-xs text-[#9A9A9A]">
                Available: <span className="font-mono text-[#6B6B6B]">${formatUsdc(maxWithdrawable)} USDC</span>
                <span className="ml-1 text-[#9A9A9A]">
                  (balance ${formatUsdc(balance)} − ${formatUsdc(GAS_RESERVE_USDC)} reserved for gas)
                </span>
              </p>
              {amount && exceedsMax && (
                <p className="text-[11px] text-[#E54D2E]">
                  Keep at least ${formatUsdc(GAS_RESERVE_USDC)} USDC to cover gas. Max withdrawable is ${formatUsdc(maxWithdrawable)} USDC.
                </p>
              )}
              {insufficientBalance && (
                <p className="text-[11px] text-[#E54D2E]">
                  Balance must exceed ${formatUsdc(GAS_RESERVE_USDC)} USDC (gas reserve) to withdraw.
                </p>
              )}
            </div>

            {/* Gas estimate */}
            <p className="text-xs text-[#9A9A9A]">
              Network gas (USDC paymaster): ~${formatUsdc(GAS_RESERVE_USDC)} USDC, kept in this wallet.
            </p>
            {submitting && flowPhase !== "idle" && (
              <p className="text-xs text-[#6B6B6B]">
                {confirmButtonLabel(flowPhase, true)}
              </p>
            )}
          </div>
        </div>

        <div className="shrink-0 border-t border-[#E2E2E0] bg-white px-6 py-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="h-10 flex-1 rounded-full border border-[#E2E2E0] text-sm font-medium text-[#6B6B6B] transition-colors hover:border-[#9A9A9A] hover:text-[#0F0F0F]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={
                !destinationValid ||
                !amount ||
                parsedAmount <= 0 ||
                exceedsMax ||
                insufficientBalance ||
                submitting
              }
              className="h-10 flex-1 rounded-full bg-[#0F0F0F] text-sm font-medium text-white transition-colors hover:bg-[#1A1A1A] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {confirmButtonLabel(flowPhase, submitting)}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
