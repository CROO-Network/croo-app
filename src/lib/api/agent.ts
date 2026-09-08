import { authedRequest } from "@/lib/http/client";

/** Backend `agent_type` for the system Navigator — hide from owner "My Agents" UI; list API still returns it for SDK. */
export function isNavigatorAgentType(agentType: string | undefined): boolean {
  return (agentType || "").toLowerCase() === "navigator";
}

/** Protobuf JSON (camelCase) for agent.AgentInfo */
export type AgentInfoJson = {
  agentId: string;
  userId: string;
  name: string;
  description: string;
  agentType: string;
  walletAddress: string;
  status: string;
  createdTime: string;
  controllerAddress: string;
  avatar: string;
  source: string;
  offlineReason: string;
  totalOrders?: number;
  totalVolumeMicro?: number;
  totalEarnedMicro?: number;
  completionRate?: number;
  walletBalanceUsdc?: string;
  avgDeliveryText?: string;
};

export type AgentServicePayloadJson = {
  serviceId: string;
  name: string;
  description: string;
  price: string | number;
  slaMinutes: number;
  requirementType: string;
  requirementText: string;
  requirementSchemaJson: string;
  deliverableType: string;
  deliverableText: string;
  deliverableSchemaJson: string;
  orderType: string;
  paymentToken: string;
  requireFundTransfer: boolean;
  priceModel: string;
  feePercentage: string;
};

export async function listMyAgents(params: { page?: number; page_size?: number } = {}) {
  const q = new URLSearchParams();
  q.set("page", String(params.page ?? 1));
  q.set("page_size", String(params.page_size ?? 50));
  return authedRequest<{ agents: AgentInfoJson[]; total: number }>(
    `/backend/v1/me/agents?${q.toString()}`,
  );
}

export type NavigatorInfoJson = {
  agentId: string;
  walletAddress: string;
  status: string;
};

export type NavigatorBalanceJson = {
  availableUsdc: string;
  escrowUsdc: string;
  cached: boolean;
  updatedAt: string;
};

export type GetMyNavigatorInfoResponseJson = {
  navigator?: NavigatorInfoJson;
  ownerAddress: string;
  balance?: NavigatorBalanceJson;
  deployStatus: string;
  loginMethod?: string;
};

export async function getMyNavigatorInfo(options?: { signal?: AbortSignal }) {
  return authedRequest<GetMyNavigatorInfoResponseJson>(`/backend/v1/me/navigator`, {
    signal: options?.signal,
  });
}

export type GetMyAgentResponseJson = {
  agent: AgentInfoJson;
  skillTags: string[];
  services: AgentServicePayloadJson[];
  /** Masked display only; absent/empty if no active SDK key. */
  sdkKey?: string;
  /** not_started | pending | submitted | success | failed */
  walletDeployStatus?: string;
};

export async function getMyAgent(agentId: string) {
  const id = encodeURIComponent(agentId);
  return authedRequest<GetMyAgentResponseJson>(`/backend/v1/me/agents/${id}`);
}

export type SDKKeyInfoJson = {
  keyId: string;
  agentId: string;
  sdkKey: string;
  name: string;
  status: string;
  lastUsedTime?: string;
  createdTime?: string;
};

/** Rotate the agent’s active SDK key; response contains the new full secret once. */
export async function rotateMyAgentSdkKey(agentId: string) {
  const id = encodeURIComponent(agentId);
  return authedRequest<{ sdkKey: SDKKeyInfoJson }>(`/backend/v1/me/agents/${id}/sdk-key/rotate`, {
    method: "POST",
    body: {},
  });
}

/** Reveal full SDK secret for configure page (after user confirmation in UI). */
export async function revealMyAgentSdkKey(agentId: string) {
  const id = encodeURIComponent(agentId);
  return authedRequest<{ sdkKey: string }>(`/backend/v1/me/agents/${id}/sdk-key/reveal`, {
    method: "POST",
    body: {},
  });
}

export type CreateAgentRequestJson = {
  name: string;
  description: string;
  avatar: string;
};

export type UserOpDataJson = {
  sender: string;
  nonce: string;
  factory: string;
  factoryData: string;
  callData: string;
  callGasLimit: string;
  verificationGasLimit: string;
  preVerificationGas: string;
  maxFeePerGas: string;
  maxPriorityFeePerGas: string;
  paymaster: string;
  paymasterData: string;
  paymasterVerificationGasLimit: string;
  paymasterPostOpGasLimit: string;
};

export type CreateAgentResponseJson = {
  agent: AgentInfoJson;
  walletDeployUserOp?: UserOpDataJson;
  walletDeployUserOpHash?: string;
  custodianDeployAaAddress?: string;
  custodianDeployTxHash?: string;
  custodianDeployStatus?: string;
  custodianDeployError?: string;
  /** Full SDK secret; show once in create-success UI. */
  sdkKey?: string;
};

export async function createAgent(body: CreateAgentRequestJson) {
  return authedRequest<CreateAgentResponseJson>(`/backend/v1/me/agents`, {
    method: "POST",
    body,
  });
}

/** Hard-delete agent still awaiting wallet AA deploy signature (user rejected signing). */
export async function abandonPendingAgent(agentId: string) {
  const id = encodeURIComponent(agentId);
  return authedRequest<Record<string, never>>(`/backend/v1/me/agents/${id}/abandon-pending`, {
    method: "POST",
    body: {},
  });
}

export type UpdateMyAgentRequestJson = {
  name: string;
  description: string;
  skillTags: string[];
  avatar: string;
  services: AgentServicePayloadJson[];
};

export async function updateMyAgent(agentId: string, body: UpdateMyAgentRequestJson) {
  const id = encodeURIComponent(agentId);
  return authedRequest<{
    agent: AgentInfoJson;
    skillTags: string[];
    services: AgentServicePayloadJson[];
  }>(`/backend/v1/me/agents/${id}`, {
    method: "PUT",
    body,
  });
}

/** Owner pause/resume — POST /backend/v1/me/agents/{id}/status (action pause|resume). */
export async function updateMyAgentStatus(agentId: string, action: "pause" | "resume") {
  const id = encodeURIComponent(agentId);
  return authedRequest<{ agent: AgentInfoJson }>(`/backend/v1/me/agents/${id}/status`, {
    method: "POST",
    body: { action },
  });
}

export async function getDeployUserOp(agentId: string) {
  return authedRequest<{ userOp: UserOpDataJson; userOpHash: string }>(
    "/backend/v1/agents/deploy-userop",
    {
      method: "POST",
      body: { agentId },
    },
  );
}

export async function submitSignedUserOp(agentId: string, userOpHash: string, signature: string) {
  return authedRequest<{ aaAddress: string; txHash: string; status: string }>(
    "/backend/v1/agents/deploy-userop/submit",
    {
      method: "POST",
      body: { agentId, userOpHash, signature },
    },
  );
}

export async function autoDeployUserOp(agentId: string) {
  return authedRequest<{ aaAddress: string; txHash: string; status: string }>(
    "/backend/v1/agents/deploy-userop/auto",
    {
      method: "POST",
      body: { agentId },
    },
  );
}

export async function prepareWithdrawUserOp(agentId: string, toAddress: string, amount: string) {
  return authedRequest<{ userOp: UserOpDataJson; userOpHash: string; taskId: string }>(
    "/backend/v1/agents/withdraw-userop",
    {
      method: "POST",
      body: { agentId, toAddress, amount },
    },
  );
}

export async function submitWithdrawUserOp(taskId: string, userOpHash: string, signature: string) {
  return authedRequest<{ useropHash: string; status: string }>(
    "/backend/v1/agents/withdraw-userop/submit",
    {
      method: "POST",
      body: { taskId, userOpHash, signature },
    },
  );
}

/** Custodial owner (e.g. Google): server signs and submits the prepared withdrawal UserOp. */
export async function submitWithdrawUserOpAuto(taskId: string, userOpHash: string) {
  return authedRequest<{ useropHash: string; status: string }>(
    "/backend/v1/agents/withdraw-userop/submit-auto",
    {
      method: "POST",
      body: { taskId, userOpHash },
    },
  );
}

/** Google / custodial: one POST — prepare + server sign + bundler submit (avoids double RPC burst). */
export async function custodialWithdrawUserOp(agentId: string, toAddress: string, amount: string) {
  return authedRequest<{ useropHash: string; status: string }>(
    "/backend/v1/agents/withdraw-userop/custodial",
    {
      method: "POST",
      body: { agentId, toAddress, amount },
    },
  );
}
