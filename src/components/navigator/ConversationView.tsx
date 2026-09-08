"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import { MessageBubble } from "./MessageBubble";
import { WelcomeCard } from "./cards";
import { useInfiniteScroll } from "@/lib/useInfiniteScroll";
import type { ChatMessage, RunStatus } from "@/types/navigator";

const INACTIVITY_MS = 24 * 60 * 60 * 1000;

/**
 * Decide whether a persisted message should appear in the transcript.
 *
 * - `tool` rows are LLM plumbing (raw JSON tool returns) — always hide.
 * - `user` rows with `metadata.synthetic === true` are pseudo-prompts the
 *   AI side writes when a card SELECT/CONFIRM triggers a follow-up run
 *   (e.g. `[Card interaction] User selected agent X`). The LLM still
 *   sees them in its history; the user shouldn't.
 * - assistant rows with no text and no cards are gate messages that
 *   slipped through — also hide.
 */
function isVisibleMessage(message: ChatMessage): boolean {
  if (message.role === "tool") return false;
  if (message.role === "user" && message.metadata?.synthetic === true) {
    return false;
  }
  if (message.role === "assistant") {
    const hasContent = Boolean(message.content);
    const hasCards = (message.metadata?.cards?.length ?? 0) > 0;
    if (!hasContent && !hasCards) return false;
  }
  return true;
}

type TranscriptItem =
  | { kind: "welcome"; key: string }
  | { kind: "message"; key: string; msg: ChatMessage };

/**
 * Interleave WelcomeCards into the message list as purely visual markers
 * (never persisted, never sent to the LLM). A welcome card is inserted at:
 *
 *   1. Empty conversation — one welcome card so the user sees a greeting.
 *   2. Before the very first message — only when `hasMoreHistory === false`,
 *      i.e. the currently loaded `messages[0]` really is the user's
 *      earliest turn. With waterfall pagination an in-view welcome card
 *      gets pushed/remounted every time the top sentinel triggers
 *      fetchNextPage (since `messages[0]` changes), causing a visible
 *      flicker — only commit to a "first hello" marker once we know
 *      there's nothing older to load.
 *   3. Between two adjacent messages whose `createdAt` gap exceeds 24h —
 *      marks a fresh visit after inactivity.
 *   4. After the last message if it is now >24h stale — marks the current
 *      visit when the user re-opens Navigator without sending anything yet.
 *
 * Deterministic per messages snapshot, so two devices viewing the same
 * snapshot render an identical transcript without any backend coordination.
 */
function buildTranscript(
  messages: ChatMessage[],
  hasMoreHistory: boolean,
): TranscriptItem[] {
  if (messages.length === 0) {
    return [{ kind: "welcome", key: "welcome:empty" }];
  }
  const items: TranscriptItem[] = [];
  if (!hasMoreHistory) {
    items.push({ kind: "welcome", key: `welcome:before:${messages[0].id}` });
  }
  for (let i = 0; i < messages.length; i += 1) {
    const cur = messages[i];
    if (i > 0) {
      const prev = messages[i - 1];
      const prevTs = Date.parse(prev.createdAt);
      const curTs = Date.parse(cur.createdAt);
      if (
        Number.isFinite(prevTs)
        && Number.isFinite(curTs)
        && curTs - prevTs > INACTIVITY_MS
      ) {
        items.push({
          kind: "welcome",
          key: `welcome:between:${prev.id}:${cur.id}`,
        });
      }
    }
    items.push({ kind: "message", key: cur.id, msg: cur });
  }
  const last = messages[messages.length - 1];
  const lastTs = Date.parse(last.createdAt);
  if (Number.isFinite(lastTs) && Date.now() - lastTs > INACTIVITY_MS) {
    items.push({ kind: "welcome", key: `welcome:after:${last.id}` });
  }
  return items;
}

export interface ConversationViewProps {
  messages: ChatMessage[];
  /** Quick-action click from the empty-state / Welcome card. */
  onQuickAction: (text: string) => void;
  /** Retry callback when the most recent send failed (the ⟲ button on the user bubble). */
  onRetryLastSend?: () => void;
  /** Show a skeleton while the snapshot is loading (optional). */
  isLoading?: boolean;
  /** Current run status; shows a typing indicator when running and the last message is not from the assistant. */
  runStatus?: RunStatus;
  /** Navigator wallet address for the Top Up entry in SchemaFormCard (the button becomes Top Up when the balance is insufficient). */
  walletAddress?: string;
  /** True when older history pages remain — drives the top sentinel. */
  hasMoreHistory?: boolean;
  /** True while the next older page is in flight. */
  isLoadingMoreHistory?: boolean;
  /** Fetch the next older page (called by the IntersectionObserver). */
  onLoadMoreHistory?: () => void;
  /** Optional close hook for cards that route away from Navigator. */
  onNavigateAway?: () => void;
}

function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div
        className="bg-[#F5F5F3] rounded-2xl rounded-tl-sm px-4 py-3 inline-flex items-center gap-1"
        aria-label="CROO is typing"
        role="status"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-[#9A9A9A] animate-bounce [animation-delay:-0.3s]" />
        <span className="h-1.5 w-1.5 rounded-full bg-[#9A9A9A] animate-bounce [animation-delay:-0.15s]" />
        <span className="h-1.5 w-1.5 rounded-full bg-[#9A9A9A] animate-bounce" />
      </div>
    </div>
  );
}

export function ConversationView({
  messages,
  onQuickAction,
  onRetryLastSend,
  isLoading = false,
  runStatus,
  walletAddress,
  hasMoreHistory = false,
  isLoadingMoreHistory = false,
  onLoadMoreHistory,
  onNavigateAway,
}: ConversationViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useInfiniteScroll(hasMoreHistory, () => {
    if (onLoadMoreHistory) onLoadMoreHistory();
  });

  // Strip out legacy `insufficient_balance` cards from persisted history.
  // The card type was retired in favor of an inline Top Up CTA on the
  // schema-form card. AI side no longer emits these, but historical
  // conversations may still carry them in metadata.cards — filter at the
  // view layer so the rest of the rendering pipeline never sees them.
  // `cardType` is typed against the live CardType union (which no longer
  // includes "insufficient_balance"), so we widen to string for the
  // historical comparison.
  const sanitizedMessages = useMemo(() => {
    return messages.map((m) => {
      const cards = m.metadata?.cards;
      if (!cards || cards.length === 0) return m;
      const filtered = cards.filter(
        (c) => (c.cardType as string) !== "insufficient_balance",
      );
      if (filtered.length === cards.length) return m;
      return {
        ...m,
        metadata: {
          ...(m.metadata ?? {}),
          cards: filtered,
        },
      };
    });
  }, [messages]);

  const visibleMessages = useMemo(
    () => sanitizedMessages.filter(isVisibleMessage),
    [sanitizedMessages],
  );

  const transcript = useMemo(
    () => buildTranscript(visibleMessages, hasMoreHistory),
    [visibleMessages, hasMoreHistory],
  );

  const firstItemKeyRef = useRef<string | null>(null);
  const lastTranscriptLengthRef = useRef(0);
  const prevScrollHeightRef = useRef(0);
  const NEAR_BOTTOM_THRESHOLD = 80;

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const currentFirst = transcript[0]?.key ?? null;
    const prevFirst = firstItemKeyRef.current;
    const prevLen = lastTranscriptLengthRef.current;
    const prevScrollHeight = prevScrollHeightRef.current;
    const grew = transcript.length > prevLen;
    const firstChanged = prevFirst !== currentFirst;

    if (prevFirst === null) {
      el.scrollTop = el.scrollHeight;
    } else if (firstChanged && grew && prevScrollHeight > 0) {
      const delta = el.scrollHeight - prevScrollHeight;
      if (delta > 0) {
        el.scrollTop = el.scrollTop + delta;
      }
    } else if (!firstChanged && grew) {
      el.scrollTop = el.scrollHeight;
    } else {
      const wasNearBottom =
        el.scrollTop + el.clientHeight >= prevScrollHeight - NEAR_BOTTOM_THRESHOLD;
      if (wasNearBottom) {
        el.scrollTop = el.scrollHeight;
      }
    }

    firstItemKeyRef.current = currentFirst;
    lastTranscriptLengthRef.current = transcript.length;
    prevScrollHeightRef.current = el.scrollHeight;
  }, [transcript, runStatus]);

  const lastUserMessageId = (() => {
    // The retry-button anchors on the most recent *visible* user message —
    // synthetic [Card interaction] anchors must not eat the user's retry.
    for (let i = visibleMessages.length - 1; i >= 0; i -= 1) {
      if (visibleMessages[i].role === "user") return visibleMessages[i].id;
    }
    return null;
  })();

  // The last assistant message owns the live interactive cards. Older
  // assistant messages (i.e. before a new user turn shifted the focus) get
  // their cards visually + functionally locked so stale Select / Confirm &
  // Pay / Top Up buttons can't be re-clicked by mistake.
  const latestAssistantMessageId = (() => {
    for (let i = visibleMessages.length - 1; i >= 0; i -= 1) {
      if (visibleMessages[i].role === "assistant") return visibleMessages[i].id;
    }
    return null;
  })();

  const lastMessage = visibleMessages[visibleMessages.length - 1];
  const showTyping =
    runStatus === "running" && (!lastMessage || lastMessage.role === "user");

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-5">
      <div className="space-y-5">
        {/* Top sentinel: when scrolled into view + hasMoreHistory, the
            IntersectionObserver in useInfiniteScroll calls
            onLoadMoreHistory. The 300px rootMargin in useInfiniteScroll
            means the next page is requested *before* the user actually
            sees a loading spinner. */}
        {hasMoreHistory && <div ref={sentinelRef} className="h-1" aria-hidden />}

        {isLoadingMoreHistory && (
          <div className="text-xs text-[#9A9A9A] font-mono text-center py-1">
            Loading more…
          </div>
        )}

        {isLoading && visibleMessages.length === 0 && (
          <div className="text-xs text-[#9A9A9A] font-mono">Loading conversation…</div>
        )}

        {!isLoading && transcript.map((item) => {
          if (item.kind === "welcome") {
            return <WelcomeCard key={item.key} onSend={onQuickAction} />;
          }
          const msg = item.msg;
          return (
            <MessageBubble
              key={item.key}
              message={msg}
              onQuickAction={onQuickAction}
              onRetrySend={
                msg.id === lastUserMessageId ? onRetryLastSend : undefined
              }
              walletAddress={walletAddress}
              isHistorical={
                msg.role === "assistant"
                && latestAssistantMessageId !== null
                && msg.id !== latestAssistantMessageId
              }
              onNavigateAway={onNavigateAway}
            />
          );
        })}

        {showTyping && <TypingIndicator />}
      </div>
    </div>
  );
}
