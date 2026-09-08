"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { getAuthErrorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { invalidateMyFirstAgentCampaign } from "@/lib/campaign-cache";

function safeReturnPath(value: string | null): string {
  if (!value) return "/";
  if (!value.startsWith("/") || value.startsWith("//")) return "/";
  if (value.startsWith("/auth/callback")) return "/";
  return value;
}

function getTwitterCallbackErrorMessage(rawError: string | null): string {
  const normalized = (rawError || "").trim().toLowerCase();

  if (
    normalized === "access_denied" ||
    normalized === "cancelled" ||
    normalized === "canceled" ||
    normalized.includes("denied")
  ) {
    return "X connection was cancelled. Please try again when you are ready.";
  }

  if (normalized.includes("already bound")) {
    return "This X account is already connected to another CROO account.";
  }

  if (normalized.includes("timeout") || normalized.includes("expired")) {
    return "The X connection request expired. Please start again.";
  }

  if (normalized.includes("failed to get twitter user")) {
    return "CROO could not read your X profile. Please authorize again.";
  }

  if (normalized.includes("authorization failed")) {
    return "X authorization failed. Please try again.";
  }

  if (normalized.includes("internal error") || normalized.includes("failed to bind")) {
    return "CROO could not complete the X connection. Please try again later.";
  }

  return "X connection failed. Please try again.";
}

function getAgentTwitterCallbackErrorMessage(rawError: string | null): string {
  const normalized = (rawError || "").trim().toLowerCase();

  if (
    normalized === "access_denied" ||
    normalized === "cancelled" ||
    normalized === "canceled" ||
    normalized.includes("denied")
  ) {
    return "Agent X authorization was cancelled. Please authorize the target X account again.";
  }

  if (normalized.includes("failed to get twitter user")) {
    return "CROO could not read the authorized X profile. Please authorize again.";
  }

  if (normalized.includes("authorization failed")) {
    return "Agent X authorization failed. Please start from the operations link again.";
  }

  if (normalized.includes("schema_missing")) {
    return "Agent X authorization could not be saved because the backend schema is missing. Please apply the Agent X schema, then start from the operations link again.";
  }

  if (normalized.includes("authorization_save_failed")) {
    return "CROO could not save the Agent X authorization. Please check the backend logs, then start from the operations link again.";
  }

  if (normalized.includes("save")) {
    return "CROO could not save the Agent X authorization. Please try again later.";
  }

  return "Agent X authorization failed. Please start from the operations link again.";
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handleCopy}
      className="mt-2 inline-flex h-8 items-center rounded-lg bg-[#0F0F0F] px-3 text-xs font-medium text-white transition-colors hover:bg-[#1A1A1A] cursor-pointer"
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function AgentTwitterAuthorizationDisplay({
  msg,
  error,
  twitterId,
  username,
  nickname,
  avatarUrl,
}: {
  msg: string | null;
  error: string | null;
  twitterId: string | null;
  username: string | null;
  nickname: string | null;
  avatarUrl: string | null;
}) {
  const handle = (username || "").replace(/^@+/, "");
  const success = msg === "Success" && Boolean(twitterId) && Boolean(handle);
  const config = JSON.stringify(
    {
      bindType: "agent_twitter",
      twitterId: twitterId || "",
      handle,
      name: nickname || handle,
      profileImageUrl: avatarUrl || "",
      authorized: Boolean(success),
    },
    null,
    2,
  );

  return (
    <main className="min-h-screen bg-[#F5F5F3] px-6 pt-28">
      <div className="mx-auto max-w-lg rounded-lg border border-[#D8D8D3] bg-white p-7">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[#0F0F0F] text-sm font-semibold text-white">
            {success && avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              "X"
            )}
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-semibold text-[#0F0F0F]">
              {success ? "Agent X account authorized" : "Agent X authorization failed"}
            </h1>
            <p className="mt-2 text-sm leading-6 text-[#6B6B6B]">
              {success
                ? `@${handle} is ready for Agent X automation. Copy the config below and send it to development for campaign and poll target setup.`
                : getAgentTwitterCallbackErrorMessage(error)}
            </p>
          </div>
        </div>

        {success ? (
          <>
            <dl className="mt-6 grid gap-3 rounded-lg border border-[#E2E2E0] bg-[#FAFAF9] p-4 text-sm">
              <div className="flex items-center justify-between gap-4">
                <dt className="text-[#777772]">Handle</dt>
                <dd className="truncate font-medium text-[#0F0F0F]">@{handle}</dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-[#777772]">Twitter ID</dt>
                <dd className="truncate font-mono text-xs text-[#0F0F0F]">{twitterId}</dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-[#777772]">Name</dt>
                <dd className="truncate text-[#0F0F0F]">{nickname || handle}</dd>
              </div>
            </dl>
            <div className="mt-5 rounded-lg border border-[#E2E2E0] bg-[#101010] p-4 text-left">
              <p className="mb-3 text-[10px] font-mono uppercase tracking-widest text-[#A6A6A0]">
                Config
              </p>
              <pre className="overflow-x-auto whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-white">
                {config}
              </pre>
            </div>
            <CopyButton text={config} />
            <p className="mt-4 text-xs text-[#777772]">
              Numeric Twitter ID is required. Handle alone is not enough for poll target configuration.
            </p>
          </>
        ) : (
          <Link
            href="/"
            className="mt-6 inline-flex h-9 items-center rounded-full bg-[#0F0F0F] px-4 text-sm font-medium text-white transition-colors hover:bg-[#1A1A1A]"
          >
            Back to Store
          </Link>
        )}
      </div>
    </main>
  );
}

function AgentTokenDisplay({ token, userId }: { token: string; userId: string }) {
  const credential = JSON.stringify({ token, userId });
  return (
    <main className="min-h-screen bg-[#F5F5F3] px-6 pt-28">
      <div className="mx-auto max-w-md rounded-2xl border border-[#E2E2E0] bg-white p-7 text-center">
        <div className="mx-auto mb-5 flex h-11 w-11 items-center justify-center rounded-2xl bg-[#6EE646]/15">
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="#3D8C1F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <h1 className="text-lg font-semibold text-[#0F0F0F]">
          Login successful
        </h1>
        <p className="mt-2 text-sm text-[#6B6B6B]">
          Please copy the credential below and return it to your Agent.
        </p>
        <div className="mt-5 rounded-xl border border-[#E2E2E0] bg-[#FAFAF9] p-4 text-left">
          <p className="text-[10px] font-mono uppercase tracking-widest text-[#9A9A9A] mb-2">Credential</p>
          <pre className="text-xs font-mono text-[#0F0F0F] break-all whitespace-pre-wrap leading-relaxed">
            {credential}
          </pre>
        </div>
        <CopyButton text={credential} />
        <p className="mt-4 text-[11px] text-[#9A9A9A]">
          You can close this page after copying.
        </p>
      </div>
    </main>
  );
}

function GoogleLogo({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

function XLogo({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function CallbackProviderIcon({ provider }: { provider: "google" | "x" }) {
  const isX = provider === "x";
  return (
    <div
      className={`mx-auto mb-5 flex h-11 w-11 items-center justify-center rounded-2xl ${
        isX ? "bg-[#0F0F0F] text-white" : "bg-[#6EE646]/15"
      }`}
      role="img"
      aria-label={isX ? "X" : "Google"}
      data-testid="auth-callback-provider-icon"
    >
      {isX ? <XLogo /> : <GoogleLogo />}
    </div>
  );
}

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { completeGoogleLogin, refreshSession, status } = useAuth();
  const handledRef = useRef(false);
  const token = searchParams.get("token");
  const userId = searchParams.get("user_id") || searchParams.get("userId");
  const method = searchParams.get("method");
  const callbackMsg = searchParams.get("msg");
  const callbackError = searchParams.get("error");
  const mode = searchParams.get("mode");
  const returnPath = safeReturnPath(searchParams.get("returnTo"));
  const isAgentMode = mode === "agent";
  const isTwitterCallback = method === "twitter";
  const isAgentTwitterCallback = method === "agent_twitter";
  const missingParams = !isTwitterCallback && !isAgentTwitterCallback && (!token || !userId);
  const [message, setMessage] = useState(
    isTwitterCallback ? "Completing X connection..." : "Completing Google sign in...",
  );
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (handledRef.current || missingParams || isAgentMode || isTwitterCallback || isAgentTwitterCallback) return;
    if (!token || !userId) return;
    handledRef.current = true;

    completeGoogleLogin(token, userId)
      .then(() => {
        invalidateMyFirstAgentCampaign(queryClient);
        router.replace(returnPath);
      })
      .catch((error) => {
        setFailed(true);
        setMessage(getAuthErrorMessage(error));
      });
  }, [completeGoogleLogin, isAgentMode, isAgentTwitterCallback, isTwitterCallback, missingParams, queryClient, returnPath, router, token, userId]);

  useEffect(() => {
    if (handledRef.current || !isTwitterCallback || isAgentMode || isAgentTwitterCallback) return;
    if (callbackMsg === "Fail" || callbackError) {
      handledRef.current = true;
      queueMicrotask(() => {
        setFailed(true);
        setMessage(getTwitterCallbackErrorMessage(callbackError));
      });
      return;
    }
    if (status === "loading") return;

    handledRef.current = true;

    const completeTwitterCallback = async () => {
      try {
        if (status === "authenticated") {
          await refreshSession();
        }
      } catch {
        // Keep returning to the campaign; the page-level summary reconciliation
        // will retry with whatever auth state remains available.
      } finally {
        invalidateMyFirstAgentCampaign(queryClient);
        router.replace(returnPath);
      }
    };

    void completeTwitterCallback();
  }, [
    callbackError,
    callbackMsg,
    isAgentMode,
    isAgentTwitterCallback,
    isTwitterCallback,
    queryClient,
    refreshSession,
    returnPath,
    router,
    status,
  ]);

  if (isAgentTwitterCallback) {
    return (
      <AgentTwitterAuthorizationDisplay
        msg={callbackMsg}
        error={callbackError}
        twitterId={searchParams.get("twitter_id")}
        username={searchParams.get("twitter_username")}
        nickname={searchParams.get("twitter_nickname")}
        avatarUrl={searchParams.get("twitter_avatar_url")}
      />
    );
  }

  // Agent mode: show token for copying
  if (isAgentMode) {
    if (!token || !userId) {
      return (
        <main className="min-h-screen bg-[#F5F5F3] px-6 pt-28">
          <div className="mx-auto max-w-md rounded-2xl border border-[#E2E2E0] bg-white p-7 text-center">
            <h1 className="text-lg font-semibold text-[#0F0F0F]">Sign in failed</h1>
            <p className="mt-2 text-sm text-[#6B6B6B]">Google sign in did not return a valid session.</p>
            <Link
              href="/"
              className="mt-6 inline-flex h-9 items-center rounded-full bg-[#0F0F0F] px-4 text-sm font-medium text-white transition-colors hover:bg-[#1A1A1A]"
            >
              Back to Store
            </Link>
          </div>
        </main>
      );
    }
    return <AgentTokenDisplay token={token} userId={userId} />;
  }

  // Normal mode: existing flow
  const hasFailed = missingParams || failed;
  const displayMessage = missingParams
    ? "Google sign in did not return a valid session."
    : message;
  const title = isTwitterCallback
    ? hasFailed
      ? "X connection failed"
      : "Connecting X"
    : hasFailed
      ? "Sign in failed"
      : "Signing you in";

  return (
    <main className="min-h-screen bg-[#F5F5F3] px-6 pt-28">
      <div className="mx-auto max-w-md rounded-2xl border border-[#E2E2E0] bg-white p-7 text-center">
        <CallbackProviderIcon provider={isTwitterCallback ? "x" : "google"} />
        <h1 className="text-lg font-semibold text-[#0F0F0F]">
          {title}
        </h1>
        <p className="mt-2 text-sm text-[#6B6B6B]">{displayMessage}</p>
        {hasFailed && (
          <Link
            href="/"
            className="mt-6 inline-flex h-9 items-center rounded-full bg-[#0F0F0F] px-4 text-sm font-medium text-white transition-colors hover:bg-[#1A1A1A]"
          >
            Back to Store
          </Link>
        )}
      </div>
    </main>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-[#F5F5F3] px-6 pt-28">
          <div className="mx-auto max-w-md rounded-2xl border border-[#E2E2E0] bg-white p-7 text-center text-sm text-[#6B6B6B]">
            Preparing sign in...
          </div>
        </main>
      }
    >
      <AuthCallbackContent />
    </Suspense>
  );
}
