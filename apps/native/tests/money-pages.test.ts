// @vitest-environment node
import { describe, expect, it } from "vitest";
import { isEven, rescale } from "../src/lib/recurringSplit";
import { demoBackend } from "../src/lib/demo";

const sum = (items: Array<{ amountMinor: number }>) => items.reduce((total, item) => total + item.amountMinor, 0);

describe("rescaling a repeating bill's split", () => {
  it("keeps an even split even, spare pence first", () => {
    const before = [{ userId: "a", amountMinor: 450 }, { userId: "b", amountMinor: 450 }, { userId: "c", amountMinor: 450 }, { userId: "d", amountMinor: 449 }];
    const after = rescale(before, 1801);
    expect(after.map((item) => item.amountMinor)).toEqual([451, 450, 450, 450]);
    expect(isEven(after)).toBe(true);
  });

  it("keeps set shares in proportion and adds up exactly", () => {
    const before = [{ userId: "a", amountMinor: 3000 }, { userId: "b", amountMinor: 1000 }];
    const after = rescale(before, 4999);
    expect(sum(after)).toBe(4999);
    expect(after[0].amountMinor).toBe(3749);
  });
});

describe("demo funds and recurring bills", () => {
  it("records a contribution and undoes it", async () => {
    const backend = demoBackend(() => "2026-11-07");
    const [park] = await backend.communes();
    const fund = (await backend.snapshot(park)).funds[0];
    const mine = fund.commitments.find((item) => item.userId === "demo-maya")!;
    const id = await backend.contribute(mine.id, 2000, "req-1");
    let after = (await backend.snapshot(park)).funds[0].commitments.find((item) => item.id === mine.id)!;
    expect(after.contributedMinor).toBe(mine.contributedMinor + 2000);
    await backend.voidContribution(id, "Undone");
    after = (await backend.snapshot(park)).funds[0].commitments.find((item) => item.id === mine.id)!;
    expect(after.contributedMinor).toBe(mine.contributedMinor);
  });

  it("pauses a bill and refuses an edit from a stale version", async () => {
    const backend = demoBackend(() => "2026-11-07");
    const [park] = await backend.communes();
    const bill = (await backend.snapshot(park)).recurringBills![0];
    await backend.setRecurringPaused(bill.id, true);
    const paused = (await backend.snapshot(park)).recurringBills![0];
    expect(paused.paused).toBe(true);
    await expect(backend.saveRecurring(park.id, { ...bill, expectedVersion: bill.version!, allocations: bill.allocations })).rejects.toThrow(/changed/);
    await backend.saveRecurring(park.id, { ...paused, expectedVersion: paused.version!, amountMinor: 1999, allocations: rescale(paused.allocations, 1999) });
    expect((await backend.snapshot(park)).recurringBills![0].amountMinor).toBe(1999);
  });
});
