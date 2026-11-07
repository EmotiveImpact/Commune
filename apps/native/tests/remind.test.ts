// @vitest-environment node
import { describe, expect, it } from "vitest";
import { reminderChoices } from "../src/lib/remindTimes";

describe("reminder times", () => {
  it("offers 7pm tonight and 8am tomorrow during the day", () => {
    const [tonight, morning] = reminderChoices(new Date(2026, 10, 7, 9, 15));
    expect(tonight.at).toEqual(new Date(2026, 10, 7, 19, 0));
    expect(tonight.words).toBe("tonight at 7pm");
    expect(morning.at).toEqual(new Date(2026, 10, 8, 8, 0));
  });

  it("offers an hour from now once 7pm is close or past", () => {
    const now = new Date(2026, 10, 7, 18, 45);
    const [soon] = reminderChoices(now);
    expect(soon.at).toEqual(new Date(2026, 10, 7, 19, 45));
    expect(soon.label).toBe("Remind me in an hour");
  });

  it("rolls tomorrow morning over the end of a month", () => {
    const [, morning] = reminderChoices(new Date(2026, 10, 30, 22, 0));
    expect(morning.at).toEqual(new Date(2026, 11, 1, 8, 0));
  });
});

import { parseRemindKey, remindHref, remindTarget } from "../src/lib/remindKey";
import type { Snapshot } from "../src/lib/types";

const house: Snapshot = {
  commune: { id: "c1", name: "14 Park Street", kind: "household", currency: "GBP", role: "member" },
  members: [{ userId: "me", name: "Maya Chen", role: "member" }, { userId: "sam", name: "Sam Okafor", role: "admin" }],
  expenses: [
    { id: "x1", title: "Printer ink", amountMinor: 3200, paidByUserId: "sam", dueOn: "2026-11-01", shares: [
      { id: "s1", userId: "me", amountMinor: 1600, settledMinor: 0 }, { id: "s2", userId: "sam", amountMinor: 1600, settledMinor: 1600 },
    ] },
    { id: "x2", title: "Broadband", amountMinor: 4800, paidByUserId: "me", dueOn: null, shares: [
      { id: "s3", userId: "me", amountMinor: 2400, settledMinor: 2400 }, { id: "s4", userId: "sam", amountMinor: 2400, settledMinor: 0 },
    ] },
  ],
  funds: [], notifications: [], reminderTargets: [],
  operations: [{ id: "o1", kind: "task", title: "Bins out", date: "2026-11-07", assigneeId: "me", repeat: "weekly", status: "open" },
    { id: "o2", kind: "task", title: "Gutters", date: "2026-11-12", assigneeId: null, repeat: "none", status: "open" }],
  recurringBills: [{ id: "r1", title: "Netflix", amountMinor: 1799, paidByUserId: "me", allocations: [], frequency: "monthly", nextDueOn: "2026-11-10", paused: false }],
} as Snapshot;

describe("remind keys", () => {
  it("reads every key the app uses", () => {
    expect(parseRemindKey("share:s1")).toEqual({ kind: "share", id: "s1" });
    expect(parseRemindKey("expense:x1")).toEqual({ kind: "expense", id: "x1" });
    expect(parseRemindKey("wait:x1")).toEqual({ kind: "expense", id: "x1" });
    expect(parseRemindKey("task:o1")).toEqual({ kind: "task", id: "o1" });
    expect(parseRemindKey("op:o1")).toEqual({ kind: "task", id: "o1" });
    expect(parseRemindKey("rb:r1")).toEqual({ kind: "recurring", id: "r1" });
    expect(parseRemindKey("recurring:r1")).toEqual({ kind: "recurring", id: "r1" });
  });

  it("refuses keys it does not know", () => {
    expect(parseRemindKey("")).toBeNull();
    expect(parseRemindKey("share:")).toBeNull();
    expect(parseRemindKey("note:n1")).toBeNull();
  });

  it("keeps ids with colons and encodes the route", () => {
    expect(parseRemindKey("task:a:b")).toEqual({ kind: "task", id: "a:b" });
    expect(remindHref("task:a b")).toBe("/remind/task%3Aa%20b");
  });

  it("finds your share of a bill, even without a need", () => {
    const share = remindTarget("share:s1", [], [house], "me")!;
    expect(share.body).toBe("Pay Sam Okafor £16.00 for Printer ink.");
    expect(share.open).toBe("/expense/x1");
    expect(remindTarget("expense:x1", [], [house], "me")!.what).toBe("Your share, £16.00 to Sam Okafor");
  });

  it("reminds the payer to check on a bill they are owed for", () => {
    expect(remindTarget("expense:x2", [], [house], "me")!.body).toBe("Check on Broadband in 14 Park Street.");
  });

  it("finds chores, whoever has them, and repeating bills", () => {
    expect(remindTarget("op:o1", [], [house], "me")!.what).toBe("Your turn · 14 Park Street");
    expect(remindTarget("task:o2", [], [house], "me")!.what).toBe("Nobody has it yet · 14 Park Street");
    expect(remindTarget("task:o2", [], [house], "me")!.open).toBe("/tasks?focus=o2");
    expect(remindTarget("rb:r1", [], [house], "me")!.what).toBe("£17.99 monthly · 14 Park Street");
  });

  it("returns nothing for something that has gone", () => {
    expect(remindTarget("expense:gone", [], [house], "me")).toBeNull();
    expect(remindTarget("task:gone", [], [house], "me")).toBeNull();
  });
});
