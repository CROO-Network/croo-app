"use client";

/* eslint-disable @next/next/no-img-element */

import CopyButton from "@/components/shared/CopyButton";
import Reveal from "@/components/shared/Reveal";
import SectionHeader from "@/components/shared/SectionHeader";
import TopUpModal from "@/components/shared/TopUpModal";
import WithdrawModal from "@/components/shared/WithdrawModal";
import { XLogo } from "@/components/campaign/icons";
import { useAuth } from "@/lib/auth";
import { loggedInUserAvatarSrc } from "@/lib/avatar-display";
import { truncateAddress } from "@/lib/formatters";
import { getMyNavigatorInfo } from "@/lib/api/agent";
import { useTwitterBinding } from "@/hooks/useTwitterBinding";
import { useCallback, useEffect, useMemo, useState } from "react";

/* ── Account header card ───────────────────────── */

function AccountHeader() {
  const { session } = useAuth();
  const [navigator, setNavigator] = useState<{
    agentId: string;
    walletAddress: string;
    ownerAddress: string;
    availableUsdc: string;
    escrowUsdc: string;
  } | null>(null);

  const refreshNavigator = useCallback(async (previousBalance: number) => {
    if (!session) {
      return false;
    }
    try {
      const res = await getMyNavigatorInfo();
      if (!res.navigator) {
        setNavigator(null);
        return true;
      }
      const availableUsdc = res.balance?.availableUsdc || "0.00";
      setNavigator({
        agentId: res.navigator.agentId,
        walletAddress: res.navigator.walletAddress || "",
        ownerAddress: res.ownerAddress || "",
        availableUsdc,
        escrowUsdc: res.balance?.escrowUsdc || "0.00",
      });
      const nextBalance = Number.parseFloat(availableUsdc);
      return Number.isFinite(nextBalance) && Math.abs(nextBalance - previousBalance) > 1e-9;
    } catch {
      return false;
    }
  }, [session]);

  useEffect(() => {
    if (!session) {
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await getMyNavigatorInfo();
        if (cancelled) return;
        if (!res.navigator) {
          setNavigator(null);
          return;
        }
        setNavigator({
          agentId: res.navigator.agentId,
          walletAddress: res.navigator.walletAddress || "",
          ownerAddress: res.ownerAddress || "",
          availableUsdc: res.balance?.availableUsdc || "0.00",
          escrowUsdc: res.balance?.escrowUsdc || "0.00",
        });
      } catch {
        if (!cancelled) setNavigator(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session]);

  const activeNavigator = session ? navigator : null;

  const loginMethod = session?.loginMethod ?? "";
  const identifier = session?.identifier ?? "";
  const isWallet = loginMethod === "wallet";
  const isGoogle = loginMethod === "google";
  const avatar = loggedInUserAvatarSrc({
    avatar: session?.userInfo.avatar,
    googlePicture: session?.userInfo.googlePicture,
    isGoogleLogin: isGoogle,
    userId: session?.userId ?? "account",
  });
  const ownerWallet = activeNavigator?.ownerAddress || session?.userInfo.walletAddr || "";
  const navigatorWallet = activeNavigator?.walletAddress || "";
  // Title shows the user's identity (email for Web2, AA wallet for Web3).
  // AA & Owner addresses are rendered as labelled rows below so the user can
  // never mistake the Owner EOA for a deposit target.
  const accountTitle = useMemo(() => {
    if (isWallet) return navigatorWallet ? truncateAddress(navigatorWallet) : truncateAddress(ownerWallet);
    return identifier || session?.userInfo.googleName || "";
  }, [isWallet, navigatorWallet, ownerWallet, identifier, session?.userInfo.googleName]);

  const mainWalletWithdrawBalance = useMemo(() => {
    const raw = String(activeNavigator?.availableUsdc ?? "").trim();
    const n = Number.parseFloat(raw);
    return Number.isFinite(n) ? n : 0;
  }, [activeNavigator?.availableUsdc]);
  const escrowBalance = useMemo(() => {
    const raw = String(activeNavigator?.escrowUsdc ?? "").trim();
    const n = Number.parseFloat(raw);
    return Number.isFinite(n) ? n : 0;
  }, [activeNavigator?.escrowUsdc]);

  if (!session) return null;

  return (
    <div className="rounded-2xl border border-[#E2E2E0] bg-white">
      <div className="px-7 py-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          {/* Left: identity */}
          <div className="flex items-start gap-4">
            {/* Avatar with optional Google badge */}
            <div className="relative shrink-0">
              <img
                src={avatar}
                alt="Avatar"
                className="h-11 w-11 rounded-full border border-[#E2E2E0] bg-[#F5F5F3]"
              />
              {isGoogle && (
                <div className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-white">
                  <svg width="12" height="12" viewBox="0 0 24 24" className="shrink-0">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                  </svg>
                </div>
              )}
            </div>
            <div className="min-w-0 space-y-1.5">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-medium text-[#0F0F0F]">
                  {accountTitle}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-mono uppercase tracking-wider text-[#9A9A9A]">AA Wallet</span>
                <span className="text-xs text-[#9A9A9A]">
                  {navigatorWallet ? truncateAddress(navigatorWallet) : "—"}
                </span>
                {navigatorWallet && <CopyButton value={navigatorWallet} />}
              </div>
              <div className="flex items-start gap-1.5 pl-2">
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 10 10"
                  fill="none"
                  className="mt-0.5 shrink-0 text-[#C4C4C2]"
                  aria-hidden="true"
                >
                  <path d="M1 1v6h6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-[#9A9A9A]">Owner</span>
                  <span className="text-xs text-[#9A9A9A]">
                    {ownerWallet ? truncateAddress(ownerWallet) : "—"}
                  </span>
                  {ownerWallet && <CopyButton value={ownerWallet} />}
                  {isWallet ? (
                    <span className="rounded bg-[#6EE646]/10 px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-wider text-[#3D8C1F]">
                      Connected
                    </span>
                  ) : (
                    <span
                      className="rounded bg-[#F5F5F3] px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-wider text-[#9A9A9A]"
                      title="Managed by CROO — don't send funds to this address"
                    >
                      Managed by CROO
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Right: Main Wallet balance + actions */}
          <div className="text-right">
            <p className="mb-1 text-[9px] font-mono uppercase tracking-wider text-[#9A9A9A]">Main Wallet</p>
            <p className="text-2xl font-semibold text-[#0F0F0F] font-mono tabular-nums">
              ${activeNavigator?.availableUsdc || "0.00"}
            </p>
            {escrowBalance > 0 && (
              <p className="mt-0.5 text-[11px] text-[#9A9A9A] font-mono tabular-nums">
                ${activeNavigator?.escrowUsdc || "0.00"}{" "}
                <span className="group relative inline-block border-b border-dotted border-[#9A9A9A] cursor-help">
                  in escrow
                  <span className="pointer-events-none absolute bottom-full left-1/2 mb-1.5 -translate-x-1/2 w-52 rounded-lg bg-[#0F0F0F] px-3 py-2 text-[11px] font-sans font-normal leading-snug text-white opacity-0 transition-opacity duration-150 group-hover:opacity-100 whitespace-normal text-center">
                    These funds are locked in active orders and will be automatically released to the provider once the order is completed.
                    <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[#0F0F0F]"></span>
                  </span>
                </span>
              </p>
            )}
            <div className="mt-3 flex items-center justify-end gap-1.5">
              {navigatorWallet ? (
                <TopUpModal walletLabel="Main Wallet" walletAddress={navigatorWallet}>
                  <button className="h-7 rounded-full bg-[#0F0F0F] px-4 text-[11px] font-medium text-white transition-colors hover:bg-[#1A1A1A] cursor-pointer">
                    Top Up
                  </button>
                </TopUpModal>
              ) : (
                <button
                  disabled
                  title="Navigator wallet is being prepared — try again in a moment"
                  className="h-7 rounded-full bg-[#E2E2E0] px-4 text-[11px] font-medium text-[#9A9A9A] cursor-not-allowed"
                >
                  Top Up
                </button>
              )}
              {navigatorWallet ? (
                <WithdrawModal
                  agentId={navigator?.agentId}
                  sourceKind="navigator"
                  walletLabel="Main Wallet"
                  walletAddress={navigatorWallet}
                  balance={mainWalletWithdrawBalance}
                  onWithdrawSubmitted={refreshNavigator}
                >
                  <button className="h-7 rounded-full border border-[#E2E2E0] px-4 text-[11px] font-medium text-[#6B6B6B] transition-colors hover:border-[#9A9A9A] hover:text-[#0F0F0F] cursor-pointer">
                    Withdraw
                  </button>
                </WithdrawModal>
              ) : (
                <button
                  disabled
                  title="Navigator wallet is being prepared — try again in a moment"
                  className="h-7 rounded-full border border-[#E2E2E0] bg-white px-4 text-[11px] font-medium text-[#C5C5C3] cursor-not-allowed"
                >
                  Withdraw
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
      <TwitterRow />
    </div>
  );
}

/* ── Twitter binding row ───────────────────────── */

function TwitterRow() {
  const {
    twitterHandle,
    connecting,
    connectTwitter,
  } = useTwitterBinding();

  return (
    <div className="flex items-center justify-between gap-4 border-t border-[#EBEBEA] px-7 py-5">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#E2E2E0] bg-[#F5F5F3] text-[#0F0F0F]">
          <XLogo className="h-[18px] w-[18px]" />
        </span>
        <div>
          <p className="text-sm font-medium text-[#0F0F0F]">X (Twitter)</p>
          {twitterHandle ? (
            <p className="font-mono text-xs text-[#9A9A9A]">
              @{twitterHandle}
            </p>
          ) : (
            <p className="text-xs text-[#9A9A9A]">Not connected</p>
          )}
        </div>
      </div>

      {twitterHandle ? (
        <span className="inline-flex items-center gap-1 rounded-full bg-[#F0FDE8] px-3 py-1 text-[11px] font-medium text-[#3D8C1F]">
          ✓ Connected
        </span>
      ) : (
        <button
          onClick={connectTwitter}
          disabled={connecting}
          className="inline-flex h-7 items-center gap-1.5 rounded-full bg-[#0F0F0F] px-4 text-[11px] font-medium text-white transition-colors hover:bg-[#1A1A1A] disabled:opacity-60"
        >
          {connecting ? (
            "Connecting..."
          ) : (
            <>
              <XLogo className="h-3 w-3" />
              Connect
            </>
          )}
        </button>
      )}
    </div>
  );
}

/* ── Page ───────────────────────────────────────── */

export default function AccountPage() {
  return (
    <div className="space-y-8">
      <Reveal>
        <SectionHeader label="Account" />
        <AccountHeader />
      </Reveal>
    </div>
  );
}
