"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { bindMyFirstAgentReferral } from "@/lib/api/campaign";
import { useAuth } from "@/lib/auth";
import { queryKeys } from "@/lib/query/keys";

const STORAGE_KEY = "croo_my_first_agent_pending_ref_v1";
const CAMPAIGN_PATH = "/myfirstagent";

function readPendingRef() {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writePendingRef(refCode: string) {
  try {
    window.localStorage.setItem(STORAGE_KEY, refCode);
  } catch {}
}

function clearPendingRef() {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {}
}

function normalizeRef(value: string | null) {
  const refCode = value?.trim();
  return refCode || "";
}

export function CampaignReferralBinder() {
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const { status, session } = useAuth();
  const lastBoundRef = useRef<string | null>(null);

  useEffect(() => {
    if (pathname !== CAMPAIGN_PATH) return;
    const searchParams = new URLSearchParams(window.location.search);
    const refCode = normalizeRef(searchParams.get("ref"));
    if (!refCode) return;
    if (readPendingRef()) return;
    writePendingRef(refCode);
  }, [pathname]);

  useEffect(() => {
    if (status !== "authenticated" || !session) return;
    const refCode = normalizeRef(readPendingRef());
    if (!refCode || lastBoundRef.current === refCode) return;

    lastBoundRef.current = refCode;
    bindMyFirstAgentReferral(refCode)
      .then(() => {
        clearPendingRef();
        void queryClient.invalidateQueries({
          queryKey: queryKeys.campaign.myFirstAgentSummary(),
        });
      })
      .catch(() => {
        lastBoundRef.current = null;
      });
  }, [queryClient, session, status]);

  return null;
}
