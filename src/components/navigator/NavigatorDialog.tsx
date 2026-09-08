"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

interface DialogContextValue {
  /** Trigger an animated close: flip isVisible to false, wait 300ms, then call onClose. */
  requestClose: () => void;
}

const DialogCtx = createContext<DialogContextValue | null>(null);

/** Components inside the dialog use this hook to trigger an animated close. */
export function useNavigatorDialogClose() {
  const ctx = useContext(DialogCtx);
  return ctx?.requestClose ?? null;
}

/**
 * Container dialog: 70vw × 70vh centered, scale animation, closes on ESC or
 * backdrop click, with backdrop-blur.
 *
 * Close flow: flip isVisible to false, wait for the 300ms transition to end,
 * then call onClose().
 */
export function NavigatorDialog({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (open) {
      // Double RAF so first paint commits isVisible=false before flipping true → triggers transition
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setIsVisible(true));
      });
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsVisible(false);
    }
  }, [open]);

  const requestClose = useCallback(() => {
    setIsVisible(false);
    setTimeout(() => onClose(), 300);
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") requestClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, requestClose]);

  const ctxValue = useMemo<DialogContextValue>(() => ({ requestClose }), [requestClose]);

  if (!open) return null;

  return (
    <DialogCtx.Provider value={ctxValue}>
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div
          className={`absolute inset-0 transition-opacity duration-300 ${
            isVisible ? "bg-black/50 backdrop-blur-sm" : "bg-transparent"
          }`}
          onClick={requestClose}
        />

        <div
          role="dialog"
          aria-modal="true"
          aria-label="CROO"
          className="relative z-10 w-[70vw] h-[70vh] bg-white rounded-2xl shadow-2xl border border-[#E2E2E0] flex flex-col overflow-hidden transition-all duration-300 ease-out"
          style={{
            opacity: isVisible ? 1 : 0,
            transform: isVisible ? "scale(1)" : "scale(0.95)",
          }}
        >
          {children}
        </div>
      </div>
    </DialogCtx.Provider>
  );
}
