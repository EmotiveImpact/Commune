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
 * Uses cents internally and distributes remainder pennies to avoid rounding drift.
 *
 * @returns Array of { userId, amount } with amounts that sum exactly to the total.
 */
export function calculatePercentageSplit(
  amount: number,
  participants: { userId: string; percentage: number }[],
): { userId: string; amount: number }[] {
  const totalCents = Math.round(amount * 100);
  const rawCents = participants.map((p) => (totalCents * p.percentage) / 100);
  const flooredCents = rawCents.map((c) => Math.floor(c));
  let remainder = totalCents - flooredCents.reduce((a, b) => a + b, 0);

  // Distribute remainder pennies to entries with the largest fractional parts
  const indexed = rawCents
    .map((c, i) => ({ i, frac: c - flooredCents[i]! }))
    .sort((a, b) => b.frac - a.frac);

  for (const entry of indexed) {
    if (remainder <= 0) break;
    flooredCents[entry.i]!++;
    remainder--;
  }

  return participants.map((p, i) => ({
    userId: p.userId,
    amount: Number((flooredCents[i]! / 100).toFixed(2)),
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
