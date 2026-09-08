export const queryKeys = {
  auth: {
    root: ["auth"] as const,
    me: () => ["auth", "me"] as const,
  },
  agents: {
    root: ["agents"] as const,
    list: (params?: Record<string, unknown>) => ["agents", "list", params ?? {}] as const,
    detail: (agentId: string) => ["agents", "detail", agentId] as const,
    navigator: (userId?: string | null) =>
      userId ? (["agents", "navigator", userId] as const) : (["agents", "navigator"] as const),
  },
  orders: {
    root: ["orders"] as const,
    list: (params?: Record<string, unknown>) => ["orders", "list", params ?? {}] as const,
    detail: (orderId: string) => ["orders", "detail", orderId] as const,
  },
  stats: {
    root: ["stats"] as const,
    live: () => ["stats", "live"] as const,
    featuredAgents: () => ["stats", "featuredAgents"] as const,
  },
  campaign: {
    root: ["campaign"] as const,
    myFirstAgentConfig: () => ["campaign", "myFirstAgent", "config"] as const,
    myFirstAgentFeaturedXAgents: () => ["campaign", "myFirstAgent", "featuredXAgents"] as const,
    myFirstAgentLeaderboard: (page: number, pageSize: number) =>
      ["campaign", "myFirstAgent", "leaderboard", page, pageSize] as const,
    myFirstAgentLeaderboardEntry: (userId?: string | null) =>
      userId
        ? (["campaign", "myFirstAgent", "leaderboardEntry", userId] as const)
        : (["campaign", "myFirstAgent", "leaderboardEntry"] as const),
    myFirstAgentSummary: (userId?: string | null) =>
      userId
        ? (["campaign", "myFirstAgent", "summary", userId] as const)
        : (["campaign", "myFirstAgent", "summary"] as const),
    myFirstAgentPoints: (page: number, pageSize: number, userId?: string | null) =>
      userId
        ? (["campaign", "myFirstAgent", "points", page, pageSize, userId] as const)
        : (["campaign", "myFirstAgent", "points", page, pageSize] as const),
    myFirstAgentInvites: (page: number, pageSize: number, userId?: string | null) =>
      userId
        ? (["campaign", "myFirstAgent", "invites", page, pageSize, userId] as const)
        : (["campaign", "myFirstAgent", "invites", page, pageSize] as const),
  },
};
