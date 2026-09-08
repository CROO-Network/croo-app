"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { postChat } from "@/lib/navigator/api";
import { useNavigator } from "@/lib/navigator-context";
import { ApiError } from "@/lib/http/errors";
import { useToast } from "@/components/shared/Toast";
import type { ChatMessage } from "@/types/navigator";

export interface UseChatOptions {
  /** useConversation.startRun: start consuming SSE once a runId is received. */
  onRunStart?: (runId: string) => void;
  /** Reconciliation after the send completes and SSE has finished (useConversation.refresh). */
  onReconcile?: () => Promise<void> | void;
}

export interface UseChatResult {
  sendMessage: (content: string) => Promise<void>;
  isSending: boolean;
  error: Error | null;
  /** Retry the last failed send, reusing the existing optimistic bubble. */
  retry: () => Promise<void>;
}

function makeLocalId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Send-message pipeline:
 *   1. Optimistically append the user bubble (visible immediately)
 *   2. POST /ai/chat → { run_id }
 *   3. Hand off to useConversation.startRun to open the SSE stream
 *   4. After SSE `done`, useConversation refetches the first snapshot page
 *      on its own to reconcile
 *
 * When postChat fails:
 *   - Keep the optimistic bubble and mark it with metadata.sendError
 *   - Expose retry(): resend with the same content and the same localId
 */
export function useChat(
  sessionId: string | null,
  options: UseChatOptions = {},
): UseChatResult {
  const { dispatch } = useNavigator();
  const { showToast } = useToast();
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const lastPendingRef = useRef<{ localId: string; content: string } | null>(
    null,
  );

  // Keep options in a ref so a fresh callers' inline `{ onRunStart: ... }`
  // object on every render doesn't invalidate doSend/sendMessage.
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  const doSend = useCallback(
    async (content: string, localId: string) => {
      if (!sessionId) {
        throw new Error("Navigator session not ready");
      }
      setIsSending(true);
      setError(null);

      try {
        const { runId } = await postChat(sessionId, content);

        // clear the send-error flag if retry succeeded
        dispatch({
          type: "update_message",
          id: localId,
          patch: {
            metadata: { sendError: undefined },
          },
        });

        lastPendingRef.current = null;
        optionsRef.current.onRunStart?.(runId);
      } catch (err) {
        const e = err instanceof Error ? err : new Error(String(err));
        dispatch({
          type: "update_message",
          id: localId,
          patch: {
            metadata: {
              sendError: e.message,
            },
          },
        });
        setError(e);
        if (err instanceof ApiError && err.status >= 500) {
          showToast(
            "Navigator is temporarily unavailable. Please try again later.",
          );
        }
        lastPendingRef.current = { localId, content };
        throw e;
      } finally {
        setIsSending(false);
      }
    },
    [sessionId, dispatch, showToast],
  );

  const sendMessage = useCallback(
    async (content: string) => {
      const trimmed = content.trim();
      if (!trimmed) return;
      if (!sessionId) return;

      const localId = makeLocalId("local");
      const optimistic: ChatMessage = {
        id: localId,
        // Local-only messages get a `sequence` higher than anything the
        // server will issue (which starts at 1 and grows by ~1 per turn).
        // Date.now()-based stamps keep concurrent optimistic messages
        // ordered relative to each other while sitting at the tail; the
        // value gets overwritten with the real server sequence once
        // snapshot reconciliation matches by id.
        sequence: Date.now(),
        role: "user",
        content: trimmed,
        createdAt: new Date().toISOString(),
      };
      dispatch({ type: "append_message", message: optimistic });
      dispatch({ type: "set_pending", value: "" });

      try {
        await doSend(trimmed, localId);
      } catch {
        // surfaced via metadata.sendError + retry()
      }
    },
    [sessionId, dispatch, doSend],
  );

  const retry = useCallback(async () => {
    const pending = lastPendingRef.current;
    if (!pending) return;
    try {
      await doSend(pending.content, pending.localId);
    } catch {
      /* remains flagged on message */
    }
  }, [doSend]);

  return useMemo(
    () => ({ sendMessage, isSending, error, retry }),
    [sendMessage, isSending, error, retry],
  );
}
