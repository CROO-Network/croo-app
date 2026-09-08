import { getHttpAccessToken, notifyUnauthorized } from "@/lib/http/auth";
import { ApiError, type ApiErrorBody } from "@/lib/http/errors";

const DEFAULT_AI_BASE_URL = "https://api.croo.network/navigator/v1";
const DEFAULT_API_BASE_URL = "https://api.croo.network/backend/v1";
const BACKEND_API_PREFIX = "/backend/v1";
const DEFAULT_TIMEOUT_MS = 20_000;

type JsonBody = Record<string, unknown> | unknown[];
type RequestBody = BodyInit | JsonBody | null;

export type ApiRequestOptions = Omit<RequestInit, "body"> & {
  body?: RequestBody;
  token?: string | null;
  timeoutMs?: number;
};

function getApiBaseUrl() {
  const configured = process.env.NEXT_PUBLIC_CROO_API_BASE_URL?.trim();
  return (configured || DEFAULT_API_BASE_URL).replace(/\/+$/, "");
}

function getAiBaseUrl() {
  const configured = process.env.NEXT_PUBLIC_CROO_AI_BASE_URL?.trim();
  return (configured || DEFAULT_AI_BASE_URL).replace(/\/+$/, "");
}

function stripBackendPrefix(path: string) {
  if (path === BACKEND_API_PREFIX) return "";
  if (path.startsWith(`${BACKEND_API_PREFIX}/`)) {
    return path.slice(BACKEND_API_PREFIX.length);
  }
  return path;
}

function resolveRequestUrl(path: string) {
  if (path.startsWith("http://") || path.startsWith("https://")) return path;

  const baseUrl = path.startsWith("/ai/") ? getAiBaseUrl() : getApiBaseUrl();
  const normalizedPath = baseUrl.endsWith(BACKEND_API_PREFIX)
    ? stripBackendPrefix(path)
    : path;
  return `${baseUrl}${normalizedPath}`;
}

function isBodyInit(body: RequestBody): body is BodyInit {
  return (
    typeof body === "string" ||
    body instanceof FormData ||
    body instanceof URLSearchParams ||
    body instanceof Blob ||
    body instanceof ArrayBuffer ||
    ArrayBuffer.isView(body)
  );
}

function buildBody(body: RequestBody | undefined, headers: Headers) {
  if (body === undefined || body === null) return undefined;
  if (isBodyInit(body)) return body;

  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  return JSON.stringify(body);
}

async function readJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  if (!text) return {} as T;
  return JSON.parse(text) as T;
}

function createAbortSignal(signal: AbortSignal | null | undefined, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  const abort = () => controller.abort();
  signal?.addEventListener("abort", abort);

  return {
    signal: controller.signal,
    cleanup() {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", abort);
    },
  };
}

async function request<T>(path: string, options: ApiRequestOptions = {}, token?: string | null) {
  const headers = new Headers(options.headers);
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  if (!headers.has("Accept")) {
    headers.set("Accept", "application/json");
  }
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const abort = createAbortSignal(options.signal, timeoutMs);

  try {
    const response = await fetch(resolveRequestUrl(path), {
      ...options,
      body: buildBody(options.body, headers),
      headers,
      signal: abort.signal,
    });

    if (!response.ok) {
      let body: ApiErrorBody = {};
      try {
        body = await readJson<ApiErrorBody>(response);
      } catch {
        body = {};
      }

      const error = new ApiError(response.status, body);
      if (response.status === 401 && !path.startsWith("/ai/")) {
        notifyUnauthorized();
      }
      throw error;
    }

    return readJson<T>(response);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ApiError(0, {
        reason: "REQUEST_TIMEOUT",
        message: "Request timed out.",
      });
    }
    throw new ApiError(0, {
      reason: "NETWORK_ERROR",
      message: error instanceof Error ? error.message : "Network request failed.",
    });
  } finally {
    abort.cleanup();
  }
}

export function publicRequest<T>(path: string, options: ApiRequestOptions = {}) {
  return request<T>(path, options);
}

export function authedRequest<T>(path: string, options: ApiRequestOptions = {}) {
  const token = options.token ?? getHttpAccessToken();
  if (!token) {
    notifyUnauthorized();
    throw new ApiError(401, {
      reason: "NOT_LOGIN",
      message: "not login",
    });
  }

  return request<T>(path, options, token);
}
