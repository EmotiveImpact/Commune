// @vitest-environment node
import { describe, expect, it } from "vitest";
import { moneyInputError, parseMoneyInput } from "../src/data/moneyInput";
import { LIMITS } from "../src/data/limits";
import { allocateExpense } from "../../../packages/core/src/expenseSplit";

const fallback = "Enter the amount, for example 25.00.";

describe("one parser for every amount people type", () => {
  it("accepts thousands commas in groups of three, in every currency", () => {
    for (const currency of ["GBP", "USD", "EUR"] as const) {
      expect(parseMoneyInput("1,200", currency)).toBe(120000);
      expect(parseMoneyInput("1,200.50", currency)).toBe(120050);
      expect(parseMoneyInput(" 12,345,678.9 ", currency)).toBe(1234567890);
      expect(parseMoneyInput("1200", currency)).toBe(120000);
      expect(parseMoneyInput("0.01", currency)).toBe(1);
    }
  });

  it("reads a decimal comma in a euro commune, and explains the full stop elsewhere", () => {
    expect(parseMoneyInput("12,50", "EUR")).toBe(1250);
    expect(parseMoneyInput("12,5", "EUR")).toBe(1250);
    expect(parseMoneyInput("1.200,50", "EUR")).toBe(120050);
    expect(parseMoneyInput("12,50", "GBP")).toBeNull();
    expect(moneyInputError("12,50", "GBP", fallback)).toBe("Use a full stop for pence, like 12.50.");
    expect(parseMoneyInput("1.200,50", "USD")).toBeNull();
    expect(moneyInputError("1.200,50", "USD", fallback)).toBe("Use a full stop for cents, like 12.50.");
  });

  it("refuses anything else with the field's own example", () => {
    for (const value of ["", " ", "0", "0.00", "-5", "12.", ".5", "12.345", "1,20,0", "12,3456", "1 200", "£12", "1.200", "1e3"]) {
      expect(parseMoneyInput(value, "EUR")).toBeNull();
      expect(moneyInputError(value, "GBP", fallback)).toBe(fallback);
    }
    expect(moneyInputError("25.00", "GBP", fallback)).toBe(fallback);
  });

  it("never reads a first group of thousands that starts with 0", () => {
    // "0,500" might mean 0.50: refused rather than read as 500.
    for (const currency of ["GBP", "USD", "EUR"] as const) {
      for (const value of ["0,500", "0,050", "0,001", "01,500", "00,500.00", "0.500,00", "01.500,00"]) {
        expect(parseMoneyInput(value, currency)).toBeNull();
      }
    }
    expect(moneyInputError("0,500", "GBP", fallback)).toBe(fallback);
    expect(parseMoneyInput("0,50", "EUR")).toBe(50);
    expect(parseMoneyInput("0.50", "GBP")).toBe(50);
    expect(parseMoneyInput("1,500", "EUR")).toBe(150000);
  });

  it("keeps the database's limit in every field, and says what it is", () => {
    expect(parseMoneyInput("10,000,000,000.00", "GBP")).toBe(1_000_000_000_000);
    expect(parseMoneyInput("10000000000.01", "GBP")).toBeNull();
    expect(moneyInputError("10000000000.01", "GBP", fallback)).toBe("Enter an amount no larger than 10,000,000,000.00.");
    expect(moneyInputError("99999999999999999999", "EUR", fallback)).toBe("Enter an amount no larger than 10,000,000,000.00.");
    // Every money field is long enough for the largest amount it accepts.
    expect(LIMITS.money).toBeGreaterThanOrEqual("10,000,000,000.00".length);
  });

  it("reads exact split amounts the same way", () => {
    expect(allocateExpense(150000, ["a", "b"], "Exact", { a: "1,200.00", b: "300" }, "GBP").map((share) => share.amountMinor)).toEqual([120000, 30000]);
    expect(allocateExpense(2000, ["a", "b"], "Exact", { a: "12,50", b: "7,50" }, "EUR").map((share) => share.amountMinor)).toEqual([1250, 750]);
    expect(() => allocateExpense(2000, ["a", "b"], "Exact", { a: "12,50", b: "7.50" }, "GBP")).toThrow("Use a full stop for pence, like 12.50.");
    expect(() => allocateExpense(2000, ["a", "b"], "Exact", { a: "12.505", b: "7.50" }, "GBP")).toThrow("Enter a valid exact value for everyone included.");
  });
});
