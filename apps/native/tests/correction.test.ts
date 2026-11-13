// @vitest-environment node
import { describe, expect, it } from "vitest";
import { changed, correctedShares, wasEven } from "../src/lib/correction";
import type { Expense } from "../src/lib/types";

const bill: Expense = {
  id: "e1", title: "Council tax", category: "Bills", amountMinor: 1000, paidByUserId: "a", dueOn: "2026-11-16", version: 3,
  shares: [{ id: "s1", userId: "a", amountMinor: 700, settledMinor: 700 }, { id: "s2", userId: "b", amountMinor: 300, settledMinor: 0 }],
};

describe("correcting a bill", () => {
  it("keeps an uneven split while the amount and people are unchanged", () => {
    expect(correctedShares(bill, { amountMinor: 1000, included: ["b", "a"] })).toEqual({ kept: true, shares: [{ userId: "a", amountMinor: 700 }, { userId: "b", amountMinor: 300 }] });
  });
  it("splits equally once the amount changes", () => {
    const result = correctedShares(bill, { amountMinor: 1001, included: ["a", "b"] });
    expect(result?.kept).toBe(false);
    expect(result?.shares.reduce((sum, share) => sum + share.amountMinor, 0)).toBe(1001);
  });
  it("needs someone to share it", () => {
    expect(correctedShares(bill, { amountMinor: 1000, included: [] })).toBeNull();
  });
  it("notices what changed", () => {
    const draft = { title: "Council tax", amountMinor: 1000, category: "Bills", dueOn: "2026-11-16", paidByUserId: "a", included: ["a", "b"] };
    expect(changed(bill, draft)).toBe(false);
    expect(changed(bill, { ...draft, dueOn: null })).toBe(true);
    expect(changed(bill, { ...draft, title: " Council tax " })).toBe(false);
  });
  it("tells an even split from an uneven one", () => {
    expect(wasEven(bill)).toBe(false);
    expect(wasEven({ ...bill, shares: [{ ...bill.shares[0], amountMinor: 334 }, { ...bill.shares[1], amountMinor: 333 }] })).toBe(true);
  });
});
