// @vitest-environment node
import { describe, expect, it } from "vitest";
import { allocateExpense, validateExpenseAllocation } from "@commune/core";

// The same figures on every run.
function sequence(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
}
describe("expense allocation in integer minor units", () => {
  it("keeps every penny in equal splits", () => expect(allocateExpense(10001, ["a", "b", "c", "d"], "Equal").map(s => s.amountMinor)).toEqual([2501,2500,2500,2500]));
  it("accepts exact shares and rejects a mismatched total", () => {
    expect(allocateExpense(1000,["a","b"],"Exact",{a:"4.25",b:"5.75"}).map(s=>s.amountMinor)).toEqual([425,575]);
    expect(()=>allocateExpense(1000,["a","b"],"Exact",{a:"4",b:"5"})).toThrow("add up");
  });
  it("allocates fractional percentages without float loss",()=>expect(allocateExpense(10000,["a","b","c"],"Percentage",{a:"33.33",b:"33.33",c:"33.34"}).map(s=>s.amountMinor)).toEqual([3333,3333,3334]));
  it("supports weighted shares",()=>expect(allocateExpense(1000,["a","b"],"Shares",{a:"1",b:"3"}).map(s=>s.amountMinor)).toEqual([250,750]));
  it("gives spare pennies to the same people whatever order they are listed in", () => {
    const split = (total: number, ids: string[], method: "Equal" | "Shares", values: Record<string, string> = {}) =>
      Object.fromEntries(allocateExpense(total, ids, method, values).map(share => [share.userId, share.amountMinor]));
    for (const ids of [["a", "b", "c"], ["c", "a", "b"], ["b", "c", "a"]]) {
      expect(split(1000, ids, "Equal")).toEqual({ a: 334, b: 333, c: 333 });
      // a and b tie for the spare penny.
      expect(split(1002, ids, "Shares", { a: "1", b: "1", c: "2" })).toEqual({ a: 251, b: 250, c: 501 });
    }
    // The result keeps the order the people were given in.
    expect(allocateExpense(1000, ["c", "a", "b"], "Equal").map(share => share.userId)).toEqual(["c", "a", "b"]);
  });
  it("rejects invalid percentages, duplicates, zero shares and negative input",()=>{
    expect(()=>allocateExpense(1000,["a","b"],"Percentage",{a:"40",b:"40"})).toThrow("100%");
    expect(()=>allocateExpense(1000,["a","a"],"Equal")).toThrow("only once");
    expect(()=>allocateExpense(1,["a","b"],"Equal")).toThrow("one penny");
    expect(()=>allocateExpense(1000,["a","b"],"Shares",{a:"-1",b:"2"})).toThrow();
  });
  it("always adds up to the total, and an equal split never differs by more than a penny", () => {
    const random = sequence(64);
    for (let run = 0; run < 500; run += 1) {
      const people = Array.from({ length: 1 + Math.floor(random() * 9) }, (_, index) => `person-${index}`);
      const total = people.length + Math.floor(random() * 10_000_000);
      const equal = allocateExpense(total, people, "Equal").map((share) => share.amountMinor);
      expect(equal.reduce((sum, amount) => sum + amount, 0)).toBe(total);
      expect(Math.max(...equal) - Math.min(...equal)).toBeLessThanOrEqual(1);
      const weights = Object.fromEntries(people.map((id) => [id, String(1 + Math.floor(random() * 5))]));
      const weighted = allocateExpense(total, people, "Shares", weights).map((share) => share.amountMinor);
      expect(weighted.reduce((sum, amount) => sum + amount, 0)).toBe(total);
    }
  });
  it("reads exact amounts as the money fields do", () => {
    expect(allocateExpense(150000, ["a", "b"], "Exact", { a: "1,200.00", b: "300" }, "GBP").map((share) => share.amountMinor)).toEqual([120000, 30000]);
    expect(allocateExpense(2500, ["a", "b"], "Exact", { a: "12,50", b: "12.50" }, "EUR").map((share) => share.amountMinor)).toEqual([1250, 1250]);
    expect(() => allocateExpense(2500, ["a", "b"], "Exact", { a: "12,50", b: "12.50" }, "GBP")).toThrow("Use a full stop for pence, like 12.50.");
  });
  it("checks a split before it is saved", () => {
    expect(validateExpenseAllocation(1000, [{ userId: "a", amountMinor: 400 }, { userId: "b", amountMinor: 600 }])).toHaveLength(2);
    expect(() => validateExpenseAllocation(1000, [{ userId: "a", amountMinor: 400 }, { userId: "b", amountMinor: 500 }])).toThrow("add up to the total");
    expect(() => validateExpenseAllocation(1000, [{ userId: "a", amountMinor: 1000 }, { userId: "b", amountMinor: 0 }])).toThrow("at least one penny");
    expect(() => validateExpenseAllocation(1000, [{ userId: "a", amountMinor: 500 }, { userId: "a", amountMinor: 500 }])).toThrow("only once");
  });
});
