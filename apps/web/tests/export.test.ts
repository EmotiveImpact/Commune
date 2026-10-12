// @vitest-environment node
import { describe, expect, it } from "vitest";
import { communeExportJson, expensesCsv } from "../src/data/export";
import type { Snapshot } from "../src/live/model";

const snapshot = {
  commune: { id: "c1", name: "Park Street", kind: "household", currency: "GBP", role: "member" },
  members: [{ userId: "a", name: "Avery", role: "admin" }, { userId: "b", name: "Blake", role: "member" }],
  expenses: [
    { id: "e2", title: "=SUM(A1)", category: "Bills", amountMinor: 3000, paidByUserId: "a", createdAt: "2026-02-01T09:00:00Z",
      shares: [{ id: "s3", userId: "a", amountMinor: 1500, settledMinor: 1500 }, { id: "s4", userId: "b", amountMinor: 1500, settledMinor: 500 }] },
    { id: "e1", title: "Groceries", category: "Food", amountMinor: 2000, paidByUserId: "a", createdAt: "2026-01-01T09:00:00Z", voidedAt: "2026-01-02T09:00:00Z",
      shares: [{ id: "s1", userId: "a", amountMinor: 1000, settledMinor: 1000 }, { id: "s2", userId: "c", amountMinor: 1000, settledMinor: 0 }] },
  ],
  funds: [], notifications: [], reminderTargets: [],
  notes: [{ id: "n1", title: "Wi-Fi", pill: "Wi-Fi", kicker: "", lede: "Password is hunter22", body: "Password is hunter22, router upstairs",
    facts: [["Network", "Home"], ["Password", "hunter22"]] as Array<[string, string]> }],
} as unknown as Snapshot;

describe("commune exports", () => {
  it("lists every share oldest first, marks voided bills and neutralises formulas", () => {
    const lines = expensesCsv(snapshot).trim().split("\r\n");
    expect(lines[0]).toBe('"Date","Expense","Category","Total (GBP)","Paid by","Member","Share (GBP)","Received (GBP)","Outstanding (GBP)","Status"');
    expect(lines.slice(1)).toEqual([
      '"2026-01-01","Groceries","Food","20.00","Avery","Avery","10.00","10.00","0.00","Voided"',
      '"2026-01-01","Groceries","Food","20.00","Avery","Former member","10.00","0.00","0.00","Voided"',
      '"2026-02-01","\'=SUM(A1)","Bills","30.00","Avery","Avery","15.00","15.00","0.00","Paid the bill"',
      '"2026-02-01","\'=SUM(A1)","Bills","30.00","Avery","Blake","15.00","5.00","10.00","Part paid"',
    ]);
  });

  it("exports everything but leaves note secrets out", () => {
    const json = communeExportJson(snapshot, new Date("2026-10-05T10:00:00Z"));
    expect(json).not.toContain("hunter22");
    const parsed = JSON.parse(json);
    expect(parsed).toMatchObject({ format: "commune-export", version: 1, exportedAt: "2026-10-05T10:00:00.000Z" });
    expect(parsed.notes[0].facts).toEqual([["Network", "Home"], ["Password", "(left out of exports)"]]);
    expect(parsed.notes[0].body).toBe("Password is (left out of exports), router upstairs");
    expect(parsed.expenses).toHaveLength(2);
  });
});
