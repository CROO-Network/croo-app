"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { getMyNavigatorInfo } from "@/lib/api/agent";
import { useNavigator } from "@/lib/navigator-context";
import { useNavigatorSession } from "@/hooks/useNavigatorSession";
import { useConversation } from "@/hooks/useConversation";
import { useChat } from "@/hooks/useChat";
import { useBalance } from "@/hooks/useBalance";
import { useToast } from "@/components/shared/Toast";
import { ConversationView } from "@/components/navigator/ConversationView";
import { NavigatorDialog } from "@/components/navigator/NavigatorDialog";
import { NavigatorHeader } from "@/components/navigator/NavigatorHeader";
import { MessageInput } from "@/components/navigator/MessageInput";
import { useChain } from "@/lib/chain-context";

type FabPos = { side: "left" | "right"; y: number };
const FAB_POS_KEY = "croo_fab_position";
const FAB_EDGE_MARGIN = 8;

function readStoredFabPos(): FabPos | null {
  try {
    const raw = localStorage.getItem(FAB_POS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as FabPos;
    if (
      parsed &&
      (parsed.side === "left" || parsed.side === "right") &&
      typeof parsed.y === "number" &&
      Number.isFinite(parsed.y)
    ) {
      return parsed;
    }
  } catch {}
  return null;
}

/**
 * Navigator entry point: the FAB, the 70vw dialog, and the full conversation
 * orchestration.
 *
 * Responsibilities:
 * 1. Render the FAB button (when signed out, NavigatorProvider opens the
 *    login modal instead).
 * 2. Mount the `useNavigatorSession` / `useConversation` / `useChat` trio.
 * 3. Wire messages / runStatus / draft input into ConversationView and
 *    MessageInput.
 *
 * The FAB supports click-to-open, drag-to-edge snapping, and persisting its
 * position locally. The conversation data flow itself stays inside
 * useNavigatorSession / useConversation / useChat.
 */
export function NavigatorFAB() {
  const pathname = usePathname();
  const isMcpRoute = pathname === "/mcp";
  const { open, closeNavigator } = useNavigator();

  useEffect(() => {
    if (isMcpRoute && open) {
      closeNavigator();
    }
  }, [isMcpRoute, open, closeNavigator]);

  if (isMcpRoute) {
    return null;
  }

  return <NavigatorFABContent />;
}

function NavigatorFABContent() {
  const { status: authStatus, session } = useAuth();
  const { isInteractive, meta } = useChain();
  const {
    open: isOpen,
    openNavigator,
    closeNavigator,
    sessionId,
    pendingMessage,
    runStatus,
    pendingEntryRunId,
    dispatch,
  } = useNavigator();

  const { sessionId: fetchedSessionId } = useNavigatorSession();

  const activeSessionId = sessionId ?? fetchedSessionId ?? null;

  // Event-driven wallet balance: refetch each time the user opens the
  // Navigator so the header / cards show a fresh value without 30s polling.
  const { refetch: refetchBalance } = useBalance();

  const conversation = useConversation(activeSessionId);
  const chat = useChat(activeSessionId, {
    onRunStart: conversation.startRun,
  });

  const handleQuickAction = useCallback(
    (text: string) => {
      void chat.sendMessage(text);
    },
    [chat],
  );

  const handleSend = useCallback(
    (text: string) => {
      void chat.sendMessage(text);
    },
    [chat],
  );

  const handleInputChange = useCallback(
    (value: string) => {
      dispatch({ type: "set_pending", value });
    },
    [dispatch],
  );

  const handleRetryLastSend = useCallback(() => {
    void chat.retry();
  }, [chat]);

  // Keep a ref to `conversation` so cleanup effects don't re-fire every time
  // its internal state (isReconnecting / messages / etc) changes — effects
  // should only react to the transitions they care about.
  const conversationRef = useRef(conversation);
  useEffect(() => {
    conversationRef.current = conversation;
  }, [conversation]);

  // On close: abort the client-side SSE reader (the backend run keeps going
  // in its own async task).
  // On open: refetch the snapshot. Once the latest messages + active_run
  // arrive, the snapshot effect in useConversation reopens the stream and
  // replays history into a live tail.
  // Also refetch the wallet balance (event-driven, replaces the old 30s poll).
  const prevOpenRef = useRef(isOpen);
  useEffect(() => {
    if (prevOpenRef.current && !isOpen) {
      conversationRef.current.abort();
    } else if (!prevOpenRef.current && isOpen) {
      if (activeSessionId) {
        void conversationRef.current.refresh();
      }
      refetchBalance();
    }
    prevOpenRef.current = isOpen;
  }, [isOpen, activeSessionId, refetchBalance]);

  // Hire / Try this → openNavigator stashes the synthetic
  // run id returned by POST /ai/navigator/context into `pendingEntryRunId`.
  // Hand it off to the conversation hook so the contextual greeting
  // streams in via the same SSE pipeline used for postChat. Clear the
  // pointer right away so a second open with a stale id doesn't replay.
  useEffect(() => {
    if (!pendingEntryRunId) return;
    if (!activeSessionId) return;
    conversationRef.current.startRun(pendingEntryRunId);
    dispatch({ type: "set_entry_run", runId: null });
  }, [pendingEntryRunId, activeSessionId, dispatch]);

  // Error boundary: when the auth session expires, close the dialog and ask the user to sign in again.
  const { showToast } = useToast();

  const tryOpenNavigator = useCallback(() => {
    openNavigator();
  }, [openNavigator]);
  const wasAuthenticatedRef = useRef(false);
  useEffect(() => {
    if (authStatus === "authenticated") {
      wasAuthenticatedRef.current = true;
      return;
    }
    if (authStatus === "unauthenticated" && wasAuthenticatedRef.current) {
      wasAuthenticatedRef.current = false;
      conversationRef.current.abort();
      if (isOpen) {
        closeNavigator();
        showToast("Your session expired. Please sign in to continue.");
      }
    }
  }, [authStatus, isOpen, closeNavigator, showToast]);

  const navigatorWalletQuery = useQuery({
    queryKey: ["me", "navigator", session?.userId ?? null],
    queryFn: () => getMyNavigatorInfo(),
    enabled: authStatus === "authenticated" && Boolean(session?.userId),
    staleTime: 60_000,
  });
  // Main Wallet = Navigator AA only. Never fall back to the owner EOA — sending
  // USDC to the owner EOA strands funds (the EOA can't pay orders) and requires
  // a manual sweep to rescue. Empty string surfaces "not ready" state downstream.
  const walletAddress =
    navigatorWalletQuery.data?.navigator?.walletAddress?.trim() ?? "";

  const inputDisabled = runStatus === "running" || !activeSessionId;
  const inputPlaceholder =
    authStatus === "unauthenticated"
      ? "Please sign in to chat with CROO"
      : !activeSessionId
        ? "Starting session…"
        : runStatus === "running"
          ? "CROO is thinking…"
          : isInteractive
            ? "Type a message..."
            : `Describe what you need on ${meta.label}...`;

  const [fabPos, setFabPos] = useState<FabPos | null>(null);
  const fabBtnRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setFabPos(readStoredFabPos() ?? { side: "right", y: window.innerHeight - 100 });
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const handleFabPointerDown = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      if (e.button !== 0) return;
      e.preventDefault();
      const btn = fabBtnRef.current;
      if (!btn) return;

      const rect = btn.getBoundingClientRect();
      const startX = e.clientX;
      const startY = e.clientY;
      const originLeft = rect.left;
      const originTop = rect.top;
      const btnSize = rect.width;
      const clickThreshold = 5;
      let isDragging = false;

      const minDx = FAB_EDGE_MARGIN - originLeft;
      const maxDx = window.innerWidth - originLeft - btnSize - FAB_EDGE_MARGIN;
      const minDy = FAB_EDGE_MARGIN - originTop;
      const maxDy = window.innerHeight - originTop - btnSize - FAB_EDGE_MARGIN;

      const clampDx = (dx: number) => Math.max(minDx, Math.min(maxDx, dx));
      const clampDy = (dy: number) => Math.max(minDy, Math.min(maxDy, dy));

      const onMove = (ev: PointerEvent) => {
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        if (!isDragging) {
          if (Math.hypot(dx, dy) <= clickThreshold) return;
          isDragging = true;
          btn.style.cursor = "grabbing";
        }
        btn.style.transform = `translate(${clampDx(dx)}px, ${clampDy(dy)}px)`;
      };

      const onUp = (ev: PointerEvent) => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
        btn.style.cursor = "";
        btn.style.transform = "";

        if (!isDragging) {
          tryOpenNavigator();
          return;
        }

        const finalLeft = originLeft + clampDx(ev.clientX - startX);
        const finalTop = originTop + clampDy(ev.clientY - startY);
        const fabCenterX = finalLeft + btnSize / 2;
        const side: FabPos["side"] = fabCenterX < window.innerWidth / 2 ? "left" : "right";
        const y = Math.min(
          Math.max(FAB_EDGE_MARGIN, finalTop),
          window.innerHeight - btnSize - FAB_EDGE_MARGIN,
        );
        const next: FabPos = { side, y };
        setFabPos(next);
        try {
          localStorage.setItem(FAB_POS_KEY, JSON.stringify(next));
        } catch {}
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
    },
    [tryOpenNavigator],
  );

  const fabStyle: CSSProperties | undefined = fabPos
    ? { top: `${fabPos.y}px`, [fabPos.side]: "1.5rem" }
    : undefined;

  return (
    <>
      {!isOpen && (
        <button
          type="button"
          ref={fabBtnRef}
          onPointerDown={handleFabPointerDown}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              tryOpenNavigator();
            }
          }}
          style={fabStyle}
          className={`fixed z-40 h-20 w-20 rounded-full transition-shadow flex items-center justify-center drop-shadow-lg hover:drop-shadow-xl overflow-visible p-0 touch-none select-none cursor-grab ${
            fabPos ? "" : "bottom-6 right-6"
          }`}
          aria-label="Open CROO Navigator"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/croo-mascot.webp?v=4"
            alt="CROO"
            className="h-full w-full object-contain"
          />
        </button>
      )}

      <NavigatorDialog open={isOpen} onClose={closeNavigator}>
        <NavigatorHeader walletAddress={walletAddress} />

        <ConversationView
          messages={conversation.messages}
          onQuickAction={handleQuickAction}
          onRetryLastSend={handleRetryLastSend}
          isLoading={conversation.isLoading}
          runStatus={runStatus}
          walletAddress={walletAddress}
          hasMoreHistory={conversation.hasMoreHistory}
          isLoadingMoreHistory={conversation.isLoadingMoreHistory}
          onLoadMoreHistory={conversation.loadMoreHistory}
          onNavigateAway={closeNavigator}
        />

        {conversation.isReconnecting && (
          <div className="px-5 py-1.5 text-[11px] text-amber-700 bg-amber-50 border-t border-amber-200">
            Reconnecting to CROO…
          </div>
        )}

        {conversation.isStalled && !conversation.isReconnecting && (
          <div className="flex items-center justify-between gap-3 px-5 py-2 text-[11px] text-amber-800 bg-amber-50 border-t border-amber-200">
            <span>Taking longer than expected…</span>
            <button
              type="button"
              onClick={conversation.reconnect}
              className="rounded-full border border-amber-300 bg-white px-2.5 py-0.5 text-[11px] font-medium text-amber-800 hover:bg-amber-100 transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        <MessageInput
          value={pendingMessage}
          onChange={handleInputChange}
          onSend={handleSend}
          disabled={inputDisabled}
          placeholder={inputPlaceholder}
        />
      </NavigatorDialog>
    </>
  );
}
