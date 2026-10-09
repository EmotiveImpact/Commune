// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildStatement, type StatementExpense } from "../src/data/statement";
import { expensesCsv } from "../src/data/export";
import { dateLabel, hubFromSnapshot, type Snapshot } from "../src/live/model";

// Late in the evening in New York it is already the next day in UTC, and in
// a British summer just after midnight it is still the day before. Every
// date here is the member's own calendar day, never the UTC one.
const zone = process.env.TZ;
beforeEach(() => { process.env.TZ = "America/New_York"; });
afterEach(() => {
  vi.useRealTimers();
  if (zone === undefined) delete process.env.TZ;
  else process.env.TZ = zone;
});

const receipt = (id: string, amountMinor: number, receivedOn: string, recordedAt: string) => ({
  id, amountMinor, receivedOn, reference: null, recordedBy: "me", recordedAt,
  origin: "recorded" as const, reversedAt: null, reversedBy: null, reversalReason: null,
});

describe("statement dates", () => {
  it("dates a bill entered at 9pm on that evening, and lists its repayment after it", () => {
    // 9pm on 5 October in New York, repaid half an hour later.
    const expenses: StatementExpense[] = [{ id: "e1", name: "Takeaway", createdAt: "2026-10-06T01:00:00Z", paidByUserId: "me", shares: [
      { id: "s1", userId: "me", amountMinor: 2000, settledMinor: 2000 },
      { id: "s2", userId: "sam", amountMinor: 2000, settledMinor: 2000, receipts: [receipt("r1", 2000, "2026-10-05", "2026-10-06T01:30:00Z")] },
    ] }];
    const statement = buildStatement(expenses, "me", "sam", "Sam");
    expect(statement.entries.map((entry) => [entry.on, entry.kind, entry.balanceMinor])).toEqual([
      ["2026-10-05", "share", 2000],
      ["2026-10-05", "repayment", 0],
    ]);
  });

  it("never lists a repayment before the share it pays, even when the money came first", () => {
    // Sam paid on the 3rd; the bill was only entered on the 5th.
    const expenses: StatementExpense[] = [
      { id: "e1", name: "Concert tickets", createdAt: "2026-10-05T14:00:00Z", paidByUserId: "me", shares: [
        { id: "s1", userId: "me", amountMinor: 4000, settledMinor: 4000 },
        { id: "s2", userId: "sam", amountMinor: 4000, settledMinor: 4000, receipts: [
          { ...receipt("r1", 4000, "2026-10-03", "2026-10-05T14:05:00Z"), reversedAt: "2026-10-05T15:00:00Z", reversedBy: "me", reversalReason: "Wrong person" },
          receipt("r2", 4000, "2026-10-03", "2026-10-05T15:05:00Z"),
        ] },
      ] },
      { id: "e2", name: "Milk", createdAt: "2026-10-04T12:00:00Z", paidByUserId: "sam", shares: [
        { id: "s3", userId: "sam", amountMinor: 100, settledMinor: 100 },
        { id: "s4", userId: "me", amountMinor: 100, settledMinor: 0 },
      ] },
    ];
    const statement = buildStatement(expenses, "me", "sam", "Sam");
    expect(statement.entries.map((entry) => [entry.on, entry.kind, entry.amountMinor, entry.balanceMinor])).toEqual([
      ["2026-10-04", "share", -100, -100],
      ["2026-10-05", "share", 4000, 3900],
      // Still dated when the money arrived, but after the share it pays.
      ["2026-10-03", "repayment", -4000, -100],
      ["2026-10-05", "reversal", 4000, 3900],
      ["2026-10-03", "repayment", -4000, -100],
    ]);
    expect(statement.netMinor).toBe(-100);
  });

  it("dates a voided bill by the evening it was voided", () => {
    const statement = buildStatement([{ id: "e1", name: "Taxi", createdAt: "2026-10-01T12:00:00Z", paidByUserId: "me",
      voidedAt: "2026-10-07T02:00:00Z", voidReason: "Entered twice", shares: [{ id: "s1", userId: "sam", amountMinor: 900, settledMinor: 0 }] }],
    "me", "sam", "Sam");
    expect(statement.entries.map((entry) => [entry.on, entry.kind])).toEqual([["2026-10-06", "voided"]]);
  });
});

const snapshot = (expenses: Snapshot["expenses"], activityEvents: Snapshot["activityEvents"] = []): Snapshot => ({
  commune: { id: "c1", name: "Park Street", kind: "household", currency: "GBP", role: "admin" },
  members: [{ userId: "me", name: "Maya Chen", role: "admin" }, { userId: "sam", name: "Sam Lee", role: "member" }],
  expenses, funds: [], notifications: [], reminderTargets: [], activityEvents,
});
const expense = (id: string, title: string, amountMinor: number, createdAt: string): Snapshot["expenses"][number] => ({
  id, title, amountMinor, paidByUserId: "me", dueOn: null, createdAt, category: "Bills",
  shares: [{ id: `${id}-me`, userId: "me", amountMinor, settledMinor: amountMinor }],
});

describe("exports", () => {
  it("dates each expense by the day it was entered where the member is", () => {
    const lines = expensesCsv(snapshot([expense("e1", "Takeaway", 2000, "2026-10-06T01:00:00Z")])).trim().split("\r\n");
    expect(lines[1].startsWith('"2026-10-05","Takeaway"')).toBe(true);
  });

  it("dates an entry made just after midnight in a British summer on the new day", () => {
    process.env.TZ = "Europe/London";
    const lines = expensesCsv(snapshot([expense("e1", "Takeaway", 2000, "2026-07-01T23:30:00Z")])).trim().split("\r\n");
    expect(lines[1].startsWith('"2026-07-02","Takeaway"')).toBe(true);
  });
});

describe("activity and this month", () => {
  it("counts and labels entries by the member's own day", () => {
    // 11:30pm on 31 October in New York.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-01T03:30:00Z"));
    const hub = hubFromSnapshot(snapshot([
      // 10pm on 31 October: this month.
      expense("e1", "Halloween party", 5000, "2026-11-01T02:00:00Z"),
      // 10pm on 30 September: last month.
      expense("e2", "September rent", 90000, "2026-10-01T02:00:00Z"),
    ], [{ id: "a1", actorId: "sam", kind: "notes", entityId: "n1", title: "Bins", description: "Note added", createdAt: "2026-11-01T02:30:00Z" }]),
    { id: "me", name: "Maya Chen", email: "maya@example.test" });
    const thisMonth = hub.kpis.find((kpi) => kpi.kicker === "This month");
    expect(thisMonth?.num).toBe("£50.00");
    expect(thisMonth?.hint).toBe("1 expense logged");
    expect(Object.fromEntries(hub.activity.map((item) => [item.title, item.time]))).toEqual({
      "Halloween party": dateLabel("2026-10-31"),
      "September rent": dateLabel("2026-09-30"),
      Bins: dateLabel("2026-10-31"),
    });
  });
});
