"use client";

import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useChain } from "@/lib/chain-context";
import { CHAINS, CHAIN_ORDER, type ChainId } from "@/lib/chains";

function ChainDot({ chain, className = "" }: { chain: ChainId; className?: string }) {
  return (
    <span
      className={`inline-block h-2 w-2 rounded-full shrink-0 ${className}`}
      style={{ backgroundColor: CHAINS[chain].accent }}
    />
  );
}

/** Desktop: compact dropdown in the header. */
export function ChainSwitcher() {
  const { chain, setChain } = useChain();
  const [open, setOpen] = useState(false);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        render={
          <button
            className="inline-flex items-center gap-2 rounded-full border border-[#E2E2E0] bg-white px-4 py-2 text-sm font-medium text-[#0F0F0F] transition-colors duration-150 hover:border-[#C2C2C0] cursor-pointer"
            aria-label="Switch chain"
          />
        }
      >
        <ChainDot chain={chain} />
        {CHAINS[chain].label}
        <ChevronDown className="h-3.5 w-3.5 text-[#9A9A9A]" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        {CHAIN_ORDER.map((id) => (
          <DropdownMenuItem
            key={id}
            className="gap-2.5 focus:bg-[#6EE646]/10 focus:text-[#0F0F0F]"
            onClick={() => setChain(id)}
          >
            <ChainDot chain={id} />
            <span className="flex-1 min-w-0 text-sm text-[#0F0F0F]">{CHAINS[id].label}</span>
            {chain === id && <Check className="h-3.5 w-3.5 text-[#3D8C1F] shrink-0" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Mobile: inline segmented list inside the nav drawer. */
export function ChainSwitcherInline({ onSelect }: { onSelect?: () => void }) {
  const { chain, setChain } = useChain();

  return (
    <div className="rounded-2xl bg-[#F5F5F3] p-1">
      <div className="flex gap-1">
        {CHAIN_ORDER.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => {
              setChain(id);
              onSelect?.();
            }}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-2 text-xs font-medium transition-colors ${
              chain === id
                ? "bg-white text-[#0F0F0F] shadow-sm"
                : "text-[#6B6B6B] hover:text-[#0F0F0F]"
            }`}
          >
            <ChainDot chain={id} />
            {CHAINS[id].label}
          </button>
        ))}
      </div>
    </div>
  );
}
