import { describe, expect, it } from "vitest";
import { scaleRecurringShares } from "../src/data/recurring";

describe("scaling a recurring split to a different amount", () => {
  it("matches the server: proportional, leftover pennies to the largest remainders", () => {
    // Same cases probed against commune_private.scale_recurring_shares.
    expect(scaleRecurringShares([{ userId: "a", amountMinor: 3334 }, { userId: "b", amountMinor: 3333 }, { userId: "c", amountMinor: 3333 }], 10001))
      .toEqual([{ userId: "a", amountMinor: 3335 }, { userId: "b", amountMinor: 3333 }, { userId: "c", amountMinor: 3333 }]);
    expect(scaleRecurringShares([{ userId: "a", amountMinor: 100 }, { userId: "b", amountMinor: 100 }, { userId: "c", amountMinor: 100 }], 2))
      .toEqual([{ userId: "a", amountMinor: 1 }, { userId: "b", amountMinor: 1 }]);
  });

  it("always adds up to the new amount", () => {
    const shares = [{ userId: "a", amountMinor: 1999 }, { userId: "b", amountMinor: 3001 }, { userId: "c", amountMinor: 7 }];
    for (const amount of [1, 99, 5007, 12345, 999999, 1_000_000_000_000]) {
      expect(scaleRecurringShares(shares, amount).reduce((sum, share) => sum + share.amountMinor, 0)).toBe(amount);
    }
  });
});
