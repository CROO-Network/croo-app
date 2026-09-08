"use client";

import { useRef, useState } from "react";
import { CheckCircle2, Loader2, Wallet } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  deployNavigatorUntilActive,
  NavigatorDeployFailedError,
  NavigatorDeployTimeoutError,
  type NavigatorDeployPhase,
} from "@/hooks/useNavigatorDeployUntilActive";
import { useWalletDeploy } from "@/hooks/useWalletDeploy";
import { useToast } from "@/components/shared/Toast";
import { useAuth } from "@/lib/auth";

type Phase = "intro" | NavigatorDeployPhase | "done";

const phaseText: Record<Phase, string> = {
  intro: "",
  deploying: "Preparing Smart Wallet deployment...",
  sign_deploy: "Waiting for signature...",
  confirming_on_chain: "Deploying Smart Wallet...",
  done: "Wallet deployed - opening X...",
};

export function DeploySmartWalletModal({
  open,
  onOpenChange,
  navigatorAgentId,
  loginMethod,
  onDeployed,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  navigatorAgentId: string;
  loginMethod?: string;
  onDeployed?: () => void;
}) {
  const { session } = useAuth();
  const { showToast } = useToast();
  const { deployWallet } = useWalletDeploy();
  const [phase, setPhase] = useState<Phase>("intro");
  const abortRef = useRef<AbortController | null>(null);

  const busy =
    phase === "deploying" ||
    phase === "sign_deploy" ||
    phase === "confirming_on_chain";

  function reset() {
    abortRef.current?.abort();
    abortRef.current = null;
    setPhase("intro");
  }

  async function startDeploy() {
    const agentId = navigatorAgentId.trim();
    if (!agentId || busy) return;

    abortRef.current?.abort();
    const abort = new AbortController();
    abortRef.current = abort;

    try {
      await deployNavigatorUntilActive(agentId, {
        loginMethod: loginMethod || session?.loginMethod,
        deployWallet,
        signal: abort.signal,
        onPhase: setPhase,
      });
      setPhase("done");
      window.setTimeout(() => {
        onOpenChange(false);
        reset();
        onDeployed?.();
      }, 800);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return;
      }
      if (err instanceof NavigatorDeployFailedError || err instanceof NavigatorDeployTimeoutError) {
        showToast(err.message);
      } else if (err instanceof Error && err.message) {
        showToast(err.message);
      } else {
        showToast("Smart Wallet deployment failed. Please try again.");
      }
      reset();
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (busy) return;
        onOpenChange(nextOpen);
        if (!nextOpen) reset();
      }}
    >
      <DialogContent className="sm:max-w-sm" showCloseButton={!busy}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="h-4 w-4" strokeWidth={1.6} />
            Deploy your Smart Wallet
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm leading-relaxed text-[#6B6B6B]">
          You&apos;ll need to deploy your{" "}
          <span className="font-medium text-[#0F0F0F]">Smart Wallet</span> the
          first time you place an order. Sign now to deploy -{" "}
          <span className="font-medium text-[#0F0F0F]">
            gas is sponsored by CROO
          </span>
          .
        </p>

        {phase !== "intro" && (
          <div className="flex items-center gap-2 rounded-lg bg-[#F5F5F3] px-3 py-2.5 text-sm">
            {phase === "done" ? (
              <CheckCircle2
                className="h-4 w-4 text-[#5BC23A]"
                strokeWidth={1.6}
              />
            ) : (
              <Loader2 className="h-4 w-4 animate-spin text-[#0F0F0F]" />
            )}
            <span className="text-[#0F0F0F]">{phaseText[phase]}</span>
          </div>
        )}

        {phase === "intro" && (
          <button
            type="button"
            onClick={startDeploy}
            disabled={!navigatorAgentId.trim()}
            className="mt-1 inline-flex w-full items-center justify-center rounded-full bg-[#0F0F0F] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#252525] disabled:cursor-not-allowed disabled:bg-[#E2E2E0] disabled:text-[#9A9A9A]"
          >
            Sign &amp; Deploy
          </button>
        )}
      </DialogContent>
    </Dialog>
  );
}
