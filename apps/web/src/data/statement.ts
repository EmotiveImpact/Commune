import type { Share } from "../live/model";
import { timestampDay } from "./operations";

/** The expense fields a statement needs. */
export type StatementExpense = {
  id: string;
  name: string;
  createdAt?: string;
  paidByUserId: string;
  voidedAt?: string | null;
  voidReason?: string | null;
  shares: Share[];
};

export type StatementEntry = {
  key: string;
  expenseId: string;
  /** Calendar day the entry happened where the member is (YYYY-MM-DD). */
  on: string;
  kind: "share" | "repayment" | "reversal" | "voided";
  description: string;
  /** Positive: they owe you more. Negative: you owe them more (or they paid you). */
  amountMinor: number;
  /** Net position after this entry. Positive: they owe you. */
  balanceMinor: number;
};

export type Statement = {
  entries: StatementEntry[];
  /** Positive: they owe you. Negative: you owe them. */
  netMinor: number;
};

/** Where a row sorts: by day, then by when it was recorded, then share, repayment, reversal. */
type Placed = Omit<StatementEntry, "balanceMinor"> & { sortOn: string; at: number; step: number };

const recordedAt = (timestamp: string | null | undefined) => Date.parse(timestamp ?? "") || 0;
const later = (a: string, b: string) => (a > b ? a : b);

/**
 * Everything between the viewer and one other member, oldest first: each share
 * one owes the other, each repayment recorded against it, each reversal, and
 * voided bills (shown, but never counted). Entries are dated by the member's
 * own calendar day. A repayment is never listed before the share it pays, nor
 * a reversal before its repayment, even when the money arrived before the bill
 * was entered; it keeps its own date. The closing balance equals the sum of
 * the open shares between the two, so it matches Settle.
 */
export function buildStatement(expenses: StatementExpense[], viewerId: string, otherId: string, otherName: string): Statement {
  const rows: Placed[] = [];
  for (const expense of expenses) {
    const youPaid = expense.paidByUserId === viewerId;
    const theyPaid = expense.paidByUserId === otherId;
    if (!youPaid && !theyPaid) continue;
    const share = expense.shares.find((item) => item.userId === (youPaid ? otherId : viewerId));
    if (!share || share.amountMinor <= 0) continue;
    // Seen from the viewer: a share they owe you counts up, one you owe counts down.
    const sign = youPaid ? 1 : -1;
    const whose = youPaid ? `${otherName}’s share` : "Your share";
    if (expense.voidedAt) {
      const on = timestampDay(expense.voidedAt);
      rows.push({ key: `${expense.id}-void`, expenseId: expense.id, on, sortOn: on, at: recordedAt(expense.voidedAt), step: 0,
        kind: "voided", description: `${expense.name} · voided${expense.voidReason ? `: ${expense.voidReason}` : ""}`, amountMinor: 0 });
      continue;
    }
    const shareOn = timestampDay(expense.createdAt);
    const shareAt = recordedAt(expense.createdAt);
    rows.push({ key: `${share.id}-share`, expenseId: expense.id, on: shareOn, sortOn: shareOn, at: shareAt, step: 0,
      kind: "share", description: `${whose} of ${expense.name}`, amountMinor: sign * share.amountMinor });
    for (const receipt of share.receipts ?? []) {
      const payer = youPaid ? otherName : "You";
      const paidOn = later(receipt.receivedOn, shareOn);
      const paidAt = Math.max(recordedAt(receipt.recordedAt), shareAt);
      rows.push({ key: `${receipt.id}-paid`, expenseId: expense.id, on: receipt.receivedOn, sortOn: paidOn, at: paidAt, step: 1,
        kind: "repayment", description: `${payer} repaid · ${expense.name}${receipt.reference ? ` · ${receipt.reference}` : ""}`,
        amountMinor: -sign * receipt.amountMinor });
      if (receipt.reversedAt) {
        const on = timestampDay(receipt.reversedAt);
        rows.push({ key: `${receipt.id}-reversed`, expenseId: expense.id, on, sortOn: later(on, paidOn),
          at: Math.max(recordedAt(receipt.reversedAt), paidAt), step: 2,
          kind: "reversal", description: `Repayment reversed · ${expense.name}${receipt.reversalReason ? `: ${receipt.reversalReason}` : ""}`,
          amountMinor: sign * receipt.amountMinor });
      }
    }
  }
  rows.sort((a, b) => a.sortOn.localeCompare(b.sortOn) || a.at - b.at || a.step - b.step || a.key.localeCompare(b.key));
  let balance = 0;
  const entries = rows.map(({ sortOn: _sortOn, at: _at, step: _step, ...row }) => {
    balance += row.amountMinor;
    return { ...row, balanceMinor: balance };
  });
  return { entries, netMinor: balance };
}

export function csvCell(value: string, text = true): string {
  // Quote every cell, and stop a spreadsheet treating text as a formula.
  const safe = text && /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

/** A plain CSV of the statement, amounts in major units. */
export function statementCsv(statement: Statement, currency: string): string {
  const amount = (minor: number) => (minor / 100).toFixed(2);
  const lines = [["Date", "Entry", `Amount (${currency})`, `Balance (${currency})`].map((cell) => csvCell(cell)).join(",")];
  for (const entry of statement.entries) {
    lines.push([csvCell(entry.on), csvCell(entry.description),
      csvCell(amount(entry.amountMinor), false), csvCell(amount(entry.balanceMinor), false)].join(","));
  }
  return `${lines.join("\r\n")}\r\n`;
}
