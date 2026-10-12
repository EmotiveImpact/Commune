// @vitest-environment node
// What it costs to build a busy commune's views from its snapshot.
// Run with: cd apps/web && node node_modules/vitest/vitest.mjs bench --run --reporter=verbose tests/derive-snapshot.bench.ts
import { test } from "vitest";
import { expenseRows, hubFromSnapshot, readyPlace, type Expense, type Snapshot, type User } from "../src/live/model";
import { todayIso, type OperationItem } from "../src/data/operations";

// The same figures on every run.
function sequence(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
}
const DAY = 86_400_000;
const isoDay = (time: number) => new Date(time).toISOString().slice(0, 10);

/**
 * A busy household's year, as the open commune holds it once its earlier
 * months are loaded: four people, 800 expenses (the newest 40 still open),
 * a repayment on most shares, a correction on every twentieth expense,
 * 300 activity events, tasks, notes and pledges.
 */
function yearOfHousehold(): Snapshot {
  const random = sequence(2026);
  const now = Date.now();
  const members = ["Alex Morgan", "Sam Patel", "Jordan Lee", "Priya Shah"].map((name, index) => ({
    userId: `member-${index}`, name, role: index === 0 ? "admin" as const : "member" as const, active: true,
  }));
  const categories = ["Rent", "Bills", "Groceries", "Travel", "Other"];
  const expenses: Expense[] = Array.from({ length: 800 }, (_, index) => {
    const createdAt = new Date(now - Math.floor((index / 800) * 365 * DAY) - Math.floor(random() * DAY)).toISOString();
    const people = members.slice(0, 2 + Math.floor(random() * 3));
    const amountMinor = 500 + Math.floor(random() * 20_000);
    const payer = people[index % people.length].userId;
    const open = index < 40;
    const base = Math.floor(amountMinor / people.length);
    const shares = people.map((member, position) => {
      const shareMinor = base + (position < amountMinor % people.length ? 1 : 0);
      const settledMinor = member.userId === payer || !open ? shareMinor : 0;
      return {
        id: `share-${index}-${position}`, userId: member.userId, amountMinor: shareMinor, settledMinor,
        receipts: member.userId !== payer && settledMinor ? [{
          id: `receipt-${index}-${position}`, amountMinor: shareMinor, receivedOn: isoDay(Date.parse(createdAt) + 3 * DAY),
          reference: null, recordedBy: payer, recordedAt: createdAt, reversedAt: null, reversedBy: null, reversalReason: null,
        }] : [],
        paymentReports: [],
      };
    });
    const state = { title: `Shared ${categories[index % 5].toLowerCase()} ${index}`, amountMinor, paidByUserId: payer,
      category: categories[index % 5], dueOn: index % 3 ? null : isoDay(Date.parse(createdAt) + 14 * DAY),
      shares: shares.map(({ userId, amountMinor: minor }) => ({ userId, amountMinor: minor })) };
    return {
      id: `expense-${index}`, ...state, recordedBy: payer, createdAt, version: index % 20 ? 1 : 2,
      voidedAt: null, voidedBy: null, voidReason: null, updatedAt: null, shares,
      revisions: index % 20 ? [] : [{ id: `revision-${index}`, version: 2, action: "corrected", actorId: payer,
        reason: "Receipt total was different", before: { ...state, amountMinor: amountMinor + 100 }, after: state, createdAt }],
    };
  });
  const kinds = ["expenses", "funds", "notes", "operations", "recurring", "members"] as const;
  const activityEvents = Array.from({ length: 300 }, (_, index) => ({
    id: `event-${index}`, actorId: members[index % 4].userId, kind: kinds[index % kinds.length], entityId: `entity-${index}`,
    title: `Record ${index}`, description: index % 2 ? "Updated" : "Created",
    createdAt: new Date(now - Math.floor((index / 300) * 365 * DAY)).toISOString(),
  }));
  const operations: OperationItem[] = Array.from({ length: 30 }, (_, index) => ({
    id: `task-${index}`, hubId: "home", kind: "task", category: "chore", title: `Task ${index}`, date: isoDay(now + (index - 10) * DAY),
    allDay: true, assigneeId: members[index % 4].userId, assignee: members[index % 4].name, repeat: "weekly", status: "open", notes: "",
  }));
  return {
    commune: { id: "home", name: "Park Street", kind: "household", currency: "GBP", role: "admin" },
    members, expenses,
    funds: Array.from({ length: 4 }, (_, fund) => ({
      id: `fund-${fund}`, name: `Fund ${fund}`, targetMinor: 50_000, createdBy: members[0].userId, archivedAt: null,
      commitments: members.map((member, index) => ({
        id: `pledge-${fund}-${index}`, userId: member.userId, amountMinor: 5_000, dueOn: isoDay(now + index * 7 * DAY),
        contributedMinor: 2_500, cancelledAt: null,
        contributions: [{ id: `contribution-${fund}-${index}`, amountMinor: 2_500, contributedAt: new Date(now - 20 * DAY).toISOString(), voidedAt: null, voidReason: null }],
      })),
    })),
    notifications: [], reminderTargets: [], sentReminders: [], operations, recurringBills: [], splitTemplates: [], announcements: [],
    notes: Array.from({ length: 15 }, (_, index) => ({ id: `note-${index}`, title: `Note ${index}`, pill: "Other", kicker: "Everyone",
      lede: "", body: `Shared detail ${index}`, facts: [], version: 1 })),
    activityEvents,
  };
}

const year = yearOfHousehold();
const viewer: User = { id: "member-0", name: "Alex Morgan", email: "alex@example.test" };

const figures = (latency: { mean: number; p50?: number; samplesCount: number }) =>
  `mean ${latency.mean.toFixed(4)} ms, median ${(latency.p50 ?? latency.mean).toFixed(4)} ms, ${latency.samplesCount} samples`;

test("deriving a year's snapshot (800 expenses)", async ({ bench }) => {
  const result = await bench("the open commune's Hub and expense rows, from a snapshot not seen before", () => {
    // A new snapshot object each time, as a read brings.
    const snapshot = { ...year };
    hubFromSnapshot(snapshot, viewer);
    expenseRows(snapshot, viewer.id);
  }).run({ time: 3000 });
  console.info(`[benchmark] a new snapshot: ${figures(result.latency)}`);
});

test("a render that does not change the snapshot", async ({ bench }) => {
  // A render for anything but a new read of this commune (a notice count
  // elsewhere, a window opening): its views are the ones already built.
  const today = todayIso();
  readyPlace(year, viewer, undefined, today);
  const result = await bench("the open commune's Hub, from the snapshot it was built from", () => {
    readyPlace(year, viewer, undefined, today);
  }).run({ time: 1000 });
  console.info(`[benchmark] the same snapshot: ${figures(result.latency)}`);
});
