"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { ConnectModal } from "@/components/auth/ConnectModal";

interface ConnectModalContextValue {
  openConnectModal: () => void;
}

const ConnectModalContext = createContext<ConnectModalContextValue>({
  openConnectModal: () => {},
});

export function ConnectModalProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const openConnectModal = useCallback(() => setOpen(true), []);
  const value = useMemo(() => ({ openConnectModal }), [openConnectModal]);

  return (
    <ConnectModalContext value={value}>
      {children}
      <ConnectModal externalOpen={open} onExternalOpenChange={setOpen} />
    </ConnectModalContext>
  );
}

export function useConnectModal() {
  return useContext(ConnectModalContext);
}
