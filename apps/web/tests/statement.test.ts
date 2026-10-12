// @vitest-environment node
import { describe, expect, it } from "vitest";
import { buildStatement, statementCsv, type StatementExpense } from "../src/data/statement";

const receipt = (id: string, amountMinor: number, receivedOn: string, extra: Record<string, unknown> = {}) => ({
  id, amountMinor, receivedOn, reference: null, recordedBy: "me", recordedAt: `${receivedOn}T10:00:00Z`,
  origin: "recorded" as const, reversedAt: null, reversedBy: null, reversalReason: null, ...extra,
});
const expenses: StatementExpense[] = [
  { id: "e1", name: "Groceries", createdAt: "2026-01-01T09:00:00Z", paidByUserId: "me", shares: [
    { id: "s1", userId: "me", amountMinor: 3000, settledMinor: 3000 },
    { id: "s2", userId: "sam", amountMinor: 3000, settledMinor: 1000, receipts: [
      receipt("r1", 1000, "2026-01-03"),
      receipt("r2", 500, "2026-01-04", { reversedAt: "2026-01-05T08:00:00Z", reversedBy: "me", reversalReason: "Bounced" }),
    ] },
    { id: "s3", userId: "ana", amountMinor: 3000, settledMinor: 0 },
  ] },
  { id: "e2", name: "Internet", createdAt: "2026-01-02T09:00:00Z", paidByUserId: "sam", shares: [
    { id: "s4", userId: "sam", amountMinor: 1200, settledMinor: 1200 },
    { id: "s5", userId: "me", amountMinor: 1200, settledMinor: 0 },
  ] },
  { id: "e3", name: "Takeaway", createdAt: "2026-01-02T12:00:00Z", paidByUserId: "me", voidedAt: "2026-01-06T09:00:00Z", voidReason: "Entered twice", shares: [
    { id: "s6", userId: "sam", amountMinor: 900, settledMinor: 0 },
  ] },
  // Between two other people: not on this statement.
  { id: "e4", name: "Cinema", createdAt: "2026-01-02T12:00:00Z", paidByUserId: "ana", shares: [{ id: "s7", userId: "sam", amountMinor: 800, settledMinor: 0 }] },
];

describe("statement between two members", () => {
  it("lists shares, repayments, reversals and voids in order, and closes at the open balance", () => {
    const statement = buildStatement(expenses, "me", "sam", "Sam");
    expect(statement.entries.map((entry) => [entry.on, entry.kind, entry.amountMinor, entry.balanceMinor])).toEqual([
      ["2026-01-01", "share", 3000, 3000],
      ["2026-01-02", "share", -1200, 1800],
      ["2026-01-03", "repayment", -1000, 800],
      ["2026-01-04", "repayment", -500, 300],
      ["2026-01-05", "reversal", 500, 800],
      ["2026-01-06", "voided", 0, 800],
    ]);
    // What Sam owes on Groceries (2000) less what I owe Sam on Internet (1200).
    expect(statement.netMinor).toBe(800);
    expect(statement.entries[0].description).toBe("Sam’s share of Groceries");
    expect(statement.entries[1].description).toBe("Your share of Internet");
    expect(statement.entries[4].description).toBe("Repayment reversed · Groceries: Bounced");
  });

  it("reads the same from the other side, with the sign flipped", () => {
    expect(buildStatement(expenses, "sam", "me", "Me").netMinor).toBe(-800);
  });

  it("exports a CSV that quotes text and neutralises spreadsheet formulas but keeps negative amounts", () => {
    const csv = statementCsv(buildStatement([{ ...expenses[1], name: "=HYPERLINK(\"x\")" }], "me", "sam", "Sam"), "GBP");
    const lines = csv.trim().split("\r\n");
    expect(lines[0]).toBe('"Date","Entry","Amount (GBP)","Balance (GBP)"');
    expect(lines[1]).toBe('"2026-01-02","Your share of =HYPERLINK(""x"")","-12.00","-12.00"');
    const formula = statementCsv({ entries: [{ key: "k", expenseId: "e", on: "2026-01-01", kind: "share", description: "=1+1", amountMinor: 100, balanceMinor: 100 }], netMinor: 100 }, "GBP");
    expect(formula.split("\r\n")[1]).toBe('"2026-01-01","\'=1+1","1.00","1.00"');
  });
});
