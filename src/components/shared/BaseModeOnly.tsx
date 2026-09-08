"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Wallet } from "lucide-react";
import { useChain } from "@/lib/chain-context";
import { CHAINS } from "@/lib/chains";

/**
 * Gate for sections that only exist in an interactive chain mode — the personal
 * center, orders, agent management, the campaign. Rather than bouncing the user
 * somewhere else, it explains what happened and offers the switch.
 */
export default function BaseModeOnly({
  children,
  title = "Not available here yet",
  description,
}: {
  children: ReactNode;
  title?: string;
  description?: string;
}) {
  const { isInteractive, meta, setChain } = useChain();

  if (isInteractive) return <>{children}</>;

  return (
    <div className="min-h-screen bg-[#F5F5F3] pt-24 pb-16">
      <div className="mx-auto max-w-md px-6">
        <div className="rounded-2xl border border-[#E2E2E0] bg-white p-8 text-center">
          <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-[#F5F5F3]">
            <Wallet className="h-5 w-5 text-[#6B6B6B]" />
          </div>
          <h1 className="text-lg font-semibold text-[#0F0F0F]">{title}</h1>
          <p className="mt-2 text-sm leading-relaxed text-[#6B6B6B]">
            {description ??
              `Discovery and hand-off to providers run here on ${meta.label}. Orders, balances and account management run in the secondary chain mode.`}
          </p>
          <div className="mt-6 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => setChain("base")}
              className="h-10 rounded-full bg-[#6EE646] text-sm font-medium text-[#0F0F0F] transition-colors hover:bg-[#5DD835] cursor-pointer"
            >
              Switch to {CHAINS.base.label}
            </button>
            <Link
              href="/"
              className="h-10 inline-flex items-center justify-center rounded-full border border-[#E2E2E0] text-sm font-medium text-[#6B6B6B] transition-colors hover:border-[#C2C2C0] hover:text-[#0F0F0F]"
            >
              Back to Store
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
