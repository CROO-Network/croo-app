"use client";

import "@rainbow-me/rainbowkit/styles.css";

import {
  RainbowKitProvider,
  getDefaultConfig,
  lightTheme,
} from "@rainbow-me/rainbowkit";
import {
  baseAccount,
  binanceWallet,
  metaMaskWallet,
  rainbowWallet,
  safeWallet,
  walletConnectWallet,
} from "@rainbow-me/rainbowkit/wallets";
import { QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { createConfig, http, WagmiProvider } from "wagmi";
import { base, bsc } from "wagmi/chains";
import { useChain } from "@/lib/chain-context";
import { toWagmiChainId } from "@/lib/chains";
import { createQueryClient } from "@/lib/query/client";

/** RainbowKit default Popular list, with Binance Web3 Wallet pinned first. */
const wallets = [
  {
    groupName: "Popular",
    wallets: [
      binanceWallet,
      safeWallet,
      rainbowWallet,
      baseAccount,
      metaMaskWallet,
      walletConnectWallet,
    ],
  },
];

const projectId =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ||
  "750ae11a5990e06f8106eedbc777094c";

/** BNB first so a fresh connect follows the app default (BNB Chain mode). */
const chains = [bsc, base] as const;
const transports = {
  [bsc.id]: http(),
  [base.id]: http(),
};

const rainbowTheme = lightTheme({
  accentColor: "#6EE646",
  accentColorForeground: "#0F0F0F",
  borderRadius: "large",
  overlayBlur: "small",
});

// WalletConnect accesses indexedDB at init time, which is unavailable during SSR.
// Use a minimal wagmi config on the server; full RainbowKit config on the client.
const config =
  typeof window !== "undefined"
    ? getDefaultConfig({
        appName: "CROO",
        projectId,
        chains,
        transports,
        wallets,
        ssr: true,
      })
    : createConfig({
        chains,
        transports,
        ssr: true,
      });

export function Web3Provider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(createQueryClient);

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}

/** Must sit under ChainProvider so Connect asks for the current app chain. */
export function RainbowKitAppProvider({ children }: { children: ReactNode }) {
  const { chain } = useChain();

  return (
    <RainbowKitProvider
      initialChain={toWagmiChainId(chain)}
      modalSize="compact"
      theme={rainbowTheme}
    >
      {children}
    </RainbowKitProvider>
  );
}
