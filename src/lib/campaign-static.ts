export type TaskType = "one-time" | "weekly" | "unlimited";
export type Tier = "Master" | "Expert" | "Journeyman" | "Apprentice";

export function tierForRank(rank: number): Tier {
  if (rank <= 10) return "Master";
  if (rank <= 100) return "Expert";
  if (rank <= 1000) return "Journeyman";
  return "Apprentice";
}

export const TIER_META: Record<
  Tier,
  { label: string; reward: string; rankLabel: string }
> = {
  Master: {
    label: "Master",
    reward: "Master Badge + 100 USDC + Store Feature",
    rankLabel: "TOP 10",
  },
  Expert: {
    label: "Expert",
    reward: "Expert Badge + 20 USDC",
    rankLabel: "TOP 100",
  },
  Journeyman: {
    label: "Journeyman",
    reward: "Journeyman Badge",
    rankLabel: "TOP 1000",
  },
  Apprentice: {
    label: "Apprentice",
    reward: "Apprentice Badge",
    rankLabel: "All",
  },
};

export interface CampaignTaskState {
  id: string;
  title: string;
  shortTitle?: string;
  description: string;
  type: TaskType;
  pointsPerCompletion: number;
  kind?: "account" | "connectX" | "topup";
  weeklyCap?: number;
  requiresTwitter?: boolean;
  ctaLabel?: string;
  ctaTarget?: string;
}

export const campaignOneTimeTasks: CampaignTaskState[] = [
  {
    id: "O1",
    title: "Create your account",
    shortTitle: "Create account",
    description: "Sign up with a wallet or email.",
    type: "one-time",
    pointsPerCompletion: 5,
    kind: "account",
    ctaLabel: "Connect",
  },
  {
    id: "O2",
    title: "Connect your X account",
    shortTitle: "Connect X",
    description: "Unlocks ordering on X and invite rewards.",
    type: "one-time",
    pointsPerCompletion: 5,
    kind: "connectX",
  },
  {
    id: "O3",
    title: "Top up your Agent Wallet",
    shortTitle: "Top up ≥ 1 USDC",
    description: "Fund your Agent's 4337 wallet so it can pay on its own.",
    type: "one-time",
    pointsPerCompletion: 5,
    kind: "topup",
    ctaLabel: "Top Up",
  },
];

export const campaignRepeatTasks: CampaignTaskState[] = [
  {
    id: "R1",
    title: "Invite friends to join & complete onboarding",
    description: "Earn points when an invitee creates an account and tops up.",
    type: "unlimited",
    pointsPerCompletion: 5,
  },
  {
    id: "R2",
    title: "Buy a service in the Agent Store",
    description: "Order a service from any Agent to complete this task.",
    type: "weekly",
    pointsPerCompletion: 5,
    weeklyCap: 5,
    ctaLabel: "Go to Agent Store",
    ctaTarget: "/",
  },
  {
    id: "R3",
    title: "Order an Agent service on X",
    description: "Tag a featured Agent on X and pay to complete an order.",
    type: "weekly",
    pointsPerCompletion: 5,
    weeklyCap: 3,
    requiresTwitter: true,
  },
];

export interface FeaturedAgentOnX {
  agentId: string;
  name: string;
  avatar: string;
  handle: string;
  blurb: string;
  tags: string[];
  fromPrice: number;
  serviceName: string;
  requiredFields: string[];
  templateText?: string;
}

export function buildXOrderTweet(a: FeaturedAgentOnX): string {
  const apiTemplate = a.templateText?.trim();
  if (apiTemplate) return apiTemplate;

  const fields = a.requiredFields.map((f) => `• ${f}: [ ]`).join("\n");
  return [
    `Hi @${a.handle} I'd like to order:`,
    `Service: ${a.serviceName} (${a.fromPrice} USDC)`,
    fields,
    `#x402 #CROO #MyFirstAgent`,
  ]
    .filter(Boolean)
    .join("\n");
}

export interface PointsHistoryEntry {
  id: string;
  timestamp: string;
  delta: number;
  sourceLabel: string;
  relatedEntity?: string;
}

export interface LeaderboardEntry {
  rank: number;
  userId?: string;
  identifier: string;
  avatar: string;
  points: number;
  isMe?: boolean;
}
