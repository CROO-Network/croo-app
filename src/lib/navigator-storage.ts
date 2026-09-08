"use client";

const STORAGE_KEY_PREFIX = "navigator:state:";

function storageKey(userId: string | null | undefined): string | null {
  if (!userId) return null;
  return `${STORAGE_KEY_PREFIX}${userId}`;
}

/**
 * Remove the persisted Navigator state for a specific user. Exported in
 * case a caller has the userId handy.
 */
export function clearNavigatorPersistedState(
  userId: string | null | undefined,
): void {
  if (typeof window === "undefined") return;
  const key = storageKey(userId);
  if (!key) return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

/**
 * Defensive sweep: clear every persisted Navigator state regardless of
 * userId. Used from logout where we may already have torn down the
 * session before this runs, leaving us without an id to compute the key.
 */
export function clearAllNavigatorPersistedState(): void {
  if (typeof window === "undefined") return;
  try {
    for (let i = window.localStorage.length - 1; i >= 0; i--) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith(STORAGE_KEY_PREFIX)) {
        window.localStorage.removeItem(k);
      }
    }
  } catch {
    // ignore
  }
}
