import { equalShares } from "./format";
import type { Expense } from "./types";

export type Draft = { title: string; amountMinor: number; category: string; dueOn: string | null; paidByUserId: string; included: string[] };

/**
 * The shares a corrected bill will have. While the amount and the people are
 * as they were, the shares stay exactly as they were (an uneven split made on
 * the web is kept). Change either and it is split equally between the people
 * chosen. Null when nobody is chosen or it is less than a penny each.
 */
export function correctedShares(expense: Expense, draft: Pick<Draft, "amountMinor" | "included">): { shares: Array<{ userId: string; amountMinor: number }>; kept: boolean } | null {
  const before = expense.shares.map((share) => share.userId);
  const same = draft.amountMinor === expense.amountMinor && draft.included.length === before.length && draft.included.every((id) => before.includes(id));
  if (same) return { shares: expense.shares.map((share) => ({ userId: share.userId, amountMinor: share.amountMinor })), kept: true };
  if (!draft.included.length || draft.amountMinor <= 0) return null;
  try { return { shares: equalShares(draft.amountMinor, draft.included), kept: false }; } catch { return null; }
}

/** Whether anything differs from the bill as it was opened. */
export function changed(expense: Expense, draft: Draft): boolean {
  const before = expense.shares.map((share) => share.userId).sort().join(",");
  return draft.title.trim() !== expense.title || draft.amountMinor !== expense.amountMinor || draft.category !== (expense.category ?? "Other")
    || (draft.dueOn ?? null) !== (expense.dueOn ?? null) || draft.paidByUserId !== expense.paidByUserId || [...draft.included].sort().join(",") !== before;
}

/** True when the split was even (to the penny), so an equal split after a change says nothing new. */
export function wasEven(expense: Expense): boolean {
  const amounts = expense.shares.map((share) => share.amountMinor);
  return Math.max(...amounts) - Math.min(...amounts) <= 1;
}
