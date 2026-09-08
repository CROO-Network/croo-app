import {
  EventStreamContentType,
  fetchEventSource,
  type EventSourceMessage,
} from "@microsoft/fetch-event-source";

import type {
  SSEEvent,
  SSEEventPayloadMap,
  SSEEventType,
} from "@/types/navigator";

const DEFAULT_AI_BASE_URL = "https://api.croo.network/navigator/v1";

function getAiBaseUrl() {
  const configured = process.env.NEXT_PUBLIC_CROO_AI_BASE_URL?.trim();
  return (configured || DEFAULT_AI_BASE_URL).replace(/\/+$/, "");
}

export interface SSEStreamOptions {
  token: string;
  signal?: AbortSignal;
  onEvent: (event: SSEEvent) => void;
  onError?: (error: Error) => void;
  onUnauthorized?: () => void;
  onDone?: () => void;
}

interface RawEnvelope {
  id?: string;
  run_id?: string;
  runId?: string;
  sequence?: number;
  type?: SSEEventType;
  payload?: unknown;
}

const KNOWN_EVENT_TYPES: ReadonlySet<SSEEventType> = new Set([
  "tool_start",
  "tool_end",
  "assistant_message",
  "card",
  "done",
  "error",
]);

function isKnownEventType(value: unknown): value is SSEEventType {
  return typeof value === "string" && KNOWN_EVENT_TYPES.has(value as SSEEventType);
}

function parseMessage(msg: EventSourceMessage): SSEEvent | null {
  if (!msg.data) return null;

  let raw: RawEnvelope;
  try {
    raw = JSON.parse(msg.data) as RawEnvelope;
  } catch {
    return null;
  }

  const type = isKnownEventType(raw.type)
    ? raw.type
    : isKnownEventType(msg.event)
      ? (msg.event as SSEEventType)
      : null;
  if (!type) return null;

  const runId = raw.run_id ?? raw.runId;
  if (!runId) return null;

  const id = raw.id ?? msg.id ?? `${runId}:${raw.sequence ?? 0}`;

  return {
    id,
    runId,
    sequence: typeof raw.sequence === "number" ? raw.sequence : 0,
    type,
    payload: (raw.payload ?? {}) as SSEEventPayloadMap[typeof type],
  } as SSEEvent;
}

export async function createSSEStream(
  url: string,
  options: SSEStreamOptions,
): Promise<void> {
  const fullUrl = url.startsWith("http") ? url : `${getAiBaseUrl()}${url}`;

  let doneFired = false;
  const fireDoneOnce = () => {
    if (!doneFired) {
      doneFired = true;
      options.onDone?.();
    }
  };

  class StopStream extends Error {}

  try {
    await fetchEventSource(fullUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${options.token}`,
        Accept: "text/event-stream",
        "Cache-Control": "no-cache",
      },
      signal: options.signal,
      openWhenHidden: true,
      async onopen(response) {
        if (response.status === 401) {
          options.onUnauthorized?.();
          throw new SSEError("Unauthorized", 401);
        }
        if (!response.ok) {
          throw new SSEError(
            `SSE request failed with status ${response.status}`,
            response.status,
          );
        }
        const contentType = response.headers.get("content-type") ?? "";
        if (!contentType.includes(EventStreamContentType)) {
          throw new SSEError(
            `Unexpected content-type: ${contentType}`,
            response.status,
          );
        }
      },

      onmessage(msg) {
        const envelope = parseMessage(msg);
        if (!envelope) return;
        options.onEvent(envelope);
        if (envelope.type === "done") {
          fireDoneOnce();
          throw new StopStream();
        }
      },

      onclose() {
        fireDoneOnce();
        throw new StopStream();
      },

      onerror(err) {
        throw err;
      },
    });
  } catch (error) {
    if (options.signal?.aborted) {
      return;
    }
    if (error instanceof StopStream) {
      return;
    }
    if (error instanceof SSEError) {
      throw error;
    }
    const err = error instanceof Error ? error : new Error(String(error));
    options.onError?.(err);
    throw err;
  }
}

export class SSEError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "SSEError";
    this.status = status;
  }
}

export function buildStreamUrl(sessionId: string, runId?: string): string {
  const base = `/ai/conversations/${encodeURIComponent(sessionId)}/stream`;
  if (!runId) return base;
  return `${base}?run_id=${encodeURIComponent(runId)}`;
}

export const __test__ = { parseMessage };
