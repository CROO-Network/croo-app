"use client";

import { useMemo } from "react";
import DOMPurify from "dompurify";
import { RotateCcw } from "lucide-react";
import { marked } from "marked";
import { CardRenderer } from "./CardRenderer";
import type { ChatMessage } from "@/types/navigator";

/**
 * Visual rendering of a single message.
 *
 * - user: right-aligned black bubble; on send failure a ⟲ retry button is appended
 * - assistant / system: left-aligned grey bubble plus an optional list of cards
 *   (dispatched through CardRenderer)
 */
export interface MessageBubbleProps {
  message: ChatMessage;
  /** Welcome card quick-action click: send the quick-action text as a user message. */
  onQuickAction?: (text: string) => void;
  /** Retry callback, used when the message is from the user and metadata.sendError is set. */
  onRetrySend?: () => void;
  /** Navigator wallet address for the inline Top Up entry in SchemaFormCard (replaces the button when the balance is insufficient). */
  walletAddress?: string;
  /**
   * This message is no longer the latest assistant message: a newer turn has
   * taken over, so its cards should be greyed out and their buttons disabled.
   * Only meaningful for the assistant role.
   */
  isHistorical?: boolean;
  /** Optional close hook for cards that route away from Navigator. */
  onNavigateAway?: () => void;
}

function UserBubble({
  content,
  hasError,
  onRetry,
}: {
  content: string;
  hasError: boolean;
  onRetry?: () => void;
}) {
  return (
    <div className="flex justify-end items-end gap-2">
      {hasError && onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="h-6 w-6 rounded-full border border-[#E2E2E0] bg-white text-[#9A3A3A] hover:bg-[#FDECEC] transition-colors flex items-center justify-center shrink-0"
          aria-label="Retry sending message"
          title="Message failed. Click to retry."
        >
          <RotateCcw className="h-3 w-3" />
        </button>
      )}
      <div
        className={`px-4 py-2.5 rounded-2xl rounded-tr-sm max-w-[72%] text-sm leading-relaxed ${
          hasError
            ? "bg-[#2A2A2A] text-white/80 ring-1 ring-red-500/40"
            : "bg-[#0F0F0F] text-white"
        }`}
      >
        {content}
      </div>
    </div>
  );
}

/**
 * Render assistant text as GFM Markdown sanitized by DOMPurify.
 * Why HTML: marked produces an HTML string; DOMPurify strips any
 * scripts / event handlers / `javascript:` URLs before it touches the DOM.
 * Why client-only: DOMPurify requires `window`; on the server we render
 * the raw text in a <pre>-style block so the markup is still readable
 * but no untrusted HTML reaches the user before hydration.
 */
function renderAssistantHtml(content: string): string {
  const raw = marked.parse(content, {
    async: false,
    breaks: true,
    gfm: true,
  }) as string;
  return DOMPurify.sanitize(raw);
}

function AssistantText({ content }: { content: string }) {
  const html = useMemo(() => {
    if (!content) return "";
    if (typeof window === "undefined") return "";
    return renderAssistantHtml(content);
  }, [content]);

  if (!content) return null;

  return (
    <div className="flex justify-start">
      <div className="bg-[#F5F5F3] rounded-2xl rounded-tl-sm px-4 py-3 max-w-[85%]">
        {html ? (
          <div
            className="text-sm text-[#0F0F0F] leading-relaxed break-words navigator-prose"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        ) : (
          <p className="text-sm text-[#0F0F0F] leading-relaxed whitespace-pre-wrap break-words">
            {content}
          </p>
        )}
      </div>
    </div>
  );
}

function AssistantBubble({
  message,
  onQuickAction,
  walletAddress,
  isHistorical,
  onNavigateAway,
}: {
  message: ChatMessage;
  onQuickAction?: (text: string) => void;
  walletAddress?: string;
  isHistorical?: boolean;
  onNavigateAway?: () => void;
}) {
  const cards = message.metadata?.cards ?? [];
  return (
    <div className="space-y-2 min-w-0 w-full">
      <AssistantText content={message.content} />
      {cards.map((card) => (
        <CardRenderer
          key={card.cardId}
          message={message}
          card={card}
          onQuickAction={onQuickAction}
          walletAddress={walletAddress}
          isHistorical={isHistorical}
          onNavigateAway={onNavigateAway}
        />
      ))}
    </div>
  );
}

export function MessageBubble({
  message,
  onQuickAction,
  onRetrySend,
  walletAddress,
  isHistorical,
  onNavigateAway,
}: MessageBubbleProps) {
  const sendError =
    typeof message.metadata?.sendError === "string" ? message.metadata.sendError : null;

  if (message.role === "user") {
    return (
      <UserBubble
        content={message.content}
        hasError={Boolean(sendError)}
        onRetry={onRetrySend}
      />
    );
  }

  // assistant / system
  return (
    <AssistantBubble
      message={message}
      onQuickAction={onQuickAction}
      walletAddress={walletAddress}
      isHistorical={isHistorical}
      onNavigateAway={onNavigateAway}
    />
  );
}
