"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from "react";
import { postContext as apiPostContext } from "@/lib/navigator/api";
import { useConnectModal } from "@/components/auth/ConnectModalProvider";
import { useToast } from "@/components/shared/Toast";
import { useAuth } from "@/lib/auth";
import {
  clearAllNavigatorPersistedState,
  clearNavigatorPersistedState,
} from "@/lib/navigator-storage";
import type {
  ChatMessage,
  InjectedContext,
  RunStatus,
} from "@/types/navigator";

export { clearAllNavigatorPersistedState, clearNavigatorPersistedState };

/* ───────────────────────── State ───────────────────────── */

export interface NavigatorState {
  /** Whether the dialog is open. */
  open: boolean;
  /** The current user's single conversation sessionId. */
  sessionId: string | null;
  /** Full message list (snapshot + SSE appends). */
  messages: ChatMessage[];
  /** Draft the user is typing but has not sent yet. */
  pendingMessage: string;
  /** Navigator Wallet balance. */
  balance: string | null;
  /** Context injected by the most recent openNavigator(ctx) call. */
  injectedContext: InjectedContext | null;
  /** Current run status. */
  runStatus: RunStatus;
  /**
   * runId returned by `POST /ai/navigator/context` (Hire / TryThis /
   * OrderNow). NavigatorFAB watches this and hands it to
   * `useConversation.startRun` so the contextual greeting streams in
   * via the same SSE pipeline used for `POST /ai/chat`. Cleared once
   * the FAB picks it up so a re-open doesn't replay the old run.
   */
  pendingEntryRunId: string | null;
}

const initialState: NavigatorState = {
  open: false,
  sessionId: null,
  messages: [],
  pendingMessage: "",
  balance: null,
  injectedContext: null,
  runStatus: "idle",
  pendingEntryRunId: null,
};

/* ───────────────────────── Actions ───────────────────────── */

export type NavigatorAction =
  | { type: "open"; context: InjectedContext | null }
  | { type: "close" }
  | { type: "set_session"; sessionId: string | null }
  | { type: "set_messages"; messages: ChatMessage[] }
  | { type: "append_message"; message: ChatMessage }
  | {
      type: "update_message";
      id: string;
      patch: Partial<ChatMessage>;
    }
  | { type: "set_pending"; value: string }
  | { type: "set_balance"; balance: string | null }
  | { type: "set_run_status"; status: RunStatus }
  | { type: "set_entry_run"; runId: string | null }
  | { type: "reset" };

function reducer(state: NavigatorState, action: NavigatorAction): NavigatorState {
  switch (action.type) {
    case "open":
      return { ...state, open: true, injectedContext: action.context };
    case "close":
      return { ...state, open: false };
    case "set_session":
      if (state.sessionId === action.sessionId) return state;
      return {
        ...state,
        sessionId: action.sessionId,
        messages: [],
        pendingMessage: "",
        runStatus: "idle",
        pendingEntryRunId: null,
      };
    case "set_messages":
      return { ...state, messages: action.messages };
    case "append_message":
      return { ...state, messages: [...state.messages, action.message] };
    case "update_message":
      return {
        ...state,
        messages: state.messages.map((m) =>
          m.id === action.id ? { ...m, ...action.patch } : m
        ),
      };
    case "set_pending":
      return { ...state, pendingMessage: action.value };
    case "set_balance":
      return { ...state, balance: action.balance };
    case "set_run_status":
      return { ...state, runStatus: action.status };
    case "set_entry_run":
      return { ...state, pendingEntryRunId: action.runId };
    case "reset":
      return { ...initialState };
    default:
      return state;
  }
}

/* ───────────────────────── Context ───────────────────────── */

export interface NavigatorContextValue extends NavigatorState {
  /** Imperative API, kept compatible with the previous version; ctx is optional. */
  openNavigator: (context?: InjectedContext) => void;
  closeNavigator: () => void;
  dispatch: React.Dispatch<NavigatorAction>;
}

const NavigatorCtx = createContext<NavigatorContextValue | null>(null);

export function NavigatorProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const { showToast } = useToast();
  const { session, status: authStatus } = useAuth();
  const { openConnectModal } = useConnectModal();
  const activeUserId = authStatus === "authenticated" ? session?.userId ?? null : null;
  const previousUserIdRef = useRef<string | null>(null);

  // Remove legacy Navigator localStorage caches. Snapshot pagination must be
  // the only source of message history; persisted rows desynchronize UI state
  // from server-owned cursors after a refresh.
  useEffect(() => {
    clearAllNavigatorPersistedState();
  }, []);

  useEffect(() => {
    if (!activeUserId) {
      previousUserIdRef.current = null;
      return;
    }
    if (previousUserIdRef.current && previousUserIdRef.current !== activeUserId) {
      dispatch({ type: "reset" });
    }
    previousUserIdRef.current = activeUserId;
  }, [activeUserId]);

  const openNavigator = useCallback(
    (context?: InjectedContext) => {
      if (authStatus === "loading") return;
      if (authStatus === "unauthenticated") {
        openConnectModal();
        return;
      }

      dispatch({ type: "open", context: context ?? null });

      if (context && context.type !== "fab") {
        apiPostContext(context)
          .then((res) => {
            if (res.runId) {
              dispatch({ type: "set_entry_run", runId: res.runId });
            }
          })
          .catch((err) => {
            // Non-blocking: dialog already open. Surface a soft toast.
            const message =
              err instanceof Error ? err.message : "Failed to sync context";
            showToast(`Navigator context sync failed: ${message}`);
          });
      }
    },
    [authStatus, openConnectModal, showToast],
  );

  const closeNavigator = useCallback(() => {
    dispatch({ type: "close" });
  }, []);

  const value = useMemo<NavigatorContextValue>(
    () => ({
      ...state,
      openNavigator,
      closeNavigator,
      dispatch,
    }),
    [state, openNavigator, closeNavigator]
  );

  return <NavigatorCtx.Provider value={value}>{children}</NavigatorCtx.Provider>;
}

export function useNavigator(): NavigatorContextValue {
  const ctx = useContext(NavigatorCtx);
  if (!ctx) throw new Error("useNavigator must be used within NavigatorProvider");
  return ctx;
}
