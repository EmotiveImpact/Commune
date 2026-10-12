// @vitest-environment node
import { describe, expect, it } from "vitest";
import { netBalances, overallNet, type BalanceExpense } from "../../../packages/core/src/balances";
import { buildStatement } from "../src/data/statement";
import { hubFromSnapshot, type Commune, type Snapshot } from "../src/live/model";

const expenses: BalanceExpense[] = [
  // Jordan owes me 4217 of the villa deposit.
  { paidByUserId: "me", shares: [
    { userId: "me", amountMinor: 4217, settledMinor: 4217 },
    { userId: "jordan", amountMinor: 4217, settledMinor: 0 },
    { userId: "sam", amountMinor: 4216, settledMinor: 1000 },
  ] },
  // I owe Jordan 15000 for the flights, so overall I owe Jordan 10783.
  { paidByUserId: "jordan", shares: [
    { userId: "jordan", amountMinor: 15000, settledMinor: 15000 },
    { userId: "me", amountMinor: 15000, settledMinor: 0 },
  ] },
  // Voided: never counted.
  { paidByUserId: "jordan", voidedAt: "2026-10-01T09:00:00Z", shares: [{ userId: "me", amountMinor: 9999, settledMinor: 0 }] },
  // Between two other people: nothing to do with me.
  { paidByUserId: "sam", shares: [{ userId: "jordan", amountMinor: 800, settledMinor: 0 }] },
  // Fully repaid: nothing outstanding.
  { paidByUserId: "ana", shares: [{ userId: "me", amountMinor: 500, settledMinor: 500 }] },
];

describe("net balances between the viewer and each member", () => {
  it("offsets money owed both ways into one figure per person", () => {
    const nets = netBalances(expenses, "me");
    expect(nets.get("jordan")).toBe(-10783);
    expect(nets.get("sam")).toBe(3216);
    expect(nets.get("ana") ?? 0).toBe(0);
    expect(overallNet(nets)).toBe(-10783 + 3216);
  });

  it("reads the same from the other side, with the sign flipped", () => {
    expect(netBalances(expenses, "jordan").get("me")).toBe(10783);
  });

  it("matches the closing balance of the statement between the same two people", () => {
    // A share's settled amount is the sum of its receipts, so give the statement those receipts.
    const receipt = (id: string, amountMinor: number) => ({ id, amountMinor, receivedOn: "2026-10-08", reference: null, recordedBy: "me",
      recordedAt: "2026-10-08T10:00:00Z", origin: "recorded" as const, reversedAt: null, reversedBy: null, reversalReason: null });
    const rows = expenses.map((expense, index) => ({ ...expense, id: `e${index}`, name: `Expense ${index}`, createdAt: `2026-10-0${index + 1}T09:00:00Z`,
      shares: expense.shares.map((share, at) => ({ ...share, id: `e${index}-s${at}`,
        receipts: share.userId !== expense.paidByUserId && share.settledMinor ? [receipt(`e${index}-r${at}`, share.settledMinor)] : [] })) }));
    for (const other of ["jordan", "sam", "ana"]) {
      expect(buildStatement(rows, "me", other, other).netMinor).toBe(netBalances(expenses, "me").get(other) ?? 0);
    }
  });
});

describe("Members balances", () => {
  const commune: Commune = { id: "trip-1", name: "Lisbon long weekend", kind: "trip", currency: "EUR", role: "admin", address: "" };
  const viewer = { id: "me", name: "Maya Chen", email: "maya@example.com", emailVerified: true };
  const snapshot: Snapshot = {
    commune,
    members: [
      { userId: "me", name: "Maya Chen", role: "admin" },
      { userId: "jordan", name: "Jordan Reid", role: "member" },
      { userId: "sam", name: "Sam Lee", role: "member" },
      { userId: "ana", name: "Ana Silva", role: "member" },
    ],
    expenses: expenses.map((expense, index) => ({ id: `e${index}`, title: `Expense ${index}`, amountMinor: expense.shares.reduce((sum, share) => sum + share.amountMinor, 0),
      paidByUserId: expense.paidByUserId, dueOn: null, voidedAt: expense.voidedAt ?? null,
      shares: expense.shares.map((share, at) => ({ ...share, id: `e${index}-s${at}` })) })),
    funds: [], notifications: [], reminderTargets: [],
  };

  it("shows each person's net with its direction and your own net overall", () => {
    const balances = Object.fromEntries(hubFromSnapshot(snapshot, viewer).members.map((member) => [member.userId, member.bal]));
    expect(balances.jordan).toMatch(/^You owe €107\.83$/);
    expect(balances.sam).toMatch(/^Owes you €32\.16$/);
    expect(balances.ana).toBe("Even");
    expect(balances.me).toMatch(/^Owe €75\.67 overall$/);
  });
});
