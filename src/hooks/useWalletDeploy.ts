"use client";

import { useCallback } from "react";
import { useAccount, useSignMessage } from "wagmi";
import {
  getDeployUserOp,
  submitSignedUserOp,
} from "@/lib/api/agent";
import { useAuth } from "@/lib/auth";
import { userOpHashSignMessageArgs } from "@/lib/wagmi-sign-user-op";

export interface WalletDeployResult {
  aaAddress: string;
  txHash: string;
  status: string;
}

/**
 * Wallet (EOA) AA deploy flow shared by WithdrawModal / TopUpModal /
 * SchemaFormCard. Walks the three-step backend handshake:
 *   1. POST /agents/deploy-userop        → unsigned UserOp + hash
 *   2. wagmi personal_sign on the hash   → EOA signature
 *   3. POST /agents/deploy-userop/submit → returns submitted state
 *
 * Custodial (google/email) deploy is a one-call backend operation; use
 * `autoDeployUserOp` directly instead of this hook.
 */
export function useWalletDeploy() {
  const { session } = useAuth();
  const { address } = useAccount();
  const { signMessageAsync } = useSignMessage();

  const deployWallet = useCallback(
    async (agentId: string): Promise<WalletDeployResult> => {
      const loginWallet = session?.userInfo.walletAddr?.trim();
      const connectedWallet = address?.trim();
      if (!loginWallet) {
        throw new Error("Login wallet is missing. Please sign in again.");
      }
      if (!connectedWallet) {
        throw new Error("Please connect your login wallet before signing.");
      }
      if (connectedWallet.toLowerCase() !== loginWallet.toLowerCase()) {
        throw new Error("Please switch to the wallet you used to sign in.");
      }

      const prepared = await getDeployUserOp(agentId);
      const signature = await signMessageAsync(
        userOpHashSignMessageArgs(prepared.userOpHash),
      );
      return submitSignedUserOp(agentId, prepared.userOpHash, signature);
    },
    [address, session?.userInfo.walletAddr, signMessageAsync],
  );

  return { deployWallet };
}
