// @vitest-environment node
import { describe, expect, it } from "vitest";
import { clearFresh, isFresh, markFresh } from "../src/lib/fresh";

describe("fresh bill", () => {
  it("matches the bill just added, by commune, title and amount", () => {
    markFresh("c1", "Groceries", 4200);
    expect(isFresh("c1", "Groceries", 4200)).toBe(true);
    expect(isFresh("c1", "Groceries")).toBe(true);
    expect(isFresh("c2", "Groceries", 4200)).toBe(false);
    expect(isFresh("c1", "Groceries", 4300)).toBe(false);
    expect(isFresh("c1", "Rent", 4200)).toBe(false);
  });
  it("stops matching after a short while, or once cleared", () => {
    markFresh("c1", "Groceries", 4200);
    expect(isFresh("c1", "Groceries", 4200, Date.now() + 25_000)).toBe(false);
    clearFresh();
    expect(isFresh("c1", "Groceries", 4200)).toBe(false);
  });
});
