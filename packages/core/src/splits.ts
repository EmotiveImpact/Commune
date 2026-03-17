// ─── Split Calculation Functions ─────────────────────────────────────────────
// All monetary calculations use cents internally to avoid floating-point errors.

/**
 * Divide an amount equally among participants.
 * Remainder pennies are distributed one each to the first participants.
 *
 * @returns Array of share amounts (in the original currency unit, 2 decimal places).
 */
export function calculateEqualSplit(
  amount: number,
  participantCount: number,
): number[] {
  if (participantCount <= 0) {
    throw new Error('participantCount must be greater than 0');
  }

  const totalCents = Math.round(amount * 100);
  const baseCents = Math.floor(totalCents / participantCount);
  const remainder = totalCents - baseCents * participantCount;

  const shares: number[] = [];
  for (let i = 0; i < participantCount; i++) {
    const extra = i < remainder ? 1 : 0;
    shares.push(Number(((baseCents + extra) / 100).toFixed(2)));
  }

  return shares;
}

/**
 * Split an amount by percentage for each participant.
 *
 * @returns Array of { userId, amount } with amounts rounded to 2 decimals.
 */
export function calculatePercentageSplit(
  amount: number,
  participants: { userId: string; percentage: number }[],
): { userId: string; amount: number }[] {
  return participants.map((p) => ({
    userId: p.userId,
    amount: Number(((amount * p.percentage) / 100).toFixed(2)),
  }));
}

/**
 * Custom split — amounts are already specified per participant.
 * Validation (sum equals total) is handled by Zod schemas.
 */
export function calculateCustomSplit(
  participants: { userId: string; amount: number }[],
): { userId: string; amount: number }[] {
  return participants.map((p) => ({
    userId: p.userId,
    amount: p.amount,
  }));
}

/**
 * Given the shares for an expense and the payer, calculate what each
 * non-payer participant owes to the payer.
 */
export function calculateReimbursements(
  shares: { userId: string; amount: number }[],
  payerId: string,
): { userId: string; owesTo: string; amount: number }[] {
  return shares
    .filter((s) => s.userId !== payerId && s.amount > 0)
    .map((s) => ({
      userId: s.userId,
      owesTo: payerId,
      amount: s.amount,
    }));
}
