"use client";

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";

/* ── Types ─────────────────────────────────────── */

interface ToastItem {
  id: number;
  message: string;
  visible: boolean;
}

interface ToastContextValue {
  showToast: (message: string) => void;
}

/* ── Context ───────────────────────────────────── */

const ToastContext = createContext<ToastContextValue>({ showToast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

/* ── Single toast element ──────────────────────── */

function ToastElement({ message, onDone }: { message: string; onDone: () => void }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Trigger enter animation on next frame
    requestAnimationFrame(() => setShow(true));
    const timer = setTimeout(() => {
      setShow(false);
      setTimeout(onDone, 300); // Wait for exit animation
    }, 2200);
    return () => clearTimeout(timer);
  }, [onDone]);

  return (
    <div
      className="pointer-events-auto rounded-full border border-[#E2E2E0] bg-white px-5 py-2.5 text-sm font-medium text-[#0F0F0F] shadow-lg transition-all duration-300"
      style={{
        opacity: show ? 1 : 0,
        transform: show ? "translateY(0)" : "translateY(-8px)",
      }}
    >
      {message}
    </div>
  );
}

/* ── Provider + Renderer ───────────────────────── */

let nextId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = useCallback((message: string) => {
    const id = nextId++;
    setToasts((prev) => [...prev, { id, message, visible: true }]);
  }, []);

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext value={{ showToast }}>
      {children}
      {/* Toast container — fixed top center */}
      <div className="fixed top-6 left-1/2 z-[100] flex -translate-x-1/2 flex-col items-center gap-2 pointer-events-none">
        {toasts.map((toast) => (
          <ToastElement
            key={toast.id}
            message={toast.message}
            onDone={() => removeToast(toast.id)}
          />
        ))}
      </div>
    </ToastContext>
  );
}
