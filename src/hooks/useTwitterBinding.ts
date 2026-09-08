"use client";

import { useCallback, useState } from "react";
import { useToast } from "@/components/shared/Toast";
import { getTwitterAuthorizationUrl } from "@/lib/api/auth";
import { useAuth } from "@/lib/auth";
import { getAuthErrorMessage } from "@/lib/http/errors";

export function useTwitterBinding() {
  const { session, status } = useAuth();
  const { showToast } = useToast();
  const [connecting, setConnecting] = useState(false);

  const twitter = session?.userInfo.twitter;
  const twitterHandle =
    twitter?.connected && twitter.username ? twitter.username : null;

  const connectTwitter = useCallback(async () => {
    if (connecting || status !== "authenticated") return;
    setConnecting(true);
    try {
      const callbackUrl = new URL("/auth/callback", window.location.origin);
      callbackUrl.searchParams.set("method", "twitter");
      callbackUrl.searchParams.set(
        "returnTo",
        `${window.location.pathname}${window.location.search}${window.location.hash}`,
      );
      const { authUrl } = await getTwitterAuthorizationUrl(callbackUrl.toString());
      window.location.assign(authUrl);
    } catch (error) {
      setConnecting(false);
      showToast(getAuthErrorMessage(error));
    }
  }, [connecting, showToast, status]);

  return {
    twitterHandle,
    connecting,
    connectTwitter,
  };
}
