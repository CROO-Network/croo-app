import { authedRequest, publicRequest } from "@/lib/http/client";

export type CampaignStatus = "not_started" | "active" | "ended" | "disabled";

export type CampaignConfigJson = {
  status: CampaignStatus | string;
  startAt: string;
  endAt: string;
  serverTime: string;
  points?: {
    createAccount?: number;
    connectX?: number;
    topUp?: number;
    invite?: number;
    agentStoreOrder?: number;
    xOrder?: number;
  };
  weeklyCaps?: {
    agentStoreOrder?: number;
    xOrder?: number;
  };
};

export type CampaignLeaderboardEntryJson = {
  rank: number;
  userId: string;
  identifier: string;
  avatar: string;
  points: number;
  tier: string;
  reward: string;
  isMe?: boolean;
};

export type CampaignLeaderboardJson = {
  entries: CampaignLeaderboardEntryJson[];
  total: number | string;
  page: number;
  pageSize: number;
};

export type MyCampaignLeaderboardEntryJson = {
  entry?: CampaignLeaderboardEntryJson;
};

export type CampaignFeaturedXAgentJson = {
  agentId: string;
  name: string;
  avatar: string;
  handle: string;
  blurb: string;
  tags: string[];
  fromPrice: string;
  serviceName: string;
  requiredFields: string[];
  templateText: string;
};

export type CampaignFeaturedXAgentsJson = {
  agents: CampaignFeaturedXAgentJson[];
};

export type CampaignProfileJson = {
  userId: string;
  identifier: string;
  avatar: string;
  points: number;
  rank: number;
  tier: string;
  reward: string;
};

export type CampaignTwitterStatusJson = {
  connected: boolean;
  twitterId: string;
  username: string;
  name: string;
  profileImageUrl: string;
  verifiedAt: string;
};

export type CampaignOneTimeTaskStatusJson = {
  completed: boolean;
  completedAt: string;
};

export type CampaignInviteTaskStatusJson = {
  settledCount: number;
  points: number;
};

export type CampaignWeeklyTaskStatusJson = {
  completedThisWeek: number;
  weeklyCap: number;
  weekStart: string;
  weekEnd: string;
};

export type CampaignTaskSummaryJson = {
  createAccount?: CampaignOneTimeTaskStatusJson;
  connectX?: CampaignOneTimeTaskStatusJson;
  topUp?: CampaignOneTimeTaskStatusJson;
  invite?: CampaignInviteTaskStatusJson;
  agentStoreOrder?: CampaignWeeklyTaskStatusJson;
  xOrder?: CampaignWeeklyTaskStatusJson;
};

export type CampaignInviteInfoJson = {
  refCode: string;
  inviteUrl: string;
};

export type MyFirstAgentSummaryJson = {
  profile?: CampaignProfileJson;
  twitterStatus?: CampaignTwitterStatusJson;
  tasks?: CampaignTaskSummaryJson;
  invite?: CampaignInviteInfoJson;
};

export type CampaignPointEntryJson = {
  id: string;
  createdAt: string;
  delta: number;
  source: string;
  sourceLabel: string;
  relatedEntity: string;
};

export type ListMyFirstAgentPointsJson = {
  entries: CampaignPointEntryJson[];
  total: number | string;
  totalPoints: number;
  page: number;
  pageSize: number;
};

export type CampaignInviteRecordJson = {
  inviteeUserId: string;
  inviteeIdentifier: string;
  settledAt: string;
  points: number;
};

export type ListMyFirstAgentInvitesJson = {
  entries: CampaignInviteRecordJson[];
  total: number | string;
  page: number;
  pageSize: number;
};

export type BindMyFirstAgentReferralJson = {
  accepted: boolean;
  reason: string;
};

export type ScanMyFirstAgentTopUpJson = {
  accepted: boolean;
  settled: boolean;
  pointsDelta: number;
  reason: string;
  scannedFromBlock?: number | string;
  scannedToBlock?: number | string;
  eventsFound?: number;
  totalAmount?: string;
};

export type SyncMyFirstAgentTasksJson = {
  accepted: boolean;
  synced: boolean;
  reason: string;
};

export function getMyFirstAgentConfig() {
  return publicRequest<CampaignConfigJson>("/backend/v1/campaign/my-first-agent/config");
}

export function getMyFirstAgentLeaderboard(page = 1, pageSize = 20) {
  const q = new URLSearchParams({
    page: String(page),
    page_size: String(pageSize),
  });
  return publicRequest<CampaignLeaderboardJson>(
    `/backend/v1/campaign/my-first-agent/leaderboard?${q}`,
  );
}

export function getMyFirstAgentLeaderboardEntry() {
  return authedRequest<MyCampaignLeaderboardEntryJson>(
    "/backend/v1/campaign/my-first-agent/me/leaderboard-entry",
  );
}

export function listMyFirstAgentFeaturedXAgents() {
  return publicRequest<CampaignFeaturedXAgentsJson>(
    "/backend/v1/campaign/my-first-agent/featured-x-agents",
  );
}

export function getMyFirstAgentSummary() {
  return authedRequest<MyFirstAgentSummaryJson>(
    "/backend/v1/campaign/my-first-agent/me/summary",
  );
}

export function syncMyFirstAgentTasks() {
  return authedRequest<SyncMyFirstAgentTasksJson>(
    "/backend/v1/campaign/my-first-agent/me/sync",
    {
      method: "POST",
      body: {},
    },
  );
}

export function listMyFirstAgentPoints(page = 1, pageSize = 10) {
  const q = new URLSearchParams({
    page: String(page),
    page_size: String(pageSize),
  });
  return authedRequest<ListMyFirstAgentPointsJson>(
    `/backend/v1/campaign/my-first-agent/me/points?${q}`,
  );
}

export function listMyFirstAgentInvites(page = 1, pageSize = 10) {
  const q = new URLSearchParams({
    page: String(page),
    page_size: String(pageSize),
  });
  return authedRequest<ListMyFirstAgentInvitesJson>(
    `/backend/v1/campaign/my-first-agent/me/invites?${q}`,
  );
}

export function bindMyFirstAgentReferral(refCode: string) {
  return authedRequest<BindMyFirstAgentReferralJson>(
    "/backend/v1/campaign/my-first-agent/referral/bind",
    {
      method: "POST",
      body: {
        refCode,
      },
    },
  );
}

export function scanMyFirstAgentTopUp() {
  return authedRequest<ScanMyFirstAgentTopUpJson>(
    "/backend/v1/campaign/my-first-agent/me/top-up/scan",
    {
      method: "POST",
      body: {},
    },
  );
}
