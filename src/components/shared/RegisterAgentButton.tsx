"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { ConnectModal } from "@/components/auth/ConnectModal";
import { useAuth } from "@/lib/auth";
import { useChain } from "@/lib/chain-context";
import { BNB_AGENT_STUDIO_URL } from "@/lib/chains";
import { cn } from "@/lib/utils";

const REGISTER_AGENT_HREF = "/account/agents/create";

type RegisterAgentButtonProps = {
  label?: string;
  className?: string;
  showArrow?: boolean;
};

function RegisterAgentArrow() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="shrink-0">
      <path
        d="M3 7h8M8 4l3 3-3 3"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function RegisterAgentButton({
  label = "Register Agent",
  className,
  showArrow = false,
}: RegisterAgentButtonProps) {
  const { status, session } = useAuth();
  const { isInteractive } = useChain();
  const isLoggedIn = status === "authenticated" && !!session;
  const [connectOpen, setConnectOpen] = useState(false);

  const sharedClass = cn(
    "inline-flex items-center gap-2 font-medium transition-colors cursor-pointer",
    className
  );

  if (!isInteractive) {
    return (
      <a
        href={BNB_AGENT_STUDIO_URL}
        target="_blank"
        rel="noopener noreferrer"
        className={sharedClass}
      >
        {label}
        <ArrowUpRight className="h-3.5 w-3.5" />
      </a>
    );
  }

  if (isLoggedIn) {
    return (
      <Link href={REGISTER_AGENT_HREF} className={sharedClass}>
        {label}
        {showArrow ? <RegisterAgentArrow /> : null}
      </Link>
    );
  }

  return (
    <>
      <button type="button" onClick={() => setConnectOpen(true)} className={sharedClass}>
        {label}
        {showArrow ? <RegisterAgentArrow /> : null}
      </button>
      <ConnectModal externalOpen={connectOpen} onExternalOpenChange={setConnectOpen} />
    </>
  );
}
