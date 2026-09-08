"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  getAuthorizationUrl,
  getChallenge,
  getMe,
  loginByWallet,
  type AuthUserInfo,
  type LoginMethod,
  type LoginResponse,
} from "@/lib/api";
import {
  clearHttpAccessToken,
  setHttpAccessToken,
  setUnauthorizedHandler,
} from "@/lib/http/auth";
import { isUnauthorizedError } from "@/lib/http/errors";
import { clearAllNavigatorPersistedState } from "@/lib/navigator-storage";

export type AuthStatus = "loading" | "authenticated" | "unauthenticated";

export interface Session {
  token: string;
  userId: string;
  loginMethod: LoginMethod;
  identifier: string;
  userInfo: AuthUserInfo;
  newUserFlag?: boolean;
  navigatorStatus?: string;
  createdAt: string;
}

interface AuthContextValue {
  status: AuthStatus;
  session: Session | null;
  startGoogleLogin: () => Promise<void>;
  completeGoogleLogin: (token: string, userId: string) => Promise<Session>;
  refreshSession: () => Promise<Session | null>;
  loginWithWallet: (
    walletAddr: string,
    signMessage: (message: string) => Promise<string>,
  ) => Promise<Session>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue>({
  status: "loading",
  session: null,
  startGoogleLogin: async () => {},
  completeGoogleLogin: async () => {
    throw new Error("AuthProvider is not mounted");
  },
  refreshSession: async () => null,
  loginWithWallet: async () => {
    throw new Error("AuthProvider is not mounted");
  },
  logout: () => {},
});

const SESSION_KEY = "croo_auth_session_v1";
const DEFAULT_LOGIN_RETURN_PATH = "/";

function getCurrentReturnPath(): string {
  const { pathname, search, hash } = window.location;
  if (pathname === "/auth/callback") {
    return DEFAULT_LOGIN_RETURN_PATH;
  }
  return `${pathname}${search}${hash}`;
}

function isSession(value: unknown): value is Session {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<Session>;
  return Boolean(candidate.token && candidate.userId && candidate.loginMethod);
}

function getIdentifier(method: LoginMethod, userId: string, userInfo?: AuthUserInfo) {
  if (method === "wallet") {
    return userInfo?.walletAddr || userId;
  }
  return userInfo?.email || userInfo?.googleName || userId;
}

function buildSession(method: LoginMethod, response: LoginResponse): Session {
  const userInfo = response.userInfo ?? { userId: response.userId };
  return {
    token: response.token,
    userId: response.userId || userInfo.userId,
    loginMethod: method,
    identifier: getIdentifier(method, response.userId || userInfo.userId, userInfo),
    userInfo,
    newUserFlag: response.newUserFlag,
    navigatorStatus: response.navigatorStatus,
    createdAt: new Date().toISOString(),
  };
}

function readStoredSession() {
  const localSession = localStorage.getItem(SESSION_KEY);
  if (localSession) return localSession;

  const legacySession = sessionStorage.getItem(SESSION_KEY);
  if (!legacySession) return null;

  localStorage.setItem(SESSION_KEY, legacySession);
  sessionStorage.removeItem(SESSION_KEY);
  return legacySession;
}

function parseSession(raw: string | null) {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    return isSession(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function sessionWithUserInfo(session: Session, userInfo: AuthUserInfo): Session {
  return {
    ...session,
    userInfo,
    identifier: getIdentifier(session.loginMethod, session.userId, userInfo),
  };
}

function storedSessionMatches(session: Session) {
  const current = parseSession(localStorage.getItem(SESSION_KEY));
  return current?.token === session.token && current.userId === session.userId;
}

function saveSession(session: Session) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  sessionStorage.removeItem(SESSION_KEY);
}

function clearStoredSession() {
  localStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(SESSION_KEY);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [session, setSession] = useState<Session | null>(null);

  const clearSession = useCallback(() => {
    clearStoredSession();
    clearHttpAccessToken();
    // Wipe any persisted Navigator conversation so the next user on
    // this browser doesn't inherit it. Defensive sweep — handles the
    // 401-unauthorized path where the userId may already be gone.
    clearAllNavigatorPersistedState();
    setSession(null);
    setStatus("unauthenticated");
  }, []);

  useEffect(() => {
    return setUnauthorizedHandler(clearSession);
  }, [clearSession]);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== SESSION_KEY) return;

      const nextSession = parseSession(event.newValue);
      if (nextSession) {
        setHttpAccessToken(nextSession.token);
        setSession(nextSession);
        setStatus("authenticated");
        return;
      }

      clearHttpAccessToken();
      clearAllNavigatorPersistedState();
      setSession(null);
      setStatus("unauthenticated");
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const hydrate = async () => {
      try {
        const stored = readStoredSession();
        if (!stored) {
          clearHttpAccessToken();
          if (!cancelled) setStatus("unauthenticated");
          return;
        }

        const parsed = parseSession(stored);
        if (!parsed) {
          clearStoredSession();
          if (!cancelled) setStatus("unauthenticated");
          return;
        }

        setHttpAccessToken(parsed.token);
        const me = await getMe(parsed.token);
        const userInfo = me.userInfo ?? parsed.userInfo;
        const nextSession = sessionWithUserInfo(parsed, userInfo);

        if (cancelled || !storedSessionMatches(parsed)) return;
        saveSession(nextSession);
        setSession(nextSession);
        setStatus("authenticated");
      } catch (error) {
        clearHttpAccessToken();
        if (isUnauthorizedError(error)) {
          clearStoredSession();
          if (cancelled) return;
          setSession(null);
          setStatus("unauthenticated");
          return;
        }

        const fallbackSession = parseSession(localStorage.getItem(SESSION_KEY));
        if (fallbackSession) {
          setHttpAccessToken(fallbackSession.token);
          if (cancelled) return;
          setSession(fallbackSession);
          setStatus("authenticated");
          return;
        }

        if (cancelled) return;
        setSession(null);
        setStatus("unauthenticated");
      }
    };

    void hydrate();

    return () => {
      cancelled = true;
    };
  }, []);

  const persist = useCallback((nextSession: Session) => {
    setHttpAccessToken(nextSession.token);
    saveSession(nextSession);
    setSession(nextSession);
    setStatus("authenticated");
    return nextSession;
  }, []);

  const refreshSession = useCallback(async () => {
    if (!session?.token) return null;
    const me = await getMe(session.token);
    const userInfo = me.userInfo ?? session.userInfo;
    const nextSession: Session = {
      ...session,
      userInfo,
      identifier: getIdentifier(session.loginMethod, session.userId, userInfo),
    };
    return persist(nextSession);
  }, [persist, session]);

  const startGoogleLogin = async () => {
    const callbackUrl = new URL("/auth/callback", window.location.origin);
    callbackUrl.searchParams.set("method", "google");
    callbackUrl.searchParams.set("returnTo", getCurrentReturnPath());
    const redirectUrl = callbackUrl.toString();
    const { authUrl } = await getAuthorizationUrl(redirectUrl);
    window.location.assign(authUrl);
  };

  const completeGoogleLogin = async (token: string, userId: string) => {
    const me = await getMe(token);
    return persist(
      buildSession("google", {
        token,
        userId,
        userInfo: me.userInfo ?? { userId },
      }),
    );
  };

  const loginWithWallet = async (
    walletAddr: string,
    signMessage: (message: string) => Promise<string>,
  ) => {
    if (!walletAddr) {
      throw new Error("No wallet account was selected.");
    }

    const challenge = await getChallenge();
    const signature = await signMessage(challenge.text);
    if (!signature) {
      throw new Error("No wallet signature was returned.");
    }

    const response = await loginByWallet({
      walletAddr,
      signature,
      originText: challenge.text,
    });

    return persist(buildSession("wallet", response));
  };

  return (
    <AuthContext.Provider
      value={{
        status,
        session,
        startGoogleLogin,
        completeGoogleLogin,
        refreshSession,
        loginWithWallet,
        logout: clearSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
