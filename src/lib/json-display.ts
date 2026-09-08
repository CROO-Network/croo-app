export type JsonDisplayPayload =
  | { kind: "empty" }
  | { kind: "json"; formatted: string }
  | { kind: "text"; text: string };

/** Normalize API / form values for pretty JSON or plain-text display. */
export function toJsonDisplayPayload(value: unknown): JsonDisplayPayload {
  if (value == null) return { kind: "empty" };

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return { kind: "empty" };
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (parsed !== null && typeof parsed === "object") {
        return { kind: "json", formatted: JSON.stringify(parsed, null, 2) };
      }
      return { kind: "text", text: trimmed };
    } catch {
      return { kind: "text", text: trimmed };
    }
  }

  if (typeof value === "object") {
    if (Array.isArray(value)) {
      return value.length === 0
        ? { kind: "empty" }
        : { kind: "json", formatted: JSON.stringify(value, null, 2) };
    }
    const keys = Object.keys(value as Record<string, unknown>);
    if (keys.length === 0) return { kind: "empty" };
    return { kind: "json", formatted: JSON.stringify(value, null, 2) };
  }

  const text = String(value).trim();
  return text ? { kind: "text", text } : { kind: "empty" };
}
