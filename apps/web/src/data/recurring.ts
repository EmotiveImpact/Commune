/**
 * The saved split scaled to a different total, exactly as the server does it
 * (commune_private.scale_recurring_shares): each share in proportion, rounded
 * down, then the leftover pennies to the largest remainders, ties in saved
 * order. Shares that round to nothing are left out. Preview only: the server
 * computes the split it records.
 */
export function scaleRecurringShares(
  shares: Array<{ userId: string; amountMinor: number }>,
  amountMinor: number,
): Array<{ userId: string; amountMinor: number }> {
  const total = shares.reduce((sum, share) => sum + BigInt(share.amountMinor), 0n);
  if (total <= 0n || amountMinor <= 0) return [];
  const target = BigInt(amountMinor);
  const parts = shares.map((share, order) => {
    const product = target * BigInt(share.amountMinor);
    return { userId: share.userId, order, base: product / total, rem: product % total };
  });
  let spare = target - parts.reduce((sum, part) => sum + part.base, 0n);
  const ranked = [...parts].sort((a, b) => (a.rem === b.rem ? a.order - b.order : a.rem > b.rem ? -1 : 1));
  const bonus = new Set<number>();
  for (const part of ranked) {
    if (spare <= 0n) break;
    bonus.add(part.order);
    spare -= 1n;
  }
  return parts
    .map((part) => ({ userId: part.userId, amountMinor: Number(part.base + (bonus.has(part.order) ? 1n : 0n)) }))
    .filter((share) => share.amountMinor > 0);
}
