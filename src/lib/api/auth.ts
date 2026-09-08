import { authedRequest, publicRequest } from "@/lib/http/client";

export type LoginMethod = "wallet" | "google";

export interface AuthUserTwitter {
  twitterId?: string;
  username?: string;
  name?: string;
  profileImageUrl?: string;
  verified?: boolean;
  protected?: boolean;
  verifiedAt?: string;
  connected?: boolean;
}

export interface AuthUserInfo {
  userId: string;
  email?: string;
  googleName?: string;
  googlePicture?: string;
  walletAddr?: string;
  /** Persistent pixel identicon from backend (SVG data URL). */
  avatar?: string;
  twitter?: AuthUserTwitter;
}

export interface LoginResponse {
  userInfo?: AuthUserInfo;
  token: string;
  userId: string;
  newUserFlag?: boolean;
  navigatorStatus?: string;
}

export interface MeResponse {
  userInfo?: AuthUserInfo;
}

export interface ChallengeResponse {
  text: string;
}

export interface AuthorizationUrlResponse {
  authUrl: string;
}

export function getAuthorizationUrl(redirectUrl: string) {
  const params = new URLSearchParams({
    flow: "login",
    type: "google",
    redirect_url: redirectUrl,
  });

  return publicRequest<AuthorizationUrlResponse>(
    `/backend/v1/auth/url?${params.toString()}`,
  );
}

export function getTwitterAuthorizationUrl(redirectUrl: string) {
  const params = new URLSearchParams({
    flow: "bind",
    type: "twitter",
    redirect_url: redirectUrl,
  });

  return authedRequest<AuthorizationUrlResponse>(
    `/backend/v1/auth/url?${params.toString()}`,
  );
}

export function getAgentTwitterAuthorizationUrl(redirectUrl: string) {
  const params = new URLSearchParams({
    flow: "agent_twitter_bind",
    type: "twitter",
    redirect_url: redirectUrl,
  });

  return publicRequest<AuthorizationUrlResponse>(
    `/backend/v1/auth/url?${params.toString()}`,
  );
}

export function getChallenge() {
  return publicRequest<ChallengeResponse>("/backend/v1/auth/challenge");
}

export function loginByWallet(input: {
  walletAddr: string;
  signature: string;
  originText: string;
}) {
  return publicRequest<LoginResponse>("/backend/v1/auth/login", {
    method: "POST",
    body: {
      type: "wallet",
      wallet_addr: input.walletAddr,
      signature: input.signature,
      origin_text: input.originText,
    },
  });
}

export function getMe(token?: string) {
  return authedRequest<MeResponse>("/backend/v1/auth/me", { token });
}
