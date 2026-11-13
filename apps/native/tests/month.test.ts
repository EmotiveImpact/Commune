// @vitest-environment node
import { describe, expect, it } from "vitest";
import { monthGrid, monthStart, shiftMonth } from "../src/lib/month";

describe("month calendar", () => {
  it("starts weeks on Monday", () => {
    const weeks = monthGrid("2026-11-01"); // a Sunday
    expect(weeks[0].slice(0, 6)).toEqual([null, null, null, null, null, null]);
    expect(weeks[0][6]).toBe("2026-11-01");
    expect(weeks.flat().filter(Boolean)).toHaveLength(30);
    expect(weeks.every((week) => week.length === 7)).toBe(true);
  });
  it("moves between months and years", () => {
    expect(shiftMonth("2026-12-01", 1)).toBe("2027-01-01");
    expect(shiftMonth("2026-01-01", -1)).toBe("2025-12-01");
    expect(monthStart("2026-11-17")).toBe("2026-11-01");
  });
});
