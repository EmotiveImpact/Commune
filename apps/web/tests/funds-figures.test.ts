// @vitest-environment node
import { describe, expect, it } from "vitest";
import { fundFigures } from "../src/data/funds";

const pledge = (amountMinor: number, contributedMinor: number, cancelledAt: string | null = null) =>
  ({ id: `${amountMinor}-${contributedMinor}`, userId: "u", dueOn: "2026-10-01", amountMinor, contributedMinor, cancelledAt });

describe("fund figures", () => {
  it("separates target, promised, received, still to come and not yet pledged", () => {
    // A cancelled pledge's recorded money still counts as received, but its promise does not.
    const figures = fundFigures({ targetMinor: 50000, contributedMinor: 18000,
      commitments: [pledge(20000, 15000), pledge(10000, 0), pledge(8000, 3000, "2026-09-01")] });
    expect(figures).toEqual({ promisedMinor: 30000, receivedMinor: 18000, stillToComeMinor: 15000, unpledgedMinor: 20000, toTargetMinor: 32000 });
  });

  it("never shows a negative gap when pledges or receipts pass the target", () => {
    const figures = fundFigures({ targetMinor: 10000, contributedMinor: 12000, commitments: [pledge(15000, 12000)] });
    expect([figures.unpledgedMinor, figures.toTargetMinor, figures.stillToComeMinor]).toEqual([0, 0, 3000]);
  });

  it("has no target gap without a target", () => {
    expect(fundFigures({ targetMinor: null, contributedMinor: 0, commitments: [] })).toMatchObject({ unpledgedMinor: null, toTargetMinor: null });
  });
});
