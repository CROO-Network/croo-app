"use client";

import { useEffect } from "react";
import { useAccount, useSwitchChain } from "wagmi";
import { useChain } from "@/lib/chain-context";
import { toWagmiChainId } from "@/lib/chains";
import { requestWalletChain } from "@/lib/wallet-chain-sync";

/**
 * Keep the connected wallet on the same network as the app chain switcher.
 * App mode still changes if the wallet rejects the switch (BNB discovery
 * does not need a live wallet tx); Connect / Top Up retry their own switch.
 */
export function WalletChainSync() {
  const { chain, ready } = useChain();
  const { isConnected, chainId } = useAccount();
  const { switchChainAsync } = useSwitchChain();

  useEffect(() => {
    if (!ready || !isConnected) return;
    const target = toWagmiChainId(chain);
    if (chainId === target) return;
    void requestWalletChain(switchChainAsync, target).catch(() => {
      /* user rejected or the wallet cannot add the chain */
    });
    // chainId is read but omitted from deps: only app-mode / connect changes
    // should prompt the wallet. A manual MetaMask switch is not bounced back.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- see above
  }, [ready, chain, isConnected, switchChainAsync]);

  return null;
}
