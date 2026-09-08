import {
  custodialWithdrawUserOp,
  prepareWithdrawUserOp,
  submitWithdrawUserOp,
} from "@/lib/api/agent";
import { userOpHashSignMessageArgs } from "@/lib/wagmi-sign-user-op";

export type ExecuteNavigatorWithdrawParams = {
  agentId: string;
  toAddress: string;
  amountMicro: string;
  loginMethod?: string;
  signMessageAsync: (args: ReturnType<typeof userOpHashSignMessageArgs>) => Promise<`0x${string}`>;
  onSignWithdraw?: () => void;
};

export async function executeNavigatorWithdraw(params: ExecuteNavigatorWithdrawParams): Promise<void> {
  const { agentId, toAddress, amountMicro, loginMethod, signMessageAsync, onSignWithdraw } = params;

  if (loginMethod === "google") {
    await custodialWithdrawUserOp(agentId, toAddress, amountMicro);
    return;
  }

  const prepared = await prepareWithdrawUserOp(agentId, toAddress, amountMicro);
  onSignWithdraw?.();
  const signature = await signMessageAsync(userOpHashSignMessageArgs(prepared.userOpHash));
  await submitWithdrawUserOp(prepared.taskId, prepared.userOpHash, signature);
}
