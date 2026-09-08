import { Check } from "lucide-react";

export function StatusDot({ status }: { status: "online" | "offline" }) {
  return (
    <span
      className={`inline-block h-1.5 w-1.5 rounded-full shrink-0 ${
        status === "online" ? "bg-[#6EE646]" : "bg-[#CACAC8]"
      }`}
    />
  );
}

export function CardShell({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-[#E2E2E0] bg-white overflow-hidden w-full ${className}`}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-4 py-3 border-b border-[#E2E2E0] bg-[#F8F8F7]">
      {children}
    </div>
  );
}

/** Action bar at the bottom of order-style cards (Confirm & Pay / Cancel / Confirmed / Cancelled). */
export function ActionRow({
  action,
  onConfirm,
  onCancel,
  confirmDisabled,
}: {
  action?: "confirmed" | "cancelled";
  onConfirm?: () => void;
  onCancel?: () => void;
  /** Visually + interactively disables the Confirm button (Cancel stays active). */
  confirmDisabled?: boolean;
}) {
  if (action === "confirmed") {
    return (
      <div className="px-4 py-3 border-t border-[#E2E2E0] flex items-center justify-end gap-1.5">
        <Check className="h-3.5 w-3.5 text-[#6EE646]" strokeWidth={2.5} />
        <span className="text-xs font-medium text-[#3D8C1F]">Order confirmed</span>
      </div>
    );
  }
  if (action === "cancelled") {
    return (
      <div className="px-4 py-3 border-t border-[#E2E2E0] flex items-center justify-end">
        <span className="text-xs text-[#9A9A9A]">Cancelled</span>
      </div>
    );
  }
  return (
    <div className="px-4 py-3 border-t border-[#E2E2E0] flex gap-2 justify-end">
      <button
        type="button"
        onClick={onCancel}
        className="px-4 py-2 text-xs font-medium text-[#6B6B6B] border border-[#E2E2E0] rounded-lg hover:bg-[#F5F5F3] transition-colors"
      >
        Cancel
      </button>
      <button
        type="button"
        onClick={onConfirm}
        disabled={confirmDisabled}
        aria-disabled={confirmDisabled || undefined}
        className="px-4 py-2 text-xs font-medium text-white bg-[#0F0F0F] rounded-lg hover:bg-[#1A1A1A] transition-colors disabled:bg-[#9A9A9A] disabled:cursor-not-allowed disabled:hover:bg-[#9A9A9A]"
      >
        Confirm &amp; Pay
      </button>
    </div>
  );
}
