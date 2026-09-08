"use client";

import UsdcIcon from "@/components/shared/UsdcIcon";
import { useChain } from "@/lib/chain-context";
import { fmtDiscoveryUsd, hasDiscoveryMoney, isDiscoveryDust } from "@/lib/formatters";

/** BNB dust amount: a 0.12em gap keeps `<` and `$` readable without a mono space. */
export function DiscoveryMoney({
  amount,
  className = "",
}: {
  amount: number | null | undefined;
  className?: string;
}) {
  if (!hasDiscoveryMoney(amount)) return null;
  if (isDiscoveryDust(amount)) {
    return (
      <span className={`whitespace-nowrap ${className}`}>
        <span className="mr-[0.12em]">&lt;</span>
        $0.01
      </span>
    );
  }
  return <span className={className}>{fmtDiscoveryUsd(amount)}</span>;
}

/** Chain-appropriate currency mark: USDC glyph on Base, plain `$` on BNB. */
export function PriceMark({ size = 13 }: { size?: number }) {
  const { isInteractive } = useChain();
  return isInteractive ? <UsdcIcon size={size} /> : <span>$</span>;
}

/**
 * Price with a chain-appropriate mark. Base settles in USDC and shows the USDC
 * glyph; BNB Chain mode never settles here (payment happens off-site via x402),
 * so prices are shown as plain USD.
 */
export default function PriceValue({
  amount,
  iconSize = 13,
  className = "",
}: {
  amount: number;
  iconSize?: number;
  className?: string;
}) {
  const { isInteractive } = useChain();
  if (!isInteractive) {
    return <DiscoveryMoney amount={amount} className={`inline-flex items-center ${className}`} />;
  }

  return (
    <span className={`inline-flex items-center gap-0.5 ${className}`}>
      <PriceMark size={iconSize} />
      {amount.toFixed(2)}
    </span>
  );
}
