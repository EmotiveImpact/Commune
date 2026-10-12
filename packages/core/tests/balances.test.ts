// @vitest-environment node
import { describe, expect, it } from "vitest";
import { netBalances, overallNet, type BalanceExpense } from "@commune/core";

// The same figures on every run.
function sequence(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

describe("balances between members", () => {
  const people = ["a", "b", "c", "d"];
  const random = sequence(7);
  const expenses: BalanceExpense[] = Array.from({ length: 200 }, (_, index) => {
    const payer = people[Math.floor(random() * people.length)];
    return {
      paidByUserId: payer,
      voidedAt: index % 17 === 0 ? "2026-10-01T09:00:00Z" : null,
      shares: people.map((userId) => {
        const amountMinor = 100 + Math.floor(random() * 5000);
        return { userId, amountMinor, settledMinor: userId === payer ? amountMinor : Math.floor(random() * 2) * amountMinor };
      }),
    };
  });

  it("reads the same between two people from either side", () => {
    for (const viewer of people) {
      const nets = netBalances(expenses, viewer);
      for (const other of people.filter((id) => id !== viewer)) {
        expect(nets.get(other) ?? 0).toBe(-(netBalances(expenses, other).get(viewer) ?? 0));
      }
    }
  });

  it("adds up to the viewer's overall position, and the positions add up to nothing", () => {
    let everyone = 0;
    for (const viewer of people) {
      const nets = netBalances(expenses, viewer);
      expect(overallNet(nets)).toBe([...nets.values()].reduce((sum, net) => sum + net, 0));
      everyone += overallNet(nets);
    }
    expect(everyone).toBe(0);
  });

  it("never counts a voided expense or a repaid share", () => {
    const voided: BalanceExpense = { paidByUserId: "a", voidedAt: "2026-10-01T09:00:00Z", shares: [{ userId: "b", amountMinor: 900, settledMinor: 0 }] };
    const repaid: BalanceExpense = { paidByUserId: "a", shares: [{ userId: "b", amountMinor: 900, settledMinor: 900 }] };
    expect(netBalances([voided, repaid], "a").get("b") ?? 0).toBe(0);
  });
});
