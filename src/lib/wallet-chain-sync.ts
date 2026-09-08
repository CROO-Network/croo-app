/**
 * Coalesce app → wallet network switches so Connect and WalletChainSync
 * cannot fire two `wallet_switchEthereumChain` prompts for the same target.
 */
let inflight: { chainId: number; promise: Promise<void> } | null = null;

export function requestWalletChain(
  switchChainAsync: (args: { chainId: number }) => Promise<unknown>,
  chainId: number,
): Promise<void> {
  if (inflight?.chainId === chainId) return inflight.promise;

  const promise = switchChainAsync({ chainId })
    .then(() => undefined)
    .finally(() => {
      if (inflight?.promise === promise) inflight = null;
    });

  inflight = { chainId, promise };
  return promise;
}
