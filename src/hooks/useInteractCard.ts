"use client";

import { useCallback, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { interactCard as interactCardApi } from "@/lib/navigator/api";
import { useNavigator } from "@/lib/navigator-context";
import { ApiError } from "@/lib/http/errors";
import { useToast } from "@/components/shared/Toast";
import type {
  CardPayload,
  ChatMessage,
  ChatMessageMetadata,
} from "@/types/navigator";

const NAVIGATOR_UNAVAILABLE_TOAST =
  "Navigator is temporarily unavailable. Please try again later.";

export interface InteractOptions {
  /**
   * Optimistic patch applied immediately. Receives the original card and
   * returns a partial card. The original card is restored on API failure.
   */
  optimisticPatch?: (card: CardPayload) => Partial<CardPayload>;
  /**
   * Friendlier error message override (otherwise falls back to a generic toast).
   */
  errorToast?: string;
}

export interface UseInteractCardResult {
  /** Returns true on success, false on failure (already toasted + rolled back). */
  interact: (
    messageId: string,
    cardId: string,
    action: string,
    payload?: Record<string, unknown>,
    options?: InteractOptions,
  ) => Promise<boolean>;
}

/**
 * Card interaction with optimistic UI + rollback.
 *
 * Each card's Select / Cancel / Confirm button calls this with an optional
 * `optimisticPatch` that mutates state (and, if needed, payload fields like
 * `selectedAgentId`). On failure we restore the snapshot taken at click time.
 */
export function useInteractCard(): UseInteractCardResult {
  const { messages, dispatch, sessionId } = useNavigator();
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  // Always read the latest messages without re-creating `interact`.
  const messagesRef = useRef<ChatMessage[]>(messages);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const writeCardAtIndex = useCallback(
    (
      messageId: string,
      cardId: string,
      mutate: (card: CardPayload) => CardPayload,
    ) => {
      const message = messagesRef.current.find((m) => m.id === messageId);
      if (!message) return;
      const cards = message.metadata?.cards;
      if (!cards) return;
      const idx = cards.findIndex((c) => c.cardId === cardId);
      if (idx < 0) return;

      const nextCards = cards.slice();
      nextCards[idx] = mutate(cards[idx]);
      const nextMetadata: ChatMessageMetadata = {
        ...(message.metadata ?? {}),
        cards: nextCards,
      };
      dispatch({
        type: "update_message",
        id: messageId,
        patch: { metadata: nextMetadata },
      });
    },
    [dispatch],
  );

  const interact = useCallback<UseInteractCardResult["interact"]>(
    async (messageId, cardId, action, payload, options) => {
      const message = messagesRef.current.find((m) => m.id === messageId);
      const original = message?.metadata?.cards?.find(
        (c) => c.cardId === cardId,
      );
      if (!original) return false;

      const patch = options?.optimisticPatch?.(original);
      if (patch) {
        writeCardAtIndex(messageId, cardId, (card) => ({ ...card, ...patch }));
      }

      try {
        const result = await interactCardApi(cardId, action, payload);
        if (result.state) {
          writeCardAtIndex(messageId, cardId, (card) => ({
            ...card,
            state: result.state,
          }));
        }
        // Two branches for surfacing the post-interact message(s):
        //   1. `appendedMessages` (deterministic shortcut, e.g.
        //      service_list SELECT → schema_form) — AI returned the new
        //      message inline; append directly, no refetch.
        //   2. Otherwise — refetch snapshot. Covers both:
        //      a) LLM-run paths (with `runId`): `useConversation` watches
        //         the resulting `snapshot.activeRun` to open the SSE
        //         stream. Without this refetch the stream never starts
        //         and the UI stays stale until the user reloads.
        //      b) Legacy / future no-runId paths without inline messages.
        if (result.appendedMessages?.length) {
          for (const msg of result.appendedMessages) {
            dispatch({ type: "append_message", message: msg });
          }
        } else if (sessionId) {
          void queryClient.invalidateQueries({
            queryKey: ["navigator", "snapshot", sessionId],
          });
        }
        return true;
      } catch (err) {
        // Restore the original card snapshot
        writeCardAtIndex(messageId, cardId, () => original);
        const is5xx = err instanceof ApiError && err.status >= 500;
        showToast(
          is5xx
            ? NAVIGATOR_UNAVAILABLE_TOAST
            : (options?.errorToast ?? "Action failed. Please try again."),
        );
        return false;
      }
    },
    [writeCardAtIndex, dispatch, showToast, queryClient, sessionId],
  );

  return { interact };
}
