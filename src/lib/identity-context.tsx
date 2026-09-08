"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";

export type Identity = "human" | "agent";

interface IdentityContextValue {
  /** Whether the identity gate (full-screen choose overlay) is visible */
  open: boolean;
  /** Persisted identity choice (null until user picks for the first time) */
  identity: Identity | null;
  /** Open the gate (used by header trigger / programmatic re-open) */
  openGate: () => void;
  /** Close the gate */
  closeGate: () => void;
  /** Set identity choice (also persists to localStorage) */
  setIdentity: (id: Identity) => void;
}

const Ctx = createContext<IdentityContextValue | null>(null);
const STORAGE_KEY = "croo_identity_choice";

function readStoredIdentity(): Identity | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw === "human" || raw === "agent" ? raw : null;
  } catch {
    return null;
  }
}

export function IdentityProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [identity, setIdentityState] = useState<Identity | null>(readStoredIdentity);

  // If there is no persisted choice, auto-open the gate after the app shell mounts.
  useEffect(() => {
    if (identity) return;
    const timer = setTimeout(() => setOpen(true), 50);
    return () => clearTimeout(timer);
  }, [identity]);

  const openGate = useCallback(() => setOpen(true), []);
  const closeGate = useCallback(() => setOpen(false), []);

  const setIdentity = useCallback((id: Identity) => {
    setIdentityState(id);
    try { localStorage.setItem(STORAGE_KEY, id); } catch {}
  }, []);

  return (
    <Ctx.Provider value={{ open, identity, openGate, closeGate, setIdentity }}>
      {children}
    </Ctx.Provider>
  );
}

export function useIdentity() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useIdentity must be used within IdentityProvider");
  return ctx;
}
