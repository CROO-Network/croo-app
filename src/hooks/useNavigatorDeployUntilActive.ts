import { autoDeployUserOp, getMyAgent, getMyNavigatorInfo } from "@/lib/api/agent";
import type { WalletDeployResult } from "@/hooks/useWalletDeploy";

export const NAVIGATOR_DEPLOY_POLL_INTERVAL_MS = 3000;
export const NAVIGATOR_DEPLOY_POLL_TIMEOUT_MS = 90_000;

export type NavigatorDeployPhase = "deploying" | "sign_deploy" | "confirming_on_chain";

export class NavigatorDeployFailedError extends Error {
  constructor(message = "Wallet deployment failed. Please try again.") {
    super(message);
    this.name = "NavigatorDeployFailedError";
  }
}

export class NavigatorDeployTimeoutError extends Error {
  constructor(message = "Wallet deployment is taking longer than expected. Please try again in a moment.") {
    super(message);
    this.name = "NavigatorDeployTimeoutError";
  }
}

export function isNavigatorAaActive(status?: string): boolean {
  return (status ?? "").trim() === "active";
}

export function sleepAbortable(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason ?? new DOMException("aborted", "AbortError"));
      return;
    }
    const timer = setTimeout(resolve, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal?.reason ?? new DOMException("aborted", "AbortError"));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

/**
 * Poll GET /me/navigator until `navigator.status === 'active'`.
 *
 * Used both by the full deploy-then-poll flow (`deployNavigatorUntilActive`)
 * and by the order/start 409 path where the deploy was already triggered
 * elsewhere — server-side fire-and-forget for google/email custodials, or
 * a wallet `deployWallet` call the order pipeline made earlier.
 */
export async function pollNavigatorUntilActive(
  signal?: AbortSignal,
): Promise<void> {
  const pollStart = Date.now();
  while (Date.now() - pollStart < NAVIGATOR_DEPLOY_POLL_TIMEOUT_MS) {
    await sleepAbortable(NAVIGATOR_DEPLOY_POLL_INTERVAL_MS, signal);

    const nav = await getMyNavigatorInfo();
    if (isNavigatorAaActive(nav.navigator?.status)) {
      return;
    }
    if ((nav.deployStatus ?? "").trim() === "failed") {
      throw new NavigatorDeployFailedError();
    }
  }

  throw new NavigatorDeployTimeoutError();
}

export type DeployNavigatorUntilActiveOptions = {
  loginMethod?: string;
  deployWallet: (agentId: string) => Promise<WalletDeployResult>;
  signal?: AbortSignal;
  onPhase?: (phase: NavigatorDeployPhase) => void;
};

function isCustodialLoginMethod(loginMethod?: string): boolean {
  return loginMethod === "google" || loginMethod === "email";
}

/**
 * Deploys a non-Navigator agent wallet and polls that agent's deploy task.
 * Unlike Navigator readiness, this must never consult `/me/navigator`: the
 * source Agent and the user's Main Wallet have independent AA lifecycles.
 */
export async function deployAgentUntilActive(
  agentId: string,
  options: DeployNavigatorUntilActiveOptions,
): Promise<void> {
  const { loginMethod, deployWallet, signal, onPhase } = options;
  const id = agentId.trim();
  if (!id) {
    throw new Error("Missing agent id.");
  }

  onPhase?.("deploying");
  if (isCustodialLoginMethod(loginMethod)) {
    await autoDeployUserOp(id);
  } else {
    onPhase?.("sign_deploy");
    await deployWallet(id);
  }

  onPhase?.("confirming_on_chain");
  const pollStart = Date.now();
  while (Date.now() - pollStart < NAVIGATOR_DEPLOY_POLL_TIMEOUT_MS) {
    await sleepAbortable(NAVIGATOR_DEPLOY_POLL_INTERVAL_MS, signal);

    const agent = await getMyAgent(id);
    const deployStatus = (agent.walletDeployStatus ?? "").trim();
    if (deployStatus === "success") {
      return;
    }
    if (deployStatus === "failed") {
      throw new NavigatorDeployFailedError();
    }
  }

  throw new NavigatorDeployTimeoutError();
}

/**
 * Submits Navigator AA deploy (Google auto / wallet sign) then polls
 * GET /me/navigator until navigator.status is active.
 */
export async function deployNavigatorUntilActive(
  agentId: string,
  options: DeployNavigatorUntilActiveOptions,
): Promise<void> {
  const { loginMethod, deployWallet, signal, onPhase } = options;
  const id = agentId.trim();
  if (!id) {
    throw new Error("Missing Navigator agent id.");
  }

  onPhase?.("deploying");

  if (isCustodialLoginMethod(loginMethod)) {
    await autoDeployUserOp(id);
  } else {
    onPhase?.("sign_deploy");
    await deployWallet(id);
  }

  onPhase?.("confirming_on_chain");
  await pollNavigatorUntilActive(signal);
}
