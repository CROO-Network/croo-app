"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AgentForm, agentToFormData } from "@/components/agent/AgentForm";
import { getMyAgent } from "@/lib/api/agent";
import { getPublicTags, type PublicTagJson } from "@/lib/api/discovery";
import { getAgentDetailToMyAgent } from "@/lib/my-agent-mapper";

export default function AgentConfigurePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initialData, setInitialData] = useState<ReturnType<typeof agentToFormData> | null>(null);
  const [defaultPaymentToken, setDefaultPaymentToken] = useState<string | undefined>(undefined);
  const [tagCatalog, setTagCatalog] = useState<PublicTagJson[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setReady(false);
      setError(null);
      try {
        const [agentRes, tagsRes] = await Promise.all([getMyAgent(id), getPublicTags()]);
        if (cancelled) return;
        const slugToLabel = new Map<string, string>();
        for (const t of tagsRes.tags || []) {
          slugToLabel.set(t.slug, t.name);
        }
        const sdkMasked =
          (agentRes.sdkKey ?? (agentRes as { sdk_key?: string }).sdk_key)?.trim() || undefined;
        const my = getAgentDetailToMyAgent(
          agentRes.agent,
          agentRes.skillTags || [],
          agentRes.services || [],
          slugToLabel,
          sdkMasked,
        );
        setInitialData(
          agentToFormData({
            ...my,
            walletDeployStatus: (agentRes.walletDeployStatus || "").trim(),
          })
        );
        setTagCatalog(tagsRes.tags ?? []);
        const pt = agentRes.services?.[0]?.paymentToken;
        setDefaultPaymentToken(typeof pt === "string" && pt.trim() ? pt.trim() : undefined);
      } catch {
        if (!cancelled) {
          setError("Could not load this agent.");
          setInitialData(null);
        }
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (!ready) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-2 text-sm text-[#9A9A9A]">
        Loading…
      </div>
    );
  }

  if (error || !initialData) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4">
        <p className="text-lg font-semibold text-[#0F0F0F]">Agent not found</p>
        <p className="text-sm text-[#9A9A9A]">{error || "The agent you're looking for doesn't exist."}</p>
        <button
          type="button"
          onClick={() => router.push("/account")}
          className="rounded-full bg-[#0F0F0F] px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-[#1A1A1A] cursor-pointer"
        >
          Back to Overview
        </button>
      </div>
    );
  }

  return (
    <AgentForm
      mode="configure"
      initialData={initialData}
      agentId={id}
      defaultPaymentToken={defaultPaymentToken}
      tagCatalog={tagCatalog}
    />
  );
}
