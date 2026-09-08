import {
  startOrder,
  type StartOrderInput,
  type StartOrderResult,
} from "@/lib/navigator/api";
import { autoDeployUserOp, getMyNavigatorInfo } from "@/lib/api/agent";
import { isApiError } from "@/lib/http/errors";
import { pollNavigatorUntilActive } from "@/hooks/useNavigatorDeployUntilActive";
import type { WalletDeployResult } from "@/hooks/useWalletDeploy";

export type StartOrderReadinessPhase =
  | "starting"
  | "sign_deploy"
  | "awaiting_navigator"
  | "retrying";

export interface StartOrderWithReadinessOptions {
  loginMethod?: string;
  deployWallet: (agentId: string) => Promise<WalletDeployResult>;
  signal?: AbortSignal;
  onPhase?: (phase: StartOrderReadinessPhase) => void;
  onUserMessage?: (msg: string) => void;
}

const WARMING_UP_MESSAGE =
  "Wallet still warming up — retrying in a few seconds…";
const WALLET_DEPLOY_SUBMITTED_MESSAGE = "Wallet deploy submitted. Retrying order…";

export async function startOrderWithReadiness(
  input: StartOrderInput,
  options: StartOrderWithReadinessOptions,
): Promise<StartOrderResult> {
  const { loginMethod, deployWallet, signal, onPhase, onUserMessage } = options;

  onPhase?.("starting");
  try {
    return await startOrder(input, { signal });
  } catch (err) {
    if (signal?.aborted) throw err;
    if (!isApiError(err) || err.status !== 409) throw err;

    const effectiveLoginMethod = err.loginMethod ?? loginMethod;

    if (err.reason === "agent_creating") {
      const nav = await getMyNavigatorInfo();
      const navigatorAgentId = nav.navigator?.agentId?.trim();
      if (!navigatorAgentId) {
        throw new Error("Could not resolve your Navigator agent id.");
      }
      if (effectiveLoginMethod === "wallet") {
        onPhase?.("sign_deploy");
        await deployWallet(navigatorAgentId);
        onUserMessage?.(WALLET_DEPLOY_SUBMITTED_MESSAGE);
      } else {
        await autoDeployUserOp(navigatorAgentId);
        onUserMessage?.(WARMING_UP_MESSAGE);
      }
    } else {
      onUserMessage?.(WARMING_UP_MESSAGE);
    }

    onPhase?.("awaiting_navigator");
    await pollNavigatorUntilActive(signal);

    onPhase?.("retrying");
    return await startOrder(input, { signal });
  }
}
