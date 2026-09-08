"use client";

import { useRef, useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Wallet, ArrowRight } from "lucide-react";
import { useAccount, useAccountEffect, useSignMessage, useSwitchChain } from "wagmi";
import { useChain } from "@/lib/chain-context";
import { toWagmiChainId } from "@/lib/chains";
import { requestWalletChain } from "@/lib/wallet-chain-sync";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/components/shared/Toast";
import { getAuthErrorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export function ConnectModal({ externalOpen, onExternalOpenChange }: { externalOpen?: boolean; onExternalOpenChange?: (v: boolean) => void } = {}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [pendingMethod, setPendingMethod] = useState<"wallet" | "google" | null>(null);
  const autoSignRequestedRef = useRef(false);
  const autoSignedAddressRef = useRef<string | null>(null);
  const isControlled = externalOpen !== undefined;
  const open = isControlled ? externalOpen : internalOpen;
  const setOpen = isControlled ? (onExternalOpenChange ?? (() => {})) : setInternalOpen;
  const { loginWithWallet, session, startGoogleLogin, status } = useAuth();
  const { chain, meta } = useChain();
  const { showToast } = useToast();
  const { address } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const { switchChainAsync } = useSwitchChain();

  const resetWalletFlow = () => {
    autoSignRequestedRef.current = false;
    autoSignedAddressRef.current = null;
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && pendingMethod !== "wallet") {
      resetWalletFlow();
    }
    setOpen(nextOpen);
  };

  const handleWallet = async (walletAddr: string, source: "auto" | "manual" = "manual") => {
    if (pendingMethod) return;
    if (!walletAddr) {
      showToast("No wallet account was selected.");
      resetWalletFlow();
      return;
    }

    if (source === "auto") {
      autoSignedAddressRef.current = walletAddr.toLowerCase();
    }

    setPendingMethod("wallet");
    try {
      try {
        await requestWalletChain(switchChainAsync, toWagmiChainId(chain));
      } catch {
        showToast(`Please switch your wallet to ${meta.label} to sign in.`);
        resetWalletFlow();
        return;
      }
      await loginWithWallet(walletAddr, (message) =>
        signMessageAsync({
          message,
        }),
      );
      resetWalletFlow();
      setOpen(false);
    } catch (error) {
      resetWalletFlow();
      showToast(getAuthErrorMessage(error));
    } finally {
      setPendingMethod(null);
    }
  };

  const handleGoogle = async () => {
    if (pendingMethod) return;
    setPendingMethod("google");
    try {
      await startGoogleLogin();
    } catch (error) {
      showToast(getAuthErrorMessage(error));
      setPendingMethod(null);
    }
  };

  useAccountEffect({
    onConnect(data) {
      const connectedAddress = data.address?.toLowerCase();
      if (!connectedAddress) return;
      if (!autoSignRequestedRef.current) return;
      if (status === "authenticated" && session) {
        resetWalletFlow();
        return;
      }
      if (pendingMethod === "wallet") return;
      if (autoSignedAddressRef.current === connectedAddress) return;

      void handleWallet(data.address, "auto");
    },
    onDisconnect() {
      resetWalletFlow();
    },
  });

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {!isControlled && (
        <DialogTrigger
          render={
            <button className="bg-[#0F0F0F] text-white px-5 py-2 rounded-full hover:bg-[#1A1A1A] transition-all duration-200 text-sm font-medium cursor-pointer" />
          }
        >
          Connect
        </DialogTrigger>
      )}
      <DialogContent
        showCloseButton
        className="sm:max-w-[420px] bg-white border-[#E2E2E0] rounded-2xl p-0 gap-0"
      >
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle className="text-lg font-semibold text-[#0F0F0F]">
            Connect to CROO
          </DialogTitle>
          <p className="text-sm text-[#9A9A9A] mt-1">
            Choose how you&apos;d like to connect
          </p>
        </DialogHeader>

        <div className="px-6 pt-4 pb-6 flex flex-col gap-3">
          {/* Wallet */}
          <ConnectButton.Custom>
            {({ account, chain, mounted, openConnectModal }) => {
              const ready = mounted;
              const connected = ready && account && chain;
              const walletLabel = account?.address || address;

              return (
                <button
                  onClick={async () => {
                    if (!connected) {
                      autoSignRequestedRef.current = true;
                      autoSignedAddressRef.current = null;
                      openConnectModal?.();
                      return;
                    }

                    await handleWallet(account.address);
                  }}
                  disabled={!ready || pendingMethod !== null}
                  aria-busy={pendingMethod === "wallet"}
                  className="w-full h-12 bg-[#0F0F0F] text-white rounded-2xl hover:bg-[#1A1A1A] transition-all duration-200 font-medium text-sm flex items-center px-4 gap-3 cursor-pointer group disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <div className="w-8 h-8 rounded-xl bg-white/10 group-hover:bg-black/5 flex items-center justify-center shrink-0 transition-colors">
                    <Wallet className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1 text-left">
                    <span className="block truncate text-sm font-medium">
                      {pendingMethod === "wallet"
                        ? "Waiting for signature"
                        : connected
                          ? "Sign In with Wallet"
                          : "WalletConnect"}
                    </span>
                    <span className="block truncate text-[11px] opacity-60">
                      {connected && walletLabel
                        ? `${walletLabel.slice(0, 6)}...${walletLabel.slice(-4)}`
                        : "Connect your Web3 wallet"}
                    </span>
                  </div>
                  <ArrowRight className="h-4 w-4 opacity-40 group-hover:opacity-100 transition-opacity" />
                </button>
              );
            }}
          </ConnectButton.Custom>

          {/* Google */}
          <button
            onClick={handleGoogle}
            disabled={pendingMethod !== null}
            aria-busy={pendingMethod === "google"}
            className="w-full h-12 bg-white border border-[#E2E2E0] rounded-2xl hover:border-[#D0D0CE] hover:bg-[#F5F5F3] transition-all duration-200 font-medium text-sm flex items-center px-4 gap-3 text-[#0F0F0F] cursor-pointer group disabled:cursor-not-allowed disabled:opacity-60"
          >
            <div className="w-8 h-8 rounded-xl bg-[#F5F5F3] flex items-center justify-center shrink-0">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
            </div>
            <div className="flex-1 text-left">
              <span className="block text-sm font-medium">
                {pendingMethod === "google" ? "Opening Google" : "Google"}
              </span>
              <span className="block text-[11px] text-[#9A9A9A]">Sign in with Google account</span>
            </div>
            <ArrowRight className="h-4 w-4 text-[#9A9A9A] opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#E2E2E0]">
          <p className="text-[11px] text-[#9A9A9A] text-center">
            By connecting, you agree to our{" "}
            <a
              href="https://cap.croo.network/terms"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-[#6B6B6B]"
            >
              Terms of Service
            </a>
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
