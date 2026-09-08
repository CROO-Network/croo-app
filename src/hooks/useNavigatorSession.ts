"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { getNavigatorSession } from "@/lib/navigator/api";
import { useNavigator } from "@/lib/navigator-context";
import { useChain } from "@/lib/chain-context";

/**
 * Fetch & cache the current user's single stable Navigator session id.
 *
 * - Query key is scoped by userId so accounts stay isolated
 * - `staleTime: Infinity`: the server upserts the sessionId per user, so its
 *   lifetime equals the auth session
 * - On success the sessionId is written back to NavigatorContext; other hooks
 *   read it from context
 */
export function useNavigatorSession() {
  const { session, status } = useAuth();
  const { dispatch, sessionId: cachedSessionId } = useNavigator();
  const { chain } = useChain();

  const enabled = status === "authenticated" && Boolean(session?.userId);

  const query = useQuery({
    queryKey: ["navigator", "session", session?.userId ?? null, chain],
    queryFn: () => getNavigatorSession(chain),
    enabled,
    staleTime: Infinity,
    gcTime: Infinity,
  });

  const fetchedSessionId = query.data?.sessionId ?? null;

  useEffect(() => {
    dispatch({ type: "set_session", sessionId: null });
  }, [chain, dispatch]);

  useEffect(() => {
    if (fetchedSessionId && fetchedSessionId !== cachedSessionId) {
      dispatch({ type: "set_session", sessionId: fetchedSessionId });
    }
  }, [fetchedSessionId, cachedSessionId, dispatch]);

  useEffect(() => {
    if (status === "unauthenticated" && cachedSessionId) {
      dispatch({ type: "reset" });
    }
  }, [status, cachedSessionId, dispatch]);

  return {
    sessionId: fetchedSessionId,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}
