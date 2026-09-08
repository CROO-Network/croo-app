import { QueryClient } from "@tanstack/react-query";
import { isApiError } from "@/lib/http/errors";

function shouldRetry(failureCount: number, error: unknown) {
  if (isApiError(error)) {
    if (error.status === 0 || error.status === 401 || error.status === 403 || error.status === 404) {
      return false;
    }
  }

  return failureCount < 2;
}

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        retry: shouldRetry,
      },
      mutations: {
        retry: false,
      },
    },
  });
}
