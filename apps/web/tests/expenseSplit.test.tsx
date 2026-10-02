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
  it("rejects invalid percentages, duplicates, zero shares and negative input",()=>{
    expect(()=>allocateExpense(1000,["a","b"],"Percentage",{a:"40",b:"40"})).toThrow("100%");
    expect(()=>allocateExpense(1000,["a","a"],"Equal")).toThrow("only once");
    expect(()=>allocateExpense(1,["a","b"],"Equal")).toThrow("one penny");
    expect(()=>allocateExpense(1000,["a","b"],"Shares",{a:"-1",b:"2"})).toThrow();
  });
});
