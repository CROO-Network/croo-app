export type LoginMethodHint = "wallet" | "google" | "email";

export type ApiErrorBody = {
  code?: number;
  reason?: string;
  message?: string;
  metadata?: Record<string, string>;
  /**
   * AI service `NavigatorNotReadyEnvelope` surfaces the user's login method
   * at the top of the 409 body so the FE can branch on wallet vs custodial
   * deploy without a second `/me/navigator` round-trip. Accept both snake
   * and camel case for safety across producers.
   */
  loginMethod?: LoginMethodHint;
  login_method?: LoginMethodHint;
};

export class ApiError extends Error {
  status: number;
  reason?: string;
  code?: number;
  metadata?: Record<string, string>;
  loginMethod?: LoginMethodHint;

  constructor(status: number, body: ApiErrorBody = {}, fallback = "Request failed") {
    // FastAPI wraps HTTPException(detail=...) payloads under a top-level
    // `detail` key, while the Go BE returns Kratos errors flat (code /
    // reason / message at the root). Unwrap `detail` when it looks like
    // a nested envelope so callers can read `err.reason` / `err.loginMethod`
    // regardless of which backend produced the error.
    const detail = (body as { detail?: unknown }).detail;
    const envelope: ApiErrorBody =
      detail && typeof detail === "object" && !Array.isArray(detail)
        ? (detail as ApiErrorBody)
        : body;
    super(envelope.message || envelope.reason || fallback);
    this.name = "ApiError";
    this.status = status;
    this.reason = envelope.reason;
    this.code = envelope.code;
    this.metadata = envelope.metadata;
    this.loginMethod = envelope.loginMethod ?? envelope.login_method;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

export function isUnauthorizedError(error: unknown) {
  return isApiError(error) && error.status === 401;
}

export function isForbiddenError(error: unknown) {
  return isApiError(error) && error.status === 403;
}

export function isRateLimitError(error: unknown) {
  return isApiError(error) && error.status === 429;
}

export function getAuthErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.reason === "WALLET_NOT_WHITELISTED") {
      return "This wallet is not whitelisted for registration yet.";
    }
    if (error.reason === "CHALLENGE_INVALID") {
      return "The wallet challenge expired. Please try again.";
    }
    if (error.reason === "SIGNATURE_INVALID") {
      return "Wallet signature verification failed.";
    }
    if (error.reason === "NOT_LOGIN" || error.status === 401) {
      return "Your session expired. Please connect again.";
    }
    if (error.status === 429) {
      return "Too many requests. Please try again later.";
    }
    if (error.status >= 500) {
      return "The service is temporarily unavailable. Please try again later.";
    }
    return error.message;
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    if (message.includes("user rejected") || message.includes("rejected")) {
      return "Wallet signature was rejected.";
    }
    return error.message;
  }

  return "Something went wrong. Please try again.";
}
