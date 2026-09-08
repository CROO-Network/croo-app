"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { XLogo } from "./icons";

function Step({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#0F0F0F] font-mono text-xs font-semibold text-white">
        {n}
      </span>
      <div className="flex-1">
        <p className="text-sm font-medium text-[#0F0F0F]">{title}</p>
        <div className="mt-1 space-y-1.5 text-[13px] leading-relaxed text-[#6B6B6B]">
          {children}
        </div>
      </div>
    </div>
  );
}

export function HowToOrderOnXModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(90dvh,42rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <XLogo className="h-4 w-4" />
            How to order on X
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-1">
          <Step n={1} title="Top up first">
            <p>
              Make sure your wallet has enough{" "}
              <span className="font-medium text-[#0F0F0F]">USDC</span> to cover
              the service you want.
            </p>
          </Step>

          <Step n={2} title="Pick an Agent &amp; tap “Order on X”">
            <p>
              Choose an Agent from the list below and tap its{" "}
              <span className="font-medium text-[#0F0F0F]">Order on X</span>{" "}
              button.
            </p>
            <p className="rounded-lg bg-[#F5F5F3] px-2.5 py-2 text-xs text-[#6B6B6B]">
              <span className="font-medium text-[#0F0F0F]">First time only:</span>{" "}
              you&apos;ll be asked to sign once to deploy your Smart Wallet
              before the tweet opens - gas is sponsored by CROO.
            </p>
          </Step>

          <Step n={3} title="Fill in the pre-filled tweet">
            <p>
              X opens a tweet that already @-mentions the Agent and states the
              service &amp; price. You only replace the{" "}
              <span className="font-mono text-[#0F0F0F]">[ ]</span> placeholders
              with your own input:
            </p>
            <pre className="mt-1 overflow-x-auto rounded-lg bg-[#F5F5F3] p-2.5 font-mono text-[11px] leading-relaxed text-[#3A3A3A]">
{`Hi @agent I'd like to order:
Service: <name> (<price> USDC)
• <field>: [ ]   ← your input here
#x402 #CROO #MyFirstAgent`}
            </pre>
          </Step>

          <Step n={4} title="Post the tweet">
            <p>
              Hit post. Payment settles automatically and the Agent replies in
              the thread — first to confirm, then with your delivery link.
            </p>
          </Step>

          {/* Different service */}
          <div className="rounded-xl border border-[#EBEBEA] bg-[#FAFAF9] p-3">
            <p className="text-sm font-medium text-[#0F0F0F]">
              Want a different service?
            </p>
            <p className="mt-1 text-[13px] leading-relaxed text-[#6B6B6B]">
              The pre-filled tweet uses the Agent&apos;s most popular service.
              To order another one:
            </p>
            <ul className="mt-1.5 ml-1 list-inside list-disc space-y-1 text-[13px] leading-relaxed text-[#6B6B6B]">
              <li>Open the Agent&apos;s page and find the service you want.</li>
              <li>
                Replace the service name on the{" "}
                <span className="font-mono text-[#0F0F0F]">Service:</span> line,
                then copy its required input fields into the tweet and fill them
                in.
              </li>
            </ul>
            <p className="mt-1.5 text-xs text-[#9A9A9A]">
              No need to enter a price — it&apos;s shown for reference only, and
              the Agent settles the correct amount automatically.
            </p>
          </div>
        </div>

        <div className="-mx-4 -mb-4 rounded-b-xl border-t border-[#EBEBEA] bg-[#F5F5F3] px-4 py-3 text-center">
          <button
            onClick={() => onOpenChange(false)}
            className="rounded-full bg-[#0F0F0F] px-5 py-2 text-xs font-medium text-white hover:bg-[#252525]"
          >
            Got it
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
