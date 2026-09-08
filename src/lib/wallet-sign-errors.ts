/** True when the user dismissed or rejected a wallet signature request. */
export function isWalletSignatureRejected(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { name?: string; code?: number | string; shortMessage?: string; message?: string };
  if (e.name === "UserRejectedRequestError") return true;
  if (e.code === 4001 || e.code === "4001" || e.code === "ACTION_REJECTED") return true;
  const msg = `${e.shortMessage ?? ""} ${e.message ?? ""}`.toLowerCase();
  return (
    msg.includes("user rejected") ||
    msg.includes("user denied") ||
    msg.includes("rejected the request")
  );
}
