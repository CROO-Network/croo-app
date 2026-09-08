let accessToken: string | null = null;
let unauthorizedHandler: (() => void) | null = null;

export function setHttpAccessToken(token: string | null) {
  accessToken = token;
}

export function clearHttpAccessToken() {
  accessToken = null;
}

export function getHttpAccessToken() {
  return accessToken;
}

export function setUnauthorizedHandler(handler: (() => void) | null) {
  unauthorizedHandler = handler;

  return () => {
    if (unauthorizedHandler === handler) {
      unauthorizedHandler = null;
    }
  };
}

export function notifyUnauthorized() {
  // Temporary diagnostic: log who triggers a session clear. The
  // post-login auto-logout investigation showed AI 401s alone
  // shouldn't be clearing session anymore — so any time this fires
  // we want a stack trace pointing at the actual caller. Remove
  // once the root cause is fully understood and verified.
  if (typeof window !== "undefined") {
    console.warn(
      "[auth] notifyUnauthorized triggered — clearing session",
      new Error("notifyUnauthorized call site").stack,
    );
  }
  unauthorizedHandler?.();
}
