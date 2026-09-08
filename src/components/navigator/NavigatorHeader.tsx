"use client";

import { X } from "lucide-react";
import TopUpModal from "@/components/shared/TopUpModal";
import { useBalance } from "@/hooks/useBalance";
import { formatUsdc } from "@/lib/formatters";
import { useNavigatorDialogClose } from "./NavigatorDialog";
import { useChain } from "@/lib/chain-context";

export function NavigatorHeader({ walletAddress }: { walletAddress: string }) {
  const requestClose = useNavigatorDialogClose();
  const handleClose = requestClose ?? (() => {});
  const { isInteractive, meta } = useChain();

  const { balanceUsdc, isLoading } = useBalance();
  const numericBalance =
    balanceUsdc != null && balanceUsdc !== ""
      ? Number(balanceUsdc)
      : NaN;
  const hasBalance = Number.isFinite(numericBalance);
  const displayBalance = hasBalance ? `$${formatUsdc(numericBalance)}` : "—";
  const isWalletReady = walletAddress.length > 0;

  return (
    <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E2E0] shrink-0">
      <div className="flex items-center gap-2.5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/croo-mascot.webp?v=4"
          alt="CROO"
          className="h-8 w-8 rounded-lg object-cover"
        />
        <h2 className="text-sm font-semibold text-[#0F0F0F]">CROO</h2>
      </div>
      <div className="flex items-center gap-2">
        {isInteractive ? <><span
          className={`text-sm font-mono tabular-nums ${
            hasBalance
              ? "text-[#0F0F0F] font-semibold"
              : "text-[#9A9A9A] font-normal"
          }`}
          title={isLoading ? "Loading balance…" : undefined}
        >
          {displayBalance}
        </span>
        {isWalletReady ? (
          <TopUpModal walletLabel="Main Wallet" walletAddress={walletAddress}>
            <button className="h-7 rounded-full bg-[#6EE646] hover:bg-[#5DD835] px-3 text-xs font-medium text-[#0F0F0F] transition-colors">
              Top Up
            </button>
          </TopUpModal>
        ) : (
          <button
            disabled
            title="Navigator wallet is being prepared — try again in a moment"
            className="h-7 rounded-full bg-[#E2E2E0] px-3 text-xs font-medium text-[#9A9A9A] cursor-not-allowed"
          >
            Top Up
          </button>
        )}</> : (
          <span className="rounded-full bg-[#F5F5F3] px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider text-[#6B6B6B]">
            Discovery · {meta.label}
          </span>
        )}
        <button
          onClick={handleClose}
          className="h-8 w-8 rounded-full hover:bg-[#F5F5F3] flex items-center justify-center transition-colors ml-1"
          aria-label="Close Navigator"
        >
          <X className="h-4 w-4 text-[#6B6B6B]" />
        </button>
      </div>
    </div>
  );
}
