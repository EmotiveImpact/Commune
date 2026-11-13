// @vitest-environment node
import { describe, expect, it } from "vitest";
import { curve, debtWeb } from "../src/lib/debtWeb";
import { paidOutcome } from "../src/lib/derive";
import type { Snapshot } from "../src/lib/types";

const snap = (expenses: Snapshot["expenses"]): Snapshot => ({
  commune: { id: "c", name: "Home", currency: "GBP" } as Snapshot["commune"],
  members: [{ userId: "a", name: "Ana" }, { userId: "b", name: "Ben" }, { userId: "c", name: "Cat" }] as Snapshot["members"],
  expenses, funds: [], notifications: [], reminderTargets: [],
});
const bill = (id: string, payer: string, shares: Array<[string, number, number?]>) => ({
  id, title: id, amountMinor: 0, paidByUserId: payer, dueOn: null,
  shares: shares.map(([userId, amountMinor, settledMinor = 0]) => ({ id: `${id}-${userId}`, userId, amountMinor, settledMinor })),
});

describe("debtWeb", () => {
  it("draws one line per unpaid share with the viewer and folds them into one payment per person and direction", () => {
    const web = debtWeb(snap([
      bill("pizza", "a", [["a", 500], ["b", 500], ["c", 500]]),
      bill("petrol", "a", [["b", 300], ["c", 300, 300]]),
      bill("milk", "b", [["a", 120], ["c", 120]]),
    ]), "a")!;
    // Cat's share of the milk is between Cat and Ben, so it is left out.
    expect(web.debts).toHaveLength(4);
    expect(web.payments).toEqual([
      { from: "b", to: "a", amountMinor: 800 },
      { from: "c", to: "a", amountMinor: 500 },
      { from: "a", to: "b", amountMinor: 120 },
    ]);
    // The viewer sits on the left, with their own name; the others in a column.
    expect(web.nodes[0]).toMatchObject({ userId: "a", name: "Ana", y: 0.5 });
    expect(web.nodes.slice(1).map((node) => node.y)).toEqual([0.25, 0.75]);
  });
  it("is empty when nothing is owed, and skips voided bills", () => {
    expect(debtWeb(snap([bill("paid", "a", [["b", 100, 100]])]), "a")).toBeNull();
    expect(debtWeb(snap([{ ...bill("void", "a", [["b", 100]]), voidedAt: "2026-11-01" }]), "a")).toBeNull();
  });
  it("curves stop short of each face and report a sensible length", () => {
    const line = curve({ x: 0, y: 0.5 }, { x: 1, y: 0.5 }, 300, 200, 30);
    expect(line.length).toBeGreaterThan(230);
    expect(line.length).toBeLessThan(260);
  });
});

describe("paidOutcome", () => {
  const s = snap([
    bill("pizza", "b", [["a", 500], ["b", 500]]),
    bill("milk", "b", [["a", 120]]),
    bill("petrol", "c", [["a", 300]]),
  ]);
  it("says what is left with that person when they are still owed", () => {
    expect(paidOutcome(s, "a", "pizza-a", "b", "Ben", 500, 0)).toMatchObject({ title: "Recorded.", body: expect.stringContaining("You still owe Ben £1.20") });
  });
  it("is square with one person while others are still owed", () => {
    const one = snap([bill("pizza", "b", [["a", 500]]), bill("petrol", "c", [["a", 300]])]);
    expect(paidOutcome(one, "a", "pizza-a", "b", "Ben", 500, 0)).toMatchObject({ title: "All square with Ben.", body: expect.stringContaining("£3.00 to settle with others") });
  });
  it("is all square only when nothing is left", () => {
    const one = snap([bill("pizza", "b", [["a", 500]])]);
    expect(paidOutcome(one, "a", "pizza-a", "b", "Ben", 500, 0).title).toBe("All square.");
    expect(paidOutcome(one, "a", "pizza-a", "b", "Ben", 300, 200).title).toBe("Recorded.");
  });
});
