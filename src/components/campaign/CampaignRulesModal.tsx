"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TIER_META, type Tier } from "@/lib/campaign-static";
import { TierIcon } from "./icons";

const TIER_ORDER: Tier[] = ["Master", "Expert", "Journeyman", "Apprentice"];

export function CampaignRulesModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Rules &amp; Rewards</DialogTitle>
        </DialogHeader>

        <div className="max-h-[60vh] space-y-5 overflow-y-auto pr-1 text-sm">
          <section>
            <h4 className="font-mono text-[11px] uppercase tracking-wide text-[#9A9A9A]">
              Campaign period
            </h4>
            <p className="mt-1 text-[#6B6B6B]">
              From Jun 15, 2026 to Dec 31, 2026. Rewards distributed within 7
              business days after the campaign ends.
            </p>
          </section>

          <section>
            <h4 className="font-mono text-[11px] uppercase tracking-wide text-[#9A9A9A]">
              One-time tasks
            </h4>
            <ul className="mt-1 space-y-1 text-[#6B6B6B]">
              <li>• Create your account — 5 pts</li>
              <li>• Connect your X account — 5 pts</li>
              <li>• Top up ≥ 1 USDC into your Agent Wallet — 5 pts</li>
            </ul>
          </section>

          <section>
            <h4 className="font-mono text-[11px] uppercase tracking-wide text-[#9A9A9A]">
              Repeatable tasks
            </h4>
            <ul className="mt-1 space-y-1 text-[#6B6B6B]">
              <li>
                • Invite a friend who completes onboarding — 5 pts (unlimited)
                <span className="mt-0.5 block text-xs text-[#9A9A9A]">
                  Onboarding = create an account &amp; top up ≥ 1 USDC.
                </span>
              </li>
              <li>• Buy a service in the Agent Store — 5 pts (up to 5×/week)</li>
              <li>• Order a service on X — 5 pts (up to 3×/week)</li>
            </ul>
            <p className="mt-2 text-xs text-[#9A9A9A]">
              Connecting X unlocks ordering on X. Invite settlement does not
              require the invitee to connect X. Weekly tasks reset every Monday
              00:00 UTC; earned points are never cleared on reset and are
              non-transferable.
            </p>
          </section>

          <section>
            <h4 className="font-mono text-[11px] uppercase tracking-wide text-[#9A9A9A]">
              Reward tiers
            </h4>
            <div className="mt-2 space-y-1.5">
              {TIER_ORDER.map((t) => (
                <div
                  key={t}
                  className="flex items-center justify-between rounded-lg bg-[#F5F5F3] px-3 py-2"
                >
                  <span className="flex items-center gap-2 text-[#0F0F0F]">
                    <TierIcon tier={t} className="h-4 w-4" />
                    <span className="font-mono text-xs">
                      {TIER_META[t].rankLabel}
                    </span>
                  </span>
                  <span className="text-xs text-[#6B6B6B]">
                    {TIER_META[t].reward}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <p className="text-xs text-[#9A9A9A]">
            All badges are non-transferable SBTs, sent to the holder&apos;s EOA
            Signer Wallet after the campaign. Total prize pool: 2,800 USDC.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
