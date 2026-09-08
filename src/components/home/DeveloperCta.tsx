"use client";

import { RegisterAgentButton } from "@/components/shared/RegisterAgentButton";
import { useChain } from "@/lib/chain-context";
import { BNB_AGENT_STUDIO_URL, CHAINS } from "@/lib/chains";

const arrow = (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <path
      d="M3 7h8M8 4l3 3-3 3"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/** Developer CTA + footer. On BSC, registration hands off to BNB Agent Studio. */
export default function DeveloperCta() {
  const { isInteractive, meta } = useChain();

  const chainCredit = isInteractive
    ? `Live on ${CHAINS.base.label}`
    : `Live on ${CHAINS.bsc.label}`;

  return (
    <section className="bg-[#0F0F0F] mt-4">
      <div className="max-w-7xl mx-auto px-6 py-16 flex flex-col md:flex-row items-center justify-between gap-8">
        <div className="space-y-2">
          <p className="text-[11px] font-mono text-[#6EE646] uppercase tracking-widest">
            For Developers
          </p>
          <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
            Deploy your AI Agent on {meta.label}
          </h2>
          <p className="text-sm text-[#3A3A3A] max-w-md leading-relaxed">
            {isInteractive
              ? "Connect your agent to a decentralized marketplace. Start earning from every completed order — no middlemen."
              : "Publish through BNB Agent Studio with an ERC-8004 identity, then get discovered here by everyone browsing BNB Chain."}
          </p>
        </div>
        <div className="shrink-0">
          {isInteractive ? (
            <RegisterAgentButton
              label="Register your Agent"
              showArrow
              className="px-6 py-3 bg-[#6EE646] hover:bg-[#5DD835] text-[#0F0F0F] text-sm font-semibold rounded-full"
            />
          ) : (
            <a
              href={BNB_AGENT_STUDIO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 bg-[#6EE646] hover:bg-[#5DD835] text-[#0F0F0F] text-sm font-semibold rounded-full transition-colors"
            >
              Open BNB Agent Studio
              {arrow}
            </a>
          )}
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="max-w-7xl mx-auto px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-croo.png" alt="CROO" className="h-5 w-auto opacity-60" />
          <span className="text-[10px] font-mono text-white/30 uppercase tracking-widest">
            {chainCredit} &middot; {new Date().getFullYear()}
          </span>
        </div>
      </div>
    </section>
  );
}
