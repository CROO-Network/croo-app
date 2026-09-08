"use client";

import { useState, useEffect, useCallback, useMemo, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import encodeQR from "qr";
import {
  useAccount,
  usePublicClient,
  useReadContract,
  useSignMessage,
  useSwitchChain,
  useWalletClient,
} from "wagmi";
import { base } from "wagmi/chains";
import {
  BaseError,
  erc20Abi,
  formatUnits,
  getAddress,
  isAddress,
  parseUnits,
} from "viem";
import CopyButton from "@/components/shared/CopyButton";
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
import {
  autoDeployUserOp,
  custodialWithdrawUserOp,
  getMyNavigatorInfo,
  isNavigatorAgentType,
  listMyAgents,
  prepareWithdrawUserOp,
  submitWithdrawUserOp,
} from "@/lib/api/agent";
import { agentInfoToMyAgentListItem } from "@/lib/my-agent-mapper";
import { ResolvedAgentAvatar } from "@/components/shared/ResolvedAgentAvatar";
import { ApiError } from "@/lib/http/errors";
import { userOpHashSignMessageArgs } from "@/lib/wagmi-sign-user-op";
import { useWalletDeploy } from "@/hooks/useWalletDeploy";
import { invalidateMyFirstAgentCampaign } from "@/lib/campaign-cache";
import { invalidateNavigatorWallet } from "@/lib/query/invalidate";

const BASE_USDC =
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_BASE_USDC_ADDRESS?.trim()) ||
  "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
interface TopUpModalProps {
  children?: ReactNode;
  /** Target wallet label, e.g. "Main Wallet" or agent name */
  walletLabel: string;
  /** Target wallet address */
  walletAddress: string;
  /** Disable loading agent wallet list. */
  disableAgentWalletLookup?: boolean;
  /** Controlled open state for triggers that may unmount, such as hover menus. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

type FundingSource = "connected" | "main" | "agent";

interface WalletOption {
  label: string;
  address: string;
  balance: number;
  avatar?: string;
  disabled: boolean;
  source: FundingSource;
  /** Source agent AA for internal transfer (main or custom). */
  agentId?: string;
}

const ESTIMATED_GAS = 0.01;

/** Map viem/wallet errors into a short, user-actionable message. */
function formatWalletError(err: unknown): string {
  if (err instanceof BaseError) {
    const short = err.shortMessage?.trim();
    const msg = (short || err.message || "").toLowerCase();
    if (msg.includes("user rejected") || msg.includes("user denied")) {
      return "Transaction rejected in wallet.";
    }
    if (msg.includes("insufficient funds")) {
      return "Insufficient ETH on Base for gas. Bridge a small amount of ETH to Base and try again.";
    }
    if (msg.includes("transfer amount exceeds balance")) {
      return "Your USDC balance is not enough for this transfer.";
    }
    if (msg.includes("chain mismatch") || msg.includes("wrong network")) {
      return "Please switch your wallet to Base network.";
    }
    if (msg.includes("internal error") || msg.includes("failed to decode")) {
      return "Wallet failed to estimate gas. Make sure you have ETH on Base for gas, then try again.";
    }
    return short || "Transfer failed.";
  }
  if (err instanceof Error && err.message) {
    return err.message.length > 200 ? `${err.message.slice(0, 200)}…` : err.message;
  }
  return "Transfer failed.";
}

export default function TopUpModal({
  children,
  walletLabel,
  walletAddress,
  disableAgentWalletLookup = false,
  open: controlledOpen,
  onOpenChange,
}: TopUpModalProps) {
  const { session, status: authStatus } = useAuth();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const { address: wagmiAddress, chainId } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const { switchChainAsync } = useSwitchChain();

  const [internalOpen, setInternalOpen] = useState(false);
  const [step, setStep] = useState<"select" | "transfer" | "qr">("select");
  const [selectedFrom, setSelectedFrom] = useState<WalletOption | null>(null);
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [agentWallets, setAgentWallets] = useState<
    { id: string; name: string; address: string; balance: number; avatar: string }[]
  >([]);
  const [navigatorMain, setNavigatorMain] = useState<{
    agentId: string;
    address: string;
    balance: number;
  } | null>(null);
  const open = controlledOpen ?? internalOpen;
  const canLoadWalletSources =
    !disableAgentWalletLookup &&
    open &&
    authStatus === "authenticated" &&
    !!getHttpAccessToken();

  const { data: walletClient } = useWalletClient({ chainId: base.id });
  const publicClient = usePublicClient({ chainId: base.id });
  const { deployWallet } = useWalletDeploy();

  const normalizedWalletAddress = useMemo(() => {
    const raw = walletAddress.trim();
    if (!raw || !isAddress(raw)) return null;
    return getAddress(raw);
  }, [walletAddress]);

  useEffect(() => {
    if (!canLoadWalletSources) {
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
              return {
                id: m.id,
                name: m.name,
                address: m.wallet.address,
                balance: m.wallet.balance,
                avatar: m.avatar,
              };
            }),
        );
      } catch {
        if (!cancelled) setAgentWallets([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canLoadWalletSources]);

  useEffect(() => {
    if (!canLoadWalletSources) {
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
  }, [canLoadWalletSources, walletAddress]);

  const parsedAmount = Number(amount || 0);

  // Only treat wagmi account as an on-chain sender.
  // Login identity (session walletAddr) does not guarantee an active connector.
  const connectedAddress = wagmiAddress?.trim();

  const connectedTopUpEnabled =
    open &&
    !!normalizedWalletAddress &&
    !!connectedAddress &&
    connectedAddress.toLowerCase() !== normalizedWalletAddress.toLowerCase();

  const {
    data: connectedBalanceWei,
    isPending: connectedBalPending,
    isFetching: connectedBalFetching,
    refetch: refetchConnectedUsdc,
  } = useReadContract({
    address: BASE_USDC as `0x${string}`,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: connectedTopUpEnabled ? [connectedAddress as `0x${string}`] : undefined,
    chainId: base.id,
    query: { enabled: connectedTopUpEnabled },
  });

  const connectedBalanceLoading = connectedTopUpEnabled && (connectedBalPending || connectedBalFetching);
  const connectedUsdcBalance =
    connectedBalanceWei != null ? Number(formatUnits(connectedBalanceWei, 6)) : 0;

  const walletOptions: WalletOption[] = [];

  if (
    connectedAddress &&
    normalizedWalletAddress &&
    connectedAddress.toLowerCase() !== normalizedWalletAddress.toLowerCase()
  ) {
    walletOptions.push({
      label: "Connected Wallet",
      address: connectedAddress,
      balance: connectedUsdcBalance,
      disabled: !connectedBalanceLoading && connectedUsdcBalance <= 0,
      source: "connected",
    });
  }

  const visibleNavigatorMain = canLoadWalletSources ? navigatorMain : null;
  const visibleAgentWallets = canLoadWalletSources ? agentWallets : [];

  if (visibleNavigatorMain) {
    walletOptions.push({
      label: "Main Wallet",
      address: visibleNavigatorMain.address,
      balance: visibleNavigatorMain.balance,
      disabled: visibleNavigatorMain.balance <= 0,
      source: "main",
      agentId: visibleNavigatorMain.agentId,
    });
  }

  [...visibleAgentWallets]
    .filter((agent) => agent.address && agent.address.toLowerCase() !== walletAddress.toLowerCase())
    .sort((a, b) => {
      const aHas = a.balance > 0 ? 1 : 0;
      const bHas = b.balance > 0 ? 1 : 0;
      if (aHas !== bHas) return bHas - aHas;
      return b.balance - a.balance;
    })
    .forEach((agent) => {
      walletOptions.push({
        label: `${agent.name} Wallet`,
        address: agent.address,
        balance: agent.balance,
        avatar: agent.avatar,
        disabled: agent.balance === 0,
        source: "agent",
        agentId: agent.id,
      });
    });

  const invalidateBalance = useCallback(() => {
    invalidateNavigatorWallet(queryClient);
  }, [queryClient]);

  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange?.(nextOpen);
    if (controlledOpen === undefined) {
      setInternalOpen(nextOpen);
    }
    if (!nextOpen) {
      setStep("select");
      setSelectedFrom(null);
      setAmount("");
      setSubmitting(false);
      setAgentWallets([]);
      setNavigatorMain(null);
      invalidateBalance();
    }
  };

  const handleSelectWallet = async (wallet: WalletOption) => {
    if (wallet.disabled) return;
    if (wallet.source === "connected" && chainId !== base.id) {
      try {
        await switchChainAsync({ chainId: base.id });
      } catch {
        showToast("Please switch your wallet to Base network.");
        return;
      }
    }
    setSelectedFrom(wallet);
    setStep("transfer");
  };

  const handleBack = () => {
    setStep("select");
    setSelectedFrom(null);
    setAmount("");
  };

  const handleMax = () => {
    if (!selectedFrom) return;
    setAmount(selectedFrom.balance.toFixed(2));
  };

  const signUserOpHash = async (userOpHash: string) => {
    return signMessageAsync(userOpHashSignMessageArgs(userOpHash));
  };

  const handleConfirm = async () => {
    if (!amount || parsedAmount <= 0 || !selectedFrom) return;

    if (selectedFrom.source === "connected") {
      if (!wagmiAddress) {
        showToast("Please connect your wallet first.");
        return;
      }
      if (!normalizedWalletAddress) {
        showToast("Invalid destination wallet address.");
        return;
      }
      if (chainId !== base.id) {
        try {
          await switchChainAsync({ chainId: base.id });
        } catch {
          showToast("Please switch your wallet to Base network.");
          return;
        }
      }
      if (!walletClient) {
        showToast("Wallet is not ready yet. Please retry in a moment.");
        return;
      }
      if (!publicClient) {
        showToast("Network client unavailable. Please retry.");
        return;
      }

      setSubmitting(true);
      try {
        const amountWei = parseUnits(parsedAmount.toFixed(6), 6);
        const sender = getAddress(wagmiAddress);
        const usdc = getAddress(BASE_USDC);

        // Gas is paid in ETH on Base by the connected wallet. Pre-check ETH
        // balance so we can fail fast with a clear message instead of letting
        // the wallet RPC return a cryptic "internal error" during gas
        // estimation.
        const ethBal = await publicClient.getBalance({ address: sender });
        if (ethBal === BigInt(0)) {
          showToast("Your wallet has no ETH on Base for gas. Bridge a small amount of ETH to Base and try again.");
          return;
        }

        // Simulate USDC.transfer on Base. Surfaces clear revert reasons
        // (insufficient USDC, blocklist, etc.) before the wallet is asked
        // to sign.
        const sim = await publicClient.simulateContract({
          account: sender,
          address: usdc,
          abi: erc20Abi,
          functionName: "transfer",
          args: [normalizedWalletAddress, amountWei],
          chain: base,
        });

        await walletClient.writeContract(sim.request);

        showToast("USDC transfer submitted.");
        void refetchConnectedUsdc();
        invalidateMyFirstAgentCampaign(queryClient);
        handleOpenChange(false);
        invalidateBalance();
      } catch (e) {
        showToast(formatWalletError(e));
      } finally {
        setSubmitting(false);
      }
      return;
    }

    const sourceAgentId = selectedFrom.agentId;
    if (!sourceAgentId) {
      showToast("Missing source wallet.");
      return;
    }

    setSubmitting(true);
    try {
      const amountMicro = String(Math.round(parsedAmount * 1_000_000));
      if (session?.loginMethod === "google") {
        await custodialWithdrawUserOp(sourceAgentId, walletAddress, amountMicro);
      } else {
        const prepared = await prepareWithdrawUserOp(sourceAgentId, walletAddress, amountMicro);
        const signature = await signUserOpHash(prepared.userOpHash);
        await submitWithdrawUserOp(prepared.taskId, prepared.userOpHash, signature);
      }
      showToast("Transfer submitted.");
      invalidateMyFirstAgentCampaign(queryClient);
      handleOpenChange(false);
      invalidateBalance();
    } catch (err) {
      if (
        err instanceof ApiError &&
        (err.reason === "AA_DEPLOY_REQUIRED" || err.reason === "INVALID_STATE")
      ) {
        try {
          if (session?.loginMethod === "google") {
            await autoDeployUserOp(sourceAgentId);
            showToast("AA deploy submitted. Retry in a moment.");
            handleOpenChange(false);
            return;
          }
          if (session?.loginMethod === "wallet") {
            await deployWallet(sourceAgentId);
            showToast("AA deploy submitted. Retry in a moment.");
            handleOpenChange(false);
            return;
          }
        } catch {
          showToast("AA deploy failed. Please try again.");
          return;
        }
      }
      if (err instanceof ApiError) {
        showToast(err.message || err.reason || "Transfer failed.");
      } else {
        showToast("Transfer failed.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const truncateAddr = (addr: string) =>
    addr.length > 12 ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : addr;

  const transferBusy = submitting;
  const qrCodeSrc = useMemo(() => {
    if (step !== "qr") {
      return "";
    }
    const svg = encodeQR(walletAddress, "svg", {
      ecc: "medium",
      border: 3,
      optimize: true,
    });
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  }, [step, walletAddress]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {children ? (
        <div className="contents" onClick={() => handleOpenChange(true)}>{children}</div>
      ) : null}
      <DialogContent
        showCloseButton
        className="flex max-h-[min(90dvh,40rem)] flex-col overflow-hidden gap-0 rounded-2xl border-[#E2E2E0] bg-white p-0 sm:max-w-md"
      >
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-6 pt-6 pb-4">
          <DialogTitle className="sr-only">Top Up</DialogTitle>

          {step === "select" && (
            <>
              <SectionHeader label="Top Up" />
              <div className="space-y-4">
                <p className="text-xs text-[#9A9A9A]">
                  To: <span className="font-medium text-[#0F0F0F]">{walletLabel}</span>
                </p>

                <div className="rounded-2xl border border-[#E2E2E0] bg-[#FCFCFB] px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-mono text-sm text-[#0F0F0F]">{truncateAddr(walletAddress)}</span>
                    <div className="flex items-center gap-2">
                      <CopyButton value={walletAddress} label="address" />
                      <button
                        type="button"
                        onClick={() => setStep("qr")}
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-[#9A9A9A] transition-colors hover:bg-[#F5F5F3] hover:text-[#0F0F0F]"
                        title="Show QR code"
                      >
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                          <rect x="2" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3" />
                          <rect x="9" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3" />
                          <rect x="2" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3" />
                          <rect x="10" y="10" width="3" height="3" rx="0.5" stroke="currentColor" strokeWidth="1.3" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  <p className="mt-1.5 text-[10px] text-[#9A9A9A]">Base Network · USDC only</p>
                </div>

                <div className="flex gap-2 rounded-xl bg-[#FFF8E6] px-3 py-2.5">
                  <span className="text-sm">⚠️</span>
                  <p className="text-xs leading-5 text-[#8B6914]">
                    Only send USDC on Base network. Assets sent on other networks cannot be recovered.
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <div className="h-px flex-1 bg-[#E2E2E0]" />
                  <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#9A9A9A]">From a wallet</span>
                  <div className="h-px flex-1 bg-[#E2E2E0]" />
                </div>

                <div className="space-y-2">
                  {walletOptions.length === 0 && (
                    <p className="text-xs text-[#9A9A9A]">No other wallets available. Use QR or copy address above.</p>
                  )}
                  {walletOptions.map((w) => (
                    <button
                      key={`${w.source}-${w.address}`}
                      type="button"
                      disabled={w.disabled}
                      onClick={() => handleSelectWallet(w)}
                      className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-colors ${
                        w.disabled
                          ? "cursor-not-allowed border-[#F0F0EE] bg-[#FAFAF9] opacity-50"
                          : "border-[#E2E2E0] bg-white hover:border-[#C2C2C0]"
                      }`}
                    >
                      {w.avatar ? (
                        <ResolvedAgentAvatar avatar={w.avatar} name={w.label} className="h-7 w-7 rounded-full object-cover" />
                      ) : (
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#F5F5F3] text-[10px] font-semibold text-[#6B6B6B]">
                          {w.label.charAt(0)}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[#0F0F0F] truncate">{w.label}</p>
                        {w.disabled && (
                          <p className="text-[10px] text-[#9A9A9A]">No balance</p>
                        )}
                        {w.source === "connected" && (
                          <p className="text-[10px] text-[#9A9A9A]">On-chain transfer from your wallet</p>
                        )}
                      </div>
                      <span className="text-xs font-mono text-[#6B6B6B] tabular-nums">
                        {w.source === "connected" && connectedBalanceLoading ? (
                          <span className="text-[#9A9A9A]">…</span>
                        ) : w.balance > 0 || w.source === "connected" ? (
                          `$${formatUsdc(w.balance)} USDC`
                        ) : (
                          ""
                        )}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {step === "transfer" && selectedFrom && (
            <>
              <div className="mb-4 flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleBack}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-[#9A9A9A] transition-colors hover:bg-[#F5F5F3] hover:text-[#0F0F0F]"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M10 4L6 8l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                <SectionHeader label="Top Up" />
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#9A9A9A]">
                    From: <span className="font-medium text-[#0F0F0F]">{selectedFrom.label}</span>
                  </span>
                  <span className="text-[#9A9A9A]">
                    To: <span className="font-medium text-[#0F0F0F]">{walletLabel}</span>
                  </span>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-mono uppercase tracking-[0.22em] text-[#9A9A9A]">Amount</label>
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
                      disabled={selectedFrom.balance <= 0}
                      className="rounded-full border border-[#E2E2E0] px-2.5 py-1 text-[10px] font-mono uppercase tracking-[0.18em] text-[#6B6B6B] transition-colors hover:border-[#9A9A9A] hover:text-[#0F0F0F] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Max
                    </button>
                  </div>
                  <p className="text-xs text-[#9A9A9A]">
                    Available:{" "}
                    <span className="font-mono text-[#6B6B6B]">${formatUsdc(selectedFrom.balance)} USDC</span>
                  </p>
                </div>

                {selectedFrom.source !== "connected" && (
                  <p className="text-xs text-[#9A9A9A]">
                    Estimated Gas: ~${formatUsdc(ESTIMATED_GAS)} USDC (deducted from amount)
                  </p>
                )}
                {selectedFrom.source === "connected" && (
                  <p className="text-xs text-[#9A9A9A]">
                    You will confirm a USDC transfer in your wallet on Base.
                    {" "}
                    <span className="text-[#6B6B6B]">Gas is paid in ETH on Base by your wallet.</span>
                  </p>
                )}
              </div>
            </>
          )}

          {step === "qr" && (
            <>
              <div className="mb-4 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setStep("select")}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-[#9A9A9A] transition-colors hover:bg-[#F5F5F3] hover:text-[#0F0F0F]"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M10 4L6 8l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                <SectionHeader label="Top Up" />
              </div>

              <div className="space-y-4">
                <p className="text-xs text-[#9A9A9A]">
                  To: <span className="font-medium text-[#0F0F0F]">{walletLabel}</span>
                </p>

                <div className="flex justify-center py-4">
                  <div className="flex h-40 w-40 items-center justify-center rounded-2xl border border-[#E2E2E0] bg-white p-3">
                    <div
                      role="img"
                      aria-label={`${walletLabel} top up QR code`}
                      className="h-full w-full bg-contain bg-center bg-no-repeat"
                      style={{ backgroundImage: `url("${qrCodeSrc}")` }}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-center gap-2">
                  <span className="font-mono text-sm text-[#0F0F0F]">{truncateAddr(walletAddress)}</span>
                  <CopyButton value={walletAddress} label="address" />
                </div>

                <p className="text-center text-[10px] text-[#9A9A9A]">Base Network · USDC only</p>

                <div className="flex gap-2 rounded-xl bg-[#FFF8E6] px-3 py-2.5">
                  <span className="text-sm">⚠️</span>
                  <p className="text-xs leading-5 text-[#8B6914]">Only send USDC on Base network.</p>
                </div>
              </div>
            </>
          )}
        </div>

        {step === "transfer" && selectedFrom && (
          <div className="shrink-0 border-t border-[#E2E2E0] bg-white px-6 py-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleBack}
                className="h-10 flex-1 rounded-full border border-[#E2E2E0] text-sm font-medium text-[#6B6B6B] transition-colors hover:border-[#9A9A9A] hover:text-[#0F0F0F]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={!amount || parsedAmount <= 0 || transferBusy}
                className="h-10 flex-1 rounded-full bg-[#6EE646] text-sm font-medium text-[#0F0F0F] transition-colors hover:bg-[#5DD835] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {transferBusy ? "Submitting..." : "Confirm Transfer"}
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
