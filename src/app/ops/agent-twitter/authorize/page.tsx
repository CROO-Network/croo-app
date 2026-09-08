"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { getAgentTwitterAuthorizationUrl } from "@/lib/api/auth";
import { getAuthErrorMessage } from "@/lib/http/errors";

const subscribeToOrigin = () => () => {};
const getBrowserOrigin = () =>
  typeof window === "undefined" ? "" : window.location.origin;
const getServerOrigin = () => "";

function buildCallbackUrl(origin: string) {
  const callbackUrl = new URL("/auth/callback", origin);
  callbackUrl.searchParams.set("method", "agent_twitter");
  return callbackUrl.toString();
}

function buildRawAuthorizationPath(callbackUrl: string) {
  const params = new URLSearchParams({
    flow: "agent_twitter_bind",
    type: "twitter",
    redirect_url: callbackUrl,
  });
  return `/backend/v1/auth/url?${params.toString()}`;
}

export default function AgentTwitterAuthorizePage() {
  const [error, setError] = useState("");
  const origin = useSyncExternalStore(
    subscribeToOrigin,
    getBrowserOrigin,
    getServerOrigin,
  );

  const callbackUrl = useMemo(
    () => (origin ? buildCallbackUrl(origin) : ""),
    [origin],
  );
  const rawPath = useMemo(
    () => (callbackUrl ? buildRawAuthorizationPath(callbackUrl) : ""),
    [callbackUrl],
  );

  useEffect(() => {
    if (!callbackUrl) return;
    let cancelled = false;

    getAgentTwitterAuthorizationUrl(callbackUrl)
      .then(({ authUrl }) => {
        if (!cancelled) window.location.assign(authUrl);
      })
      .catch((err) => {
        if (!cancelled) setError(getAuthErrorMessage(err));
      });

    return () => {
      cancelled = true;
    };
  }, [callbackUrl]);

  return (
    <main className="min-h-screen bg-[#F5F5F3] px-6 pt-28">
      <div className="mx-auto max-w-lg rounded-lg border border-[#D8D8D3] bg-white p-7">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-[#777772]">
          Operations
        </p>
        <h1 className="mt-3 text-xl font-semibold text-[#0F0F0F]">
          Agent X Authorization
        </h1>
        <p className="mt-3 text-sm leading-6 text-[#6B6B6B]">
          {error
            ? "CROO could not create the X authorization URL."
            : "Preparing the X authorization request. You will be redirected to X shortly."}
        </p>

        {error ? (
          <>
            <p className="mt-4 rounded-lg border border-[#F0D6D6] bg-[#FFF6F6] p-3 text-sm text-[#9E2B2B]">
              {error}
            </p>
            {rawPath ? (
              <div className="mt-5 rounded-lg border border-[#E2E2E0] bg-[#FAFAF9] p-4">
                <p className="mb-2 text-[10px] font-mono uppercase tracking-widest text-[#9A9A9A]">
                  Raw endpoint
                </p>
                <pre className="whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-[#0F0F0F]">
                  {rawPath}
                </pre>
              </div>
            ) : null}
            <Link
              href="/"
              className="mt-6 inline-flex h-9 items-center rounded-full bg-[#0F0F0F] px-4 text-sm font-medium text-white transition-colors hover:bg-[#1A1A1A]"
            >
              Back to Store
            </Link>
          </>
        ) : (
          <div className="mt-6 flex items-center gap-3 text-sm text-[#777772]">
            <span className="h-2 w-2 animate-pulse rounded-full bg-[#0F0F0F]" />
            Redirecting to X OAuth
          </div>
        )}
      </div>
    </main>
  );
}
