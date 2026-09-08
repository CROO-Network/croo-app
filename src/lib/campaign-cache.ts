import type { QueryClient } from "@tanstack/react-query";
import type { MyFirstAgentSummaryJson } from "@/lib/api/campaign";
import { queryKeys } from "@/lib/query/keys";

export function invalidateMyFirstAgentCampaign(queryClient: QueryClient) {
  void queryClient.invalidateQueries({
    queryKey: queryKeys.campaign.myFirstAgentSummary(),
  });
  void queryClient.invalidateQueries({
    queryKey: queryKeys.campaign.myFirstAgentLeaderboardEntry(),
  });
  void queryClient.invalidateQueries({
    queryKey: queryKeys.campaign.root,
  });
}

export function markMyFirstAgentTopUpCompleted(
  queryClient: QueryClient,
  completedAt = new Date().toISOString(),
) {
  queryClient.setQueriesData<MyFirstAgentSummaryJson>(
    { queryKey: queryKeys.campaign.myFirstAgentSummary() },
    (summary) => {
      if (!summary) return summary;

      return {
        ...summary,
        tasks: {
          ...summary.tasks,
          topUp: {
            ...summary.tasks?.topUp,
            completed: true,
            completedAt: summary.tasks?.topUp?.completedAt || completedAt,
          },
        },
      };
    },
  );
}
