// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  canSkipNextPeriod,
  departureNotices,
  mergeRecurringEdits,
  nameList,
  recordedMessage,
  recurringActions,
  recurringChanges,
  recurringDepartures,
  recurringEditorFields,
  recurringSkipOpensOn,
  resumeBlockedNotice,
  sameRecurringFields,
  skippedMessage,
} from "../src/data/recurring";
import type { RecurringBill } from "../src/live/model";

const bill: RecurringBill = {
  id: "bill-1", title: "Broadband", amountMinor: 9000, paidByUserId: "blake", createdBy: "blake", version: 4, archivedAt: null,
  allocations: [{ userId: "blake", amountMinor: 3000 }, { userId: "sam", amountMinor: 3000 }, { userId: "casey", amountMinor: 3000 }],
  frequency: "monthly", nextDueOn: "2026-10-31", paused: true,
};
const names: Record<string, string> = { blake: "Blake Payer", sam: "Sam Lee", casey: "Casey Member", ali: "Ali Khan" };
const name = (userId: string) => names[userId] ?? "A former member";

describe("who may do what with a recurring bill", () => {
  it("matches the database commands", () => {
    // Added it and pays it: everything.
    expect(recurringActions(bill, "blake", false)).toEqual({ record: true, edit: true, pause: true, archive: true, restore: false });
    // Pays it but someone else added it: record, pause and archive, not edit.
    expect(recurringActions({ ...bill, createdBy: "casey" }, "blake", false))
      .toEqual({ record: true, edit: false, pause: true, archive: true, restore: false });
    // Added it but someone else pays it: pause and archive only.
    expect(recurringActions({ ...bill, paidByUserId: "casey" }, "blake", false))
      .toEqual({ record: false, edit: false, pause: true, archive: true, restore: false });
    // Only in the split: nothing.
    expect(recurringActions(bill, "casey", false)).toEqual({ record: false, edit: false, pause: false, archive: false, restore: false });
    // An admin: everything.
    expect(recurringActions(bill, "casey", true)).toEqual({ record: true, edit: true, pause: true, archive: true, restore: false });
  });

  it("only restores an archived bill", () => {
    const archived = { ...bill, archivedAt: "2026-10-09T10:00:00Z" };
    expect(recurringActions(archived, "blake", false)).toEqual({ record: false, edit: false, pause: false, archive: false, restore: true });
    expect(recurringActions(archived, "casey", true).restore).toBe(true);
    expect(recurringActions(archived, "casey", false).restore).toBe(false);
  });
});

describe("people who have left a recurring bill", () => {
  const active = new Set(["blake", "casey"]);

  it("are taken out of the split when the editor opens, with their amounts", () => {
    expect(recurringDepartures(bill, active)).toEqual({ payer: null, split: ["sam"] });
    const fields = recurringEditorFields(bill, active);
    expect(fields.included).toEqual(["blake", "casey"]);
    expect(fields.values).toEqual({ blake: "30.00", casey: "30.00" });
    expect([fields.payer, fields.amount, fields.method]).toEqual(["blake", "90.00", "Exact"]);
    expect(departureNotices(recurringDepartures(bill, active), name))
      .toEqual(["Sam Lee has left, so they were taken out of this split. Check the amounts before saving."]);
  });

  it("leave the payer empty until someone is chosen", () => {
    const left = { ...bill, paidByUserId: "sam" };
    expect(recurringEditorFields(left, active).payer).toBe("");
    expect(departureNotices(recurringDepartures(left, active), name)).toEqual([
      "Sam Lee has left, so they were taken out of this split. Check the amounts before saving.",
      "Sam Lee paid this bill and has left. Choose who pays it now.",
    ]);
  });

  it("are named together, once each", () => {
    const two = { ...bill, paidByUserId: "sam", allocations: [...bill.allocations, { userId: "ali", amountMinor: 1 }] };
    expect(departureNotices({ payer: null, split: ["sam", "ali"] }, name)[0])
      .toBe("Sam Lee and Ali Khan have left, so they were taken out of this split. Check the amounts before saving.");
    expect(resumeBlockedNotice(recurringDepartures(two, active), name))
      .toBe("Sam Lee and Ali Khan have left the commune, so an admin needs to update this bill before it can resume.");
    expect(nameList(["A", "B", "C"])).toBe("A, B and C");
    expect(nameList(["A"])).toBe("A");
  });
});

describe("skipping ahead", () => {
  it("opens one period before the due date, keeping month ends as the database does", () => {
    expect(recurringSkipOpensOn({ frequency: "monthly", nextDueOn: "2026-03-31" })).toBe("2026-02-28");
    expect(recurringSkipOpensOn({ frequency: "monthly", nextDueOn: "2028-03-31" })).toBe("2028-02-29");
    expect(recurringSkipOpensOn({ frequency: "monthly", nextDueOn: "2026-01-15" })).toBe("2025-12-15");
    expect(recurringSkipOpensOn({ frequency: "weekly", nextDueOn: "2026-10-12" })).toBe("2026-10-05");
  });

  it("allows the next period only, with a day's grace", () => {
    expect(canSkipNextPeriod({ frequency: "weekly", nextDueOn: "2026-10-16" }, "2026-10-09")).toBe(true);
    expect(canSkipNextPeriod({ frequency: "weekly", nextDueOn: "2026-10-17" }, "2026-10-09")).toBe(true);
    expect(canSkipNextPeriod({ frequency: "weekly", nextDueOn: "2026-10-18" }, "2026-10-09")).toBe(false);
    expect(canSkipNextPeriod({ frequency: "monthly", nextDueOn: "2026-11-09" }, "2026-10-09")).toBe(true);
    expect(canSkipNextPeriod({ frequency: "monthly", nextDueOn: "2026-12-09" }, "2026-10-09")).toBe(false);
    expect(canSkipNextPeriod({ frequency: "monthly", nextDueOn: "2026-01-31" }, "2026-10-09")).toBe(true);
  });
});

describe("a bill that changed while it was being edited", () => {
  const active = new Set(["blake", "sam", "casey"]);
  const base = recurringEditorFields(bill, active);

  it("keeps the person's own edits and takes everything else from the newer version", () => {
    // Someone recorded a period meanwhile: the due date moved on.
    const latest = recurringEditorFields({ ...bill, nextDueOn: "2026-11-30", version: 5 }, active);
    const merged = mergeRecurringEdits({ ...base, title: "Fibre" }, base, latest);
    expect([merged.title, merged.date, merged.amount]).toEqual(["Fibre", "2026-11-30", "90.00"]);
    // A split the person changed stays theirs as a whole.
    const mine = { ...base, included: ["blake", "casey"], values: { blake: "45.00", casey: "45.00" } };
    const newerSplit = recurringEditorFields({ ...bill, allocations: [{ userId: "blake", amountMinor: 9000 }] }, active);
    expect(mergeRecurringEdits(mine, base, newerSplit).included).toEqual(["blake", "casey"]);
    expect(mergeRecurringEdits(base, base, newerSplit).included).toEqual(["blake"]);
  });

  it("lists what changed in plain lines", () => {
    expect(recurringChanges(bill, { ...bill, amountMinor: 9600, nextDueOn: "2026-11-30", paused: false }, name, "GBP"))
      .toEqual(["Amount: £90.00 to £96.00", "Next due: 31 Oct 2026 to 30 Nov 2026", "Resumed"]);
    expect(recurringChanges(bill, { ...bill, paidByUserId: "casey", allocations: bill.allocations.slice(1) }, name, "GBP"))
      .toEqual(["Paid by: Blake Payer to Casey Member", "The split changed"]);
  });

  it("recognises the person's own save when its reply was lost", () => {
    expect(sameRecurringFields(bill, { ...bill, allocations: bill.allocations.map((share) => ({ ...share })) })).toBe(true);
    expect(sameRecurringFields(bill, { ...bill, title: "Fibre" })).toBe(false);
  });
});

describe("recording or skipping a period again", () => {
  it("says plainly that it was already done", () => {
    expect(recordedMessage(bill, 9000, { duplicate: true }, "GBP")).toBe("Broadband for 31 Oct was already recorded, so nothing new was added.");
    expect(recordedMessage(bill, 9000, { duplicate: false }, "GBP")).toBe("Bill recorded and next occurrence scheduled.");
    expect(recordedMessage(bill, 9500, { duplicate: false }, "GBP")).toBe("Bill recorded at £95.00 and next occurrence scheduled.");
    expect(skippedMessage(bill, { duplicate: true })).toBe("Broadband for 31 Oct was already skipped, so nothing changed.");
    expect(skippedMessage(bill, { duplicate: false })).toBe("Broadband skipped for 31 Oct. Nothing was charged.");
  });
});
