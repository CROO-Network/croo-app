"use client";

import { useState, type ReactNode } from "react";
import { ArrowRight, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useIdentity } from "@/lib/identity-context";
import { useChain } from "@/lib/chain-context";
import { BNB_AGENT_STUDIO_URL } from "@/lib/chains";

/**
 * IdentityGate — full-screen dual-card identity selector.
 *
 * Replaces the previous modal dialog. On first visit, a dark scrim
 * covers the page and two cards are presented:
 *   • "I'm a human" → close gate, enter the marketplace
 *   • "I'm an agent" → close gate + navigate to /mcp (MCP spec page)
 */
export default function IdentityGate() {
  const { open, closeGate, setIdentity } = useIdentity();
  const { isInteractive } = useChain();
  const router = useRouter();
  const pathname = usePathname();
  const [hL, setHL] = useState(false);
  const [hR, setHR] = useState(false);

  if (pathname?.startsWith("/ops/agent-twitter/authorize")) return null;
  if (!open) return null;

  const handleHuman = () => {
    setIdentity("human");
    closeGate();
  };

  const handleAgent = () => {
    setIdentity("agent");
    closeGate();
    if (isInteractive) {
      router.push("/mcp");
    } else {
      window.open(BNB_AGENT_STUDIO_URL, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 py-8">
      {/* Scrim — dark blurred backdrop covers the entire viewport */}
      <div className="absolute inset-0 bg-[#15181A]/80 backdrop-blur-md" />

      {/* Subtle "skip" close — top-right of viewport */}
      <button
        onClick={closeGate}
        aria-label="Skip"
        className="absolute right-5 top-5 z-[3] grid place-items-center w-9 h-9 rounded-full text-white/60 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
      >
        <X className="h-4 w-4" />
      </button>

      {/* Centered content — no surrounding box, cards float on the scrim */}
      <div className="relative z-[2] w-full max-w-[760px]">
        {/* Two columns: title above, card below. Larger gap between columns. */}
        <div className="grid grid-cols-2 gap-12">
          {/* HUMAN column */}
          <div className="flex flex-col gap-4">
            <h2 className="text-white text-[26px] font-bold tracking-[-0.02em] leading-tight text-center">
              I&apos;m a human
            </h2>
            <ProtocolCard side="human" hovered={hL} setHovered={setHL} onClick={handleHuman}>
              <div
                className="flex items-center gap-2 px-3 py-2.5 border-b border-[#F0F0EE]"
                style={{ background: "linear-gradient(180deg, #FBFBF9 0%, #F4F4F1 100%)" }}
              >
                <span className="w-2 h-2 rounded-full" style={{ background: "#E2E2DE" }} />
                <span className="w-2 h-2 rounded-full" style={{ background: "#E8E8E4" }} />
                <span className="w-2 h-2 rounded-full" style={{ background: "#EEEEEA" }} />
                <span className="flex-1 inline-flex items-center gap-1.5 px-[9px] py-[3px] rounded-md bg-white border border-[#F0F0EE] font-mono text-[11px] text-[#6B6B6B] truncate min-w-0">
                  <span className="text-[#C8C8C5]">https://</span>
                  <span>agent.croo.network</span>
                </span>
              </div>
              <BrowserPreview hovered={hL} />
              <div className="px-5 pt-3.5 pb-3.5 flex items-center justify-between">
                <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-[#9A9A9A]">HUMAN · WEB</span>
                <span className="font-mono text-[10px] font-semibold tracking-[0.06em] px-[7px] py-0.5 rounded-[5px] border border-[#E2E2E0] text-[#6B6B6B] bg-white">GUI</span>
              </div>
              <div
                className="flex items-center justify-between px-5 py-3 border-t border-dashed border-[#E2E2E0] transition-colors"
                style={{ background: hL ? "#FAFAF9" : "transparent" }}
              >
                <span className="text-[14px] font-semibold text-[#0F0F0F]">Open Agent Store</span>
                <span
                  className="grid place-items-center w-[32px] h-[32px] rounded-lg transition-all"
                  style={{
                    background: hL ? "#0F0F0F" : "#FAFAF9",
                    color: hL ? "#fff" : "#6B6B6B",
                    transform: hL ? "translateX(2px)" : "none",
                  }}
                >
                  <ArrowRight className="h-4 w-4" strokeWidth={1.75} />
                </span>
              </div>
            </ProtocolCard>
          </div>

          {/* AGENT column */}
          <div className="flex flex-col gap-4">
            <h2 className="text-white text-[26px] font-bold tracking-[-0.02em] leading-tight text-center">
              I&apos;m an agent
            </h2>
            <ProtocolCard side="agent" hovered={hR} setHovered={setHR} onClick={handleAgent}>
              <div
                className="flex items-center gap-2 px-3 py-2.5 border-b"
                style={{
                  background: "linear-gradient(180deg, #15220E 0%, #0F1A0A 100%)",
                  borderBottomColor: "rgba(110,230,70,0.18)",
                }}
              >
                <span className="w-2 h-2 rounded-full" style={{ background: "#3D8C1F" }} />
                <span className="w-2 h-2 rounded-full" style={{ background: "#2A5614" }} />
                <span className="w-2 h-2 rounded-full" style={{ background: "#1A360D" }} />
                <span
                  className="flex-1 inline-flex items-center gap-1.5 px-[9px] py-[3px] rounded-md font-mono text-[11px] truncate min-w-0"
                  style={{
                    background: "rgba(110,230,70,0.06)",
                    border: "1px solid rgba(110,230,70,0.20)",
                    color: "#A8E48C",
                  }}
                >
                  <span style={{ color: "#6EE646" }}>
                    {isInteractive ? "mcp://" : "https://"}
                  </span>
                  <span>{isInteractive ? "croo.network" : "bnbchain.org/bnb-agent-studio"}</span>
                </span>
              </div>
              <TerminalPreview hovered={hR} interactive={isInteractive} />
              <div className="px-5 pt-3.5 pb-3.5 flex items-center justify-between">
                <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-[#9A9A9A]">
                  {isInteractive ? "AGENT · MCP" : "AGENT · BNB CHAIN"}
                </span>
                <span
                  className="font-mono text-[10px] font-semibold tracking-[0.06em] px-[7px] py-0.5 rounded-[5px]"
                  style={{ background: "#6EE646", color: "#0F2A05", border: "1px solid #3D8C1F" }}
                >
                  {isInteractive ? "JSON-RPC" : "ERC-8004"}
                </span>
              </div>
              <div
                className="flex items-center justify-between px-5 py-3 border-t border-dashed transition-colors"
                style={{
                  background: hR ? "#F0F9EB" : "transparent",
                  borderTopColor: hR ? "#D7EBC1" : "#E2E2E0",
                }}
              >
                <span
                  className="text-[14px] font-semibold transition-colors"
                  style={{ color: hR ? "#2A6B13" : "#0F0F0F" }}
                >
                  {isInteractive ? "View MCP spec" : "Open BNB Agent Studio"}
                </span>
                <span
                  className="grid place-items-center w-[32px] h-[32px] rounded-lg transition-all"
                  style={{
                    background: hR ? "#2A6B13" : "#6EE646",
                    color: hR ? "#fff" : "#0F2A05",
                    transform: hR ? "translateX(2px)" : "none",
                  }}
                >
                  <ArrowRight className="h-4 w-4" strokeWidth={1.75} />
                </span>
              </div>
            </ProtocolCard>
          </div>
        </div>
      </div>

      {/* Animations (scoped to gate) */}
      <style>{`
        @keyframes croo-gate-cursor {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0; }
        }
        .croo-cursor { animation: croo-gate-cursor 1s steps(1) infinite; }
        @media (prefers-reduced-motion: reduce) {
          .croo-cursor { animation: none !important; }
        }
      `}</style>
    </div>
  );
}

/* ── Card shell ─────────────────────────────────────────────── */

function ProtocolCard({
  side, hovered, setHovered, onClick, children,
}: {
  side: "human" | "agent";
  hovered: boolean;
  setHovered: (h: boolean) => void;
  onClick: () => void;
  children: ReactNode;
}) {
  const isAgent = side === "agent";
  const shadow = hovered
    ? isAgent
      ? "0 24px 60px -20px rgba(61,140,31,0.55), 0 8px 24px -8px rgba(61,140,31,0.30), 0 1px 0 rgba(15,15,15,0.04)"
      : "0 24px 60px -20px rgba(0,0,0,0.45), 0 8px 24px -8px rgba(0,0,0,0.20)"
    : "0 12px 32px -12px rgba(0,0,0,0.35), 0 4px 14px -6px rgba(0,0,0,0.15)";
  return (
    <div
      role="button"
      tabIndex={0}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      className="relative bg-white rounded-2xl overflow-hidden cursor-pointer flex flex-col"
      style={{
        boxShadow: shadow,
        transform: hovered ? "translateY(-3px)" : "none",
        transition: "transform .25s cubic-bezier(.2,.8,.2,1), box-shadow .25s",
      }}
    >
      {children}
    </div>
  );
}

/* ── Browser preview (Human card) ──────────────────────────── */

function BrowserPreview({ hovered }: { hovered: boolean }) {
  return (
    <div
      className="relative h-[108px] overflow-hidden border-b border-[#F0F0EE]"
      style={{ background: "linear-gradient(180deg, #FCFCFB 0%, #F6F6F3 100%)" }}
    >
      <div
        className="absolute"
        style={{
          inset: "14px 14px 0 14px",
          display: "grid",
          gridTemplateColumns: "60px 1fr",
          gap: 10,
          transform: hovered ? "translateY(-2px)" : "translateY(0)",
          transition: "transform .3s",
        }}
      >
        <div className="bg-white border border-[#F0F0EE] rounded-lg p-[7px] flex flex-col gap-[5px]">
          {[1, 1, 1, 0.7, 0.7].map((w, i) => (
            <div
              key={i}
              className="h-1.5 rounded-[3px]"
              style={{ background: i === 0 ? "#E5F5DD" : "#F0F0EE", width: `${w * 100}%` }}
            />
          ))}
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="bg-white border border-[#F0F0EE] rounded-md p-[7px] flex flex-col gap-[5px] min-h-[44px]"
            >
              <div
                className="h-3.5 rounded"
                style={{
                  background:
                    i === 1
                      ? "linear-gradient(135deg, #6EE646 0%, #3D8C1F 100%)"
                      : "#F3F3F0",
                }}
              />
              <div className="h-1 rounded-sm bg-[#E2E2E0] w-3/4" />
              <div className="h-1 rounded-sm bg-[#F0F0EE] w-[45%]" />
            </div>
          ))}
        </div>
      </div>
      <div
        className="absolute left-0 right-0 bottom-0 h-9"
        style={{ background: "linear-gradient(to bottom, transparent, #fff)" }}
      />
    </div>
  );
}

/* ── Terminal preview (Agent card) ─────────────────────────── */

function TerminalPreview({
  hovered,
  interactive,
}: {
  hovered: boolean;
  interactive: boolean;
}) {
  return (
    <div
      className="relative h-[108px] overflow-hidden border-b font-mono"
      style={{
        background: "linear-gradient(180deg, #0F1A0A 0%, #0A1207 100%)",
        color: "#A8E48C",
        fontSize: "10.5px",
        borderBottomColor: "rgba(110,230,70,0.18)",
      }}
    >
      <div
        className="absolute"
        style={{
          inset: "12px 14px 0 14px",
          display: "flex",
          flexDirection: "column",
          gap: 4,
          transform: hovered ? "translateY(-2px)" : "translateY(0)",
          transition: "transform .3s",
        }}
      >
        {interactive ? (
          <>
            <div>
              <span style={{ color: "#6EE646" }}>$</span>{" "}
              <span style={{ color: "#D9F4C8" }}>mcp</span> connect{" "}
              <span style={{ color: "#A8E48C" }}>croo.network</span>
            </div>
            <div style={{ color: "#7AB85F" }}>
              → handshake … <span style={{ color: "#6EE646" }}>ok</span>
            </div>
            <div style={{ color: "#7AB85F" }}>
              → tools/list <span style={{ color: "#A8E48C" }}>(12)</span>
            </div>
            <div style={{ color: "#5C9447", fontSize: "9.5px", paddingLeft: 12 }}>
              marketplace.search · agent.spawn · task.fund<br />
              settle.preview · wallet.balance · …
            </div>
          </>
        ) : (
          <>
            <div>
              <span style={{ color: "#6EE646" }}>$</span>{" "}
              <span style={{ color: "#D9F4C8" }}>croo</span> discover{" "}
              <span style={{ color: "#A8E48C" }}>--chain bnb</span>
            </div>
            <div style={{ color: "#7AB85F" }}>
              → registry … <span style={{ color: "#6EE646" }}>ok</span>
            </div>
            <div style={{ color: "#7AB85F" }}>
              → agents/list <span style={{ color: "#A8E48C" }}>(918)</span>
            </div>
            <div style={{ color: "#5C9447", fontSize: "9.5px", paddingLeft: 12 }}>
              erc-8004 did · capability tags<br />
              register → bnb agent studio
            </div>
          </>
        )}
        <div style={{ marginTop: 2 }}>
          <span style={{ color: "#6EE646" }}>$</span>{" "}
          <span
            className="croo-cursor inline-block align-middle"
            style={{ width: 6, height: 11, background: "#A8E48C", marginLeft: 2 }}
          />
        </div>
      </div>
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "repeating-linear-gradient(180deg, transparent 0, transparent 3px, rgba(255,255,255,0.02) 3px, rgba(255,255,255,0.02) 4px)",
        }}
      />
      <div
        className="absolute left-0 right-0 bottom-0 h-[30px]"
        style={{ background: "linear-gradient(to bottom, transparent, #0A1207)" }}
      />
    </div>
  );
}
