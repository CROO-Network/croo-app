"use client";

import { CardShell } from "../primitives";
import type { QuickAction } from "./types";
import { useChain } from "@/lib/chain-context";

const DEFAULT_QUICK_ACTIONS: QuickAction[] = [
  { icon: "🔍", text: "Find me a DeFi data agent" },
  { icon: "💡", text: "What can agents do for me?" },
  { icon: "📦", text: "Check my active orders" },
];

const BNB_QUICK_ACTIONS: QuickAction[] = [
  { icon: "🔍", text: "Find me a BNB Chain data agent" },
  { icon: "🛡️", text: "Which agent can audit a token?" },
  { icon: "💡", text: "What can agents do for me?" },
];

export function WelcomeCard({
  greeting = "Hi there! 👋",
  subtitle = "I'm CROO — your AI assistant for the agent marketplace.",
  quickActions = DEFAULT_QUICK_ACTIONS,
  onSend,
}: {
  greeting?: string;
  subtitle?: string;
  quickActions?: QuickAction[];
  onSend: (text: string) => void;
}) {
  const { isInteractive, meta } = useChain();
  const resolvedSubtitle = isInteractive
    ? subtitle
    : `I'm CROO — describe what you need and I'll find the right agent on ${meta.label}.`;
  const resolvedActions = isInteractive ? quickActions : BNB_QUICK_ACTIONS;

  return (
    <div data-card-kind="welcome" className="space-y-3 w-full">
      <div className="bg-[#F5F5F3] rounded-2xl rounded-tl-sm px-4 py-3">
        <p className="text-sm font-semibold text-[#0F0F0F] mb-0.5">{greeting}</p>
        <p className="text-sm text-[#6B6B6B] leading-relaxed">{resolvedSubtitle}</p>
      </div>

      <CardShell>
        <div className="px-4 pt-3 pb-1">
          <p className="text-[10px] font-mono uppercase tracking-widest text-[#9A9A9A] mb-2.5">
            Quick actions
          </p>
          <div className="space-y-0.5 mb-2">
            {resolvedActions.map((a) => (
              <button
                key={a.text}
                onClick={() => onSend(a.text)}
                className="w-full flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-[#F5F5F3] transition-colors text-left cursor-pointer"
              >
                <span className="text-base leading-none">{a.icon}</span>
                <span className="text-xs text-[#3A3A3A]">{a.text}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="border-t border-[#F0F0EE] px-4 py-2.5">
          <p className="text-[11px] text-[#9A9A9A] leading-relaxed">
            Or just type what you need below.
          </p>
        </div>
      </CardShell>
    </div>
  );
}
