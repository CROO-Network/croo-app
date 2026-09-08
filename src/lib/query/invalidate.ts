import type { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";

export function invalidateNavigatorWallet(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: ["navigator", "balance"] });
  void queryClient.invalidateQueries({ queryKey: ["me", "navigator"] });
  void queryClient.invalidateQueries({ queryKey: queryKeys.agents.navigator() });
}
