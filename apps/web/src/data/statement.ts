import type { Share } from "../live/model";

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
  /** Calendar day the entry happened (YYYY-MM-DD). */
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

const day = (value: string | null | undefined) => (value ?? "").slice(0, 10);

/**
 * Everything between the viewer and one other member, oldest first: each share
 * one owes the other, each repayment recorded against it, each reversal, and
 * voided bills (shown, but never counted). The closing balance equals the sum
 * of the open shares between the two, so it matches Settle.
 */
export function buildStatement(expenses: StatementExpense[], viewerId: string, otherId: string, otherName: string): Statement {
  const rows: Array<Omit<StatementEntry, "balanceMinor"> & { order: string }> = [];
  for (const expense of expenses) {
    const youPaid = expense.paidByUserId === viewerId;
    const theyPaid = expense.paidByUserId === otherId;
    if (!youPaid && !theyPaid) continue;
    const share = expense.shares.find((item) => item.userId === (youPaid ? otherId : viewerId));
    if (!share || share.amountMinor <= 0) continue;
    // Seen from the viewer: a share they owe you counts up, one you owe counts down.
    const sign = youPaid ? 1 : -1;
    const created = expense.createdAt ?? "";
    const whose = youPaid ? `${otherName}’s share` : "Your share";
    if (expense.voidedAt) {
      rows.push({ key: `${expense.id}-void`, expenseId: expense.id, on: day(expense.voidedAt), order: expense.voidedAt,
        kind: "voided", description: `${expense.name} · voided${expense.voidReason ? `: ${expense.voidReason}` : ""}`, amountMinor: 0 });
      continue;
    }
    rows.push({ key: `${share.id}-share`, expenseId: expense.id, on: day(created), order: created,
      kind: "share", description: `${whose} of ${expense.name}`, amountMinor: sign * share.amountMinor });
    for (const receipt of share.receipts ?? []) {
      const payer = youPaid ? otherName : "You";
      rows.push({ key: `${receipt.id}-paid`, expenseId: expense.id, on: receipt.receivedOn, order: receipt.recordedAt,
        kind: "repayment", description: `${payer} repaid · ${expense.name}${receipt.reference ? ` · ${receipt.reference}` : ""}`,
        amountMinor: -sign * receipt.amountMinor });
      if (receipt.reversedAt) {
        rows.push({ key: `${receipt.id}-reversed`, expenseId: expense.id, on: day(receipt.reversedAt), order: receipt.reversedAt,
          kind: "reversal", description: `Repayment reversed · ${expense.name}${receipt.reversalReason ? `: ${receipt.reversalReason}` : ""}`,
          amountMinor: sign * receipt.amountMinor });
      }
    }
  }
  rows.sort((a, b) => a.on.localeCompare(b.on) || a.order.localeCompare(b.order) || a.key.localeCompare(b.key));
  let balance = 0;
  const entries = rows.map(({ order: _order, ...row }) => {
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
