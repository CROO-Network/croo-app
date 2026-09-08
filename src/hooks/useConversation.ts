"use client";

import {
  useInfiniteQuery,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import { getSnapshot } from "@/lib/navigator/api";
import { buildStreamUrl, createSSEStream, SSEError } from "@/lib/navigator/sse";
import { useNavigator } from "@/lib/navigator-context";
import { ApiError } from "@/lib/http/errors";
import { useToast } from "@/components/shared/Toast";
import type {
  AssistantMessagePayload,
  CardEventPayload,
  CardPayload,
  ChatMessage,
  ErrorPayload,
  RunStatus,
  SnapshotPage,
  SSEEvent,
} from "@/types/navigator";

const MAX_RECONNECT_ATTEMPTS = 5;
/** Default page size for snapshot waterfall pagination. */
const SNAPSHOT_PAGE_SIZE = 20;
/**
 * If the active SSE run produces no events for this long, we
 * surface a "Taking longer than expected…" banner with a Retry button.
 * We don't tear down the stream — it might still complete; the banner
 * just lets the user kick a manual reconnect if it feels stuck.
 */
const STALL_TIMEOUT_MS = 30_000;

type SnapshotInfinite = InfiniteData<SnapshotPage, number | undefined>;

function snapshotQueryKey(sessionId: string | null) {
  return ["navigator", "snapshot", sessionId] as const;
}

/**
 * Flatten an InfiniteData<SnapshotPage> into a single sequence-ASC list
 * with one entry per message id. Pages arrive in load order
 * `[latest, older, older…]`; within each page, messages are already ASC.
 * We dedup by id (last write wins) so refetched first-page entries beat
 * older copies, and sort by sequence to maintain canonical order across
 * pages.
 */
function flattenSnapshotPages(data: SnapshotInfinite | undefined): ChatMessage[] {
  if (!data) return [];
  const byId = new Map<string, ChatMessage>();
  for (const page of data.pages) {
    for (const m of page.messages) {
      byId.set(m.id, m);
    }
  }
  return Array.from(byId.values()).sort((a, b) => {
    if (a.sequence !== b.sequence) return a.sequence - b.sequence;
    // Same sequence is unexpected from the server (sequence is unique per
    // session) but can happen briefly across local-stamped optimistic
    // messages — fall back to createdAt for a stable tiebreaker.
    const at = Date.parse(a.createdAt);
    const bt = Date.parse(b.createdAt);
    if (Number.isFinite(at) && Number.isFinite(bt) && at !== bt) return at - bt;
    return 0;
  });
}

/** Prefix used by `useChat` / card shortcuts when stamping client-only ids. */
const LOCAL_ID_PREFIX = "local_";

function isLocalOnlyId(id: string): boolean {
  return id.startsWith(LOCAL_ID_PREFIX);
}

/**
 * Returns a `cardType:semanticId` key for card kinds the FE synthesizes
 * locally after a backend write — used to drop the local copy once the
 * server-persisted twin shows up in a refreshed snapshot (which carries a
 * different, AI-generated cardId). Returning `null` opts a card out of
 * semantic dedup (kept on cardId only, the default behavior).
 */
function semanticDedupKey(card: CardPayload): string | null {
  if (card.cardType === "order_success") {
    const negId = (card.payload as { negotiationId?: string } | undefined)
      ?.negotiationId;
    return negId ? `order_success:${negId}` : null;
  }
  return null;
}

/**
 * Merge a freshly hydrated snapshot list with the in-flight `messagesRef`
 * so SSE-driven local mutations (partial content deltas, locally appended
 * cards) aren't blown away by a server snapshot that hasn't seen them yet.
 *
 * Rules:
 * - Same id: keep the longer `content` (covers mid-stream SSE delta when
 *   snapshot hasn't been re-fetched yet); union the cards by cardId
 *   (local card synthesis can race the server-persisted card).
 * - Local-only ids (`local_*`): kept while the active run is still
 *   `running` so the user's optimistic bubble stays on screen until the
 *   server's real row materializes. Once the run hits `idle` the SSE
 *   pipeline has committed its turn, so any remaining `local_*` rows
 *   are stale doppelgängers of the persisted server messages (postChat
 *   never returns the user message's db id, so client/server ids can't
 *   match) — drop them. This is what prevents the "same message shown 3 times"
 *   regression where local + server-uuid copies coexist.
 * - Snapshot pages are the source of truth for persisted history. Server ids
 *   absent from the current snapshot page set are kept only while a run is
 *   still streaming; after idle they are treated as stale local state. This
 *   prevents restored/preserved rows from masking real pagination progress.
 */
function mergeWithLocal(
  snapshotList: ChatMessage[],
  local: ChatMessage[],
  runStatus: RunStatus,
): ChatMessage[] {
  const localById = new Map(local.map((m) => [m.id, m]));
  const mergedById = new Map<string, ChatMessage>();

  for (const snap of snapshotList) {
    const localCopy = localById.get(snap.id);
    if (!localCopy) {
      mergedById.set(snap.id, snap);
      continue;
    }
    // Choose the longer content (SSE may have streamed more than what
    // was persisted at the moment snapshot fired).
    const content =
      localCopy.content.length > snap.content.length
        ? localCopy.content
        : snap.content;
    // Union cards by cardId so a locally-synthesized card (e.g. the
    // schema_form shortcut) doesn't disappear when the server later
    // persists its own copy.
    //
    // For cards FE synthesizes after a backend write (order_success after
    // startOrder), AI persists its own copy with a server-generated cardId.
    // cardId-only dedup keeps both → duplicate cards on re-mount. Drop the
    // local copy when the snapshot already has a same-cardType card carrying
    // the same semantic key (negotiationId for order_success uniquely
    // identifies the originating action).
    const cardsLocal = localCopy.metadata?.cards ?? [];
    const cardsSnap = snap.metadata?.cards ?? [];
    const cardsById = new Map<string, CardPayload>();
    for (const c of cardsSnap) cardsById.set(c.cardId, c);
    const snapKeys = new Set<string>();
    for (const c of cardsSnap) {
      const key = semanticDedupKey(c);
      if (key) snapKeys.add(key);
    }
    for (const c of cardsLocal) {
      if (cardsById.has(c.cardId)) continue;
      const key = semanticDedupKey(c);
      if (key && snapKeys.has(key)) continue;
      cardsById.set(c.cardId, c);
    }
    const mergedCards = Array.from(cardsById.values());
    const metadata =
      snap.metadata || localCopy.metadata
        ? {
            ...(snap.metadata ?? {}),
            ...(localCopy.metadata ?? {}),
            cards: mergedCards,
          }
        : undefined;
    mergedById.set(snap.id, {
      ...snap,
      content,
      metadata,
    });
  }

  const keepUnhydratedRunRows = runStatus === "running";
  for (const localMsg of local) {
    if (mergedById.has(localMsg.id)) continue;
    if (isLocalOnlyId(localMsg.id) && !keepUnhydratedRunRows) {
      // SSE has settled — the server has already persisted whatever
      // this bubble represented, so the optimistic row is now a
      // duplicate of a snapshot row with a real uuid. Drop it.
      continue;
    }
    if (!isLocalOnlyId(localMsg.id) && !keepUnhydratedRunRows) {
      // Persisted history must come from snapshot pages only. Keeping
      // arbitrary server-id rows here desynchronizes UI state from the
      // InfiniteQuery pageParams and makes early history loads look like
      // no-ops after a refresh.
      continue;
    }
    mergedById.set(localMsg.id, localMsg);
  }

  return Array.from(mergedById.values()).sort((a, b) => {
    if (a.sequence !== b.sequence) return a.sequence - b.sequence;
    const at = Date.parse(a.createdAt);
    const bt = Date.parse(b.createdAt);
    if (Number.isFinite(at) && Number.isFinite(bt) && at !== bt) return at - bt;
    return 0;
  });
}

export interface UseConversationResult {
  messages: ChatMessage[];
  runStatus: ReturnType<typeof useNavigator>["runStatus"];
  isLoading: boolean;
  isReconnecting: boolean;
  /** True when the active SSE run has been silent for STALL_TIMEOUT_MS */
  isStalled: boolean;
  error: Error | null;
  /** Whether older history pages remain to be fetched. */
  hasMoreHistory: boolean;
  /** True while the next older page is in flight. */
  isLoadingMoreHistory: boolean;
  /** Fetch the next older page when the top sentinel scrolls into view. */
  loadMoreHistory: () => void;
  /** Called by useChat once postChat returns a runId; starts consuming SSE. */
  startRun: (runId: string) => void;
  /** Manually retry the most recent SSE connection. */
  reconnect: () => void;
  /** Stop the current SSE stream. */
  abort: () => void;
  /** Refetch the snapshot to reconcile (call after `done` or after recovering from an error). */
  refresh: () => Promise<void>;
}

/**
 * Single-conversation lifecycle management:
 * - On mount, fetch the snapshot and hydrate messages + activeRun
 * - If activeRun exists, open SSE automatically
 * - `assistant_message` / `card` events upsert messages by messageId
 * - `done` closes the stream, `error` is recorded
 * - Dropped connections reconnect with exponential backoff (1/2/4/8/16s, max 5 attempts)
 */
export function useConversation(
  sessionId: string | null,
): UseConversationResult {
  const { session, status: authStatus } = useAuth();
  const { messages, runStatus, dispatch } = useNavigator();
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const [isReconnecting, setIsReconnecting] = useState(false);
  const [isStalled, setIsStalled] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const seenIdsRef = useRef<Set<string>>(new Set());
  const abortRef = useRef<AbortController | null>(null);
  const attemptRef = useRef<number>(0);
  const activeRunIdRef = useRef<string | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stallTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messagesRef = useRef<ChatMessage[]>(messages);
  const openStreamRef = useRef<(runId: string) => void>(() => {});
  // Mirror runStatus into a ref so the wire effect can branch on it
  // without adding runStatus to its dep array — otherwise every SSE
  // open/done state flip would re-run the whole flatten+merge pipeline
  // and possibly re-fire openStream.
  const runStatusRef = useRef<RunStatus>(runStatus);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    runStatusRef.current = runStatus;
  }, [runStatus]);

  const token = session?.token ?? null;

  const clearStallTimer = useCallback(() => {
    if (stallTimerRef.current) {
      clearTimeout(stallTimerRef.current);
      stallTimerRef.current = null;
    }
  }, []);

  /**
   * Reset the stall watchdog. Called on stream open and on every SSE
   * event we deliver to handleEvent. If 30s pass with no further call,
   * we flip `isStalled` so the UI can render the retry banner.
   */
  const armStallTimer = useCallback(() => {
    clearStallTimer();
    setIsStalled(false);
    stallTimerRef.current = setTimeout(() => {
      setIsStalled(true);
    }, STALL_TIMEOUT_MS);
  }, [clearStallTimer]);

  /* ─────────────── Snapshot hydration ─────────────── */

  const snapshotEnabled = Boolean(sessionId) && authStatus === "authenticated";
  const snapshot = useInfiniteQuery<
    SnapshotPage,
    Error,
    SnapshotInfinite,
    ReturnType<typeof snapshotQueryKey>,
    number | undefined
  >({
    queryKey: snapshotQueryKey(sessionId),
    queryFn: ({ pageParam, signal }) =>
      getSnapshot(sessionId as string, {
        limit: SNAPSHOT_PAGE_SIZE,
        beforeSequence: pageParam,
        signal,
      }),
    initialPageParam: undefined,
    /**
     * `pages` is loaded in newest→oldest order:
     *   pages[0] = first page = newest 20
     *   pages[N-1] = most-recently-loaded older page
     * So the next cursor is the earliest sequence among ALL currently
     * loaded pages, which sits at `pages[N-1].messages[0]` (each page is
     * ASC, [0] is its earliest entry).
     */
    getNextPageParam: (_lastPage, allPages) => {
      const earliestPage = allPages[allPages.length - 1];
      if (!earliestPage || !earliestPage.hasMore) return undefined;
      if (earliestPage.messages.length === 0) return undefined;
      return earliestPage.messages[0].sequence;
    },
    enabled: snapshotEnabled,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: false,
  });

  // cleanup on sessionId change / unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      clearStallTimer();
    };
  }, [sessionId, clearStallTimer]);

  /* ─────────────── SSE consumption ─────────────── */

  const applyAssistantMessage = useCallback(
    (runId: string, payload: AssistantMessagePayload) => {
      const { messageId, content, delta } = payload;
      const existing = messagesRef.current.find((m) => m.id === messageId);
      if (existing) {
        const nextContent = delta ? existing.content + content : content;
        dispatch({
          type: "update_message",
          id: messageId,
          patch: { content: nextContent },
        });
      } else {
        dispatch({
          type: "append_message",
          message: {
            id: messageId,
            // Local stamp until snapshot reconciliation matches by id and
            // overwrites with the real server sequence. Date.now() keeps
            // concurrent SSE messages ordered while sitting at the tail.
            sequence: Date.now(),
            runId,
            role: "assistant",
            content,
            createdAt: new Date().toISOString(),
            metadata: { cards: [] },
          },
        });
      }
    },
    [dispatch],
  );

  const applyCardEvent = useCallback(
    (runId: string, payload: CardEventPayload) => {
      const { messageId, card } = payload;
      const existing = messagesRef.current.find((m) => m.id === messageId);
      const safeCard = card as CardPayload;
      if (existing) {
        const cards = [...(existing.metadata?.cards ?? []), safeCard];
        dispatch({
          type: "update_message",
          id: messageId,
          patch: {
            metadata: { ...(existing.metadata ?? {}), cards },
          },
        });
      } else {
        dispatch({
          type: "append_message",
          message: {
            id: messageId,
            sequence: Date.now(),
            runId,
            role: "assistant",
            content: "",
            createdAt: new Date().toISOString(),
            metadata: { cards: [safeCard] },
          },
        });
      }
    },
    [dispatch],
  );

  const handleEvent = useCallback(
    (event: SSEEvent) => {
      if (seenIdsRef.current.has(event.id)) return;
      seenIdsRef.current.add(event.id);

      // Any inbound event proves the run is alive — reset stall watchdog.
      armStallTimer();

      switch (event.type) {
        case "assistant_message":
          applyAssistantMessage(event.runId, event.payload);
          break;
        case "card":
          applyCardEvent(event.runId, event.payload);
          break;
        case "error": {
          const p = event.payload as ErrorPayload;
          setError(new Error(p.message || "Navigator error"));
          dispatch({ type: "set_run_status", status: "error" });
          break;
        }
        case "tool_start":
        case "tool_end":
        case "done":
          // tool_* events are side-channel only for now; done is finalized in the onDone callback
          break;
        default:
          // Unknown event type: drop silently without affecting other events
          break;
      }
    },
    [applyAssistantMessage, applyCardEvent, armStallTimer, dispatch],
  );

  const openStream = useCallback(
    (runId: string) => {
      if (!sessionId || !token) return;
      activeRunIdRef.current = runId;

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      dispatch({ type: "set_run_status", status: "running" });
      setError(null);
      armStallTimer();

      void (async () => {
        try {
          await createSSEStream(buildStreamUrl(sessionId, runId), {
            token,
            signal: controller.signal,
            onEvent: handleEvent,
            onUnauthorized: () => {
              dispatch({ type: "set_run_status", status: "error" });
              setIsReconnecting(false);
            },
            onDone: () => {
              if (!controller.signal.aborted) {
                dispatch({ type: "set_run_status", status: "idle" });
              }
              activeRunIdRef.current = null;
              attemptRef.current = 0;
              setIsReconnecting(false);
              clearStallTimer();
              setIsStalled(false);
              // Post-done reconciliation: refresh ONLY the first (newest)
              // page so any history pages the user already paged in stay
              // put — a blanket invalidate would refetch every page and
              // collapse the user's scroll position.
              if (controller.signal.aborted) return;
              if (!sessionId) return;
              void (async () => {
                try {
                  const refreshed = await getSnapshot(sessionId, {
                    limit: SNAPSHOT_PAGE_SIZE,
                  });
                  queryClient.setQueryData<SnapshotInfinite>(
                    snapshotQueryKey(sessionId),
                    (old) => {
                      if (!old) {
                        return {
                          pages: [refreshed],
                          pageParams: [undefined],
                        };
                      }
                      return {
                        ...old,
                        pages: [refreshed, ...old.pages.slice(1)],
                      };
                    },
                  );
                } catch {
                  // Reconciliation is best-effort — SSE has already
                  // delivered the live content; a failed refresh just
                  // means we'll catch up on the next session open.
                }
              })();
            },
          });
        } catch (err) {
          if (controller.signal.aborted) return;

          if (err instanceof SSEError && err.status === 401) {
            // AI service 401 — Navigator stream stops, but session is NOT
            // cleared (BE auth-route 401s own that). User can retry.
            dispatch({ type: "set_run_status", status: "error" });
            setError(err);
            setIsReconnecting(false);
            return;
          }

          if (attemptRef.current < MAX_RECONNECT_ATTEMPTS) {
            const delay = 1000 * 2 ** attemptRef.current;
            attemptRef.current += 1;
            setIsReconnecting(true);
            reconnectTimerRef.current = setTimeout(() => {
              reconnectTimerRef.current = null;
              if (activeRunIdRef.current === runId) {
                openStreamRef.current(runId);
              }
            }, delay);
          } else {
            dispatch({ type: "set_run_status", status: "error" });
            setError(err instanceof Error ? err : new Error(String(err)));
            setIsReconnecting(false);
            showToast(
              "Navigator is temporarily unavailable. Please try again later.",
            );
          }
        }
      })();
    },
    [
      sessionId,
      token,
      dispatch,
      handleEvent,
      queryClient,
      showToast,
      armStallTimer,
      clearStallTimer,
    ],
  );

  useEffect(() => {
    openStreamRef.current = openStream;
  }, [openStream]);

  /* ─────────────── Snapshot error surface ─────────────── */

  const snapshotErrorReportedRef = useRef<unknown>(null);
  useEffect(() => {
    const err = snapshot.error;
    if (!err || snapshotErrorReportedRef.current === err) return;
    snapshotErrorReportedRef.current = err;
    if (err instanceof ApiError && err.status >= 500) {
      showToast(
        "Navigator is temporarily unavailable. Please try again later.",
      );
    }
  }, [snapshot.error, showToast]);

  /* ─────────────── Wire snapshot → messages ─────────────── */

  /**
   * Track which set of pages we've already handled so the wire effect
   * only opens a new SSE stream on a *new* hydration (mount / loadMore
   * landing the first page / SSE done reconciliation patching page 0),
   * not on every render. Without this an `activeRun` on page 0 would
   * keep re-firing `openStream` whenever the InfiniteData reference
   * changed for an unrelated reason.
   */
  const lastWiredActiveRunIdRef = useRef<string | null>(null);

  useEffect(() => {
    const data = snapshot.data;
    if (!data) return;

    // Flatten all pages → ASC sequence → merge with the in-flight local
    // ref so SSE-streamed partial content / locally-synthesized cards
    // aren't blown away by a server snapshot that hasn't seen them yet.
    // `runStatusRef` decides whether `local_*` optimistic rows are kept
    // (mid-run) or dropped (post-`idle`, when the server's persisted
    // copies have already taken over).
    const flat = flattenSnapshotPages(data);
    const merged = mergeWithLocal(flat, messagesRef.current, runStatusRef.current);
    dispatch({ type: "set_messages", messages: merged });

    // `activeRun` lives on the first page (pages[0]) — older pages always
    // come back with `activeRun: null` because they describe historical
    // slices, not current session state.
    const firstPage = data.pages[0];
    const activeRunId = firstPage?.activeRun?.runId ?? null;

    if (activeRunId && lastWiredActiveRunIdRef.current !== activeRunId) {
      lastWiredActiveRunIdRef.current = activeRunId;
      // Fresh hydration introduced a new active run — reset dedup and
      // start consuming SSE for it.
      seenIdsRef.current = new Set<string>();
      openStream(activeRunId);
    } else if (!activeRunId && lastWiredActiveRunIdRef.current === null) {
      // First hydration with no active run — flip status to idle (we
      // never raised it to running, but this resets any stale error
      // state from a prior session that did).
      dispatch({ type: "set_run_status", status: "idle" });
    }
    // openStream is stable per sessionId/token; re-running on snapshot data refresh is correct
  }, [snapshot.data, dispatch, openStream]);

  // Reset the wired-run tracker when the session changes so a different
  // conversation's active run re-fires openStream on its first hydration.
  useEffect(() => {
    lastWiredActiveRunIdRef.current = null;
  }, [sessionId]);

  /* ─────────────── Public handles ─────────────── */

  const startRun = useCallback(
    (runId: string) => {
      attemptRef.current = 0;
      setIsReconnecting(false);
      setIsStalled(false);
      openStream(runId);
    },
    [openStream],
  );

  const reconnect = useCallback(() => {
    const runId = activeRunIdRef.current;
    if (!runId) return;
    attemptRef.current = 0;
    setIsReconnecting(false);
    setIsStalled(false);
    openStream(runId);
  }, [openStream]);

  const abort = useCallback(() => {
    abortRef.current?.abort();
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    clearStallTimer();
    setIsStalled(false);
    activeRunIdRef.current = null;
    attemptRef.current = 0;
    setIsReconnecting(false);
    dispatch({ type: "set_run_status", status: "idle" });
  }, [dispatch, clearStallTimer]);

  /**
   * Refresh the first (newest) page only. Mirrors SSE-done reconciliation
   * semantics so a manual refresh (e.g. NavigatorFAB on dialog open) does
   * NOT collapse the user's already-loaded history pages — invalidating
   * the whole InfiniteData would refetch every page sequentially and
   * jump the scroll position back to the bottom.
   */
  const refresh = useCallback(async () => {
    if (!sessionId) return;
    try {
      const refreshed = await getSnapshot(sessionId, {
        limit: SNAPSHOT_PAGE_SIZE,
      });
      queryClient.setQueryData<SnapshotInfinite>(
        snapshotQueryKey(sessionId),
        (old) => {
          if (!old) {
            return { pages: [refreshed], pageParams: [undefined] };
          }
          return { ...old, pages: [refreshed, ...old.pages.slice(1)] };
        },
      );
    } catch {
      // best-effort; the next snapshot mount will retry via React Query
    }
  }, [sessionId, queryClient]);

  const loadMoreHistory = useCallback(() => {
    if (!snapshot.hasNextPage) return;
    if (snapshot.isFetchingNextPage) return;
    void snapshot.fetchNextPage();
  }, [snapshot]);

  // Stabilize the returned handle so consumers' effects/useCallbacks that
  // depend on `conversation` don't re-fire on every render.
  const composedError = error ?? (snapshot.error as Error | null) ?? null;
  const hasMoreHistory = snapshot.hasNextPage ?? false;
  const isLoadingMoreHistory = snapshot.isFetchingNextPage;
  return useMemo(
    () => ({
      messages,
      runStatus,
      isLoading: snapshot.isLoading,
      isReconnecting,
      isStalled,
      error: composedError,
      hasMoreHistory,
      isLoadingMoreHistory,
      loadMoreHistory,
      startRun,
      reconnect,
      abort,
      refresh,
    }),
    [
      messages,
      runStatus,
      snapshot.isLoading,
      isReconnecting,
      isStalled,
      composedError,
      hasMoreHistory,
      isLoadingMoreHistory,
      loadMoreHistory,
      startRun,
      reconnect,
      abort,
      refresh,
    ],
  );
}
