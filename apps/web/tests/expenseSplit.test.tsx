import { describe, expect, it } from "vitest";
import { allocateExpense } from "../../../packages/core/src/expenseSplit";
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
});
