// @vitest-environment node
import { describe, expect, it } from "vitest";
import { MAX_MONEY_MINOR, acceptsDecimalComma, moneyProblemMessage, plainAmount, readMoneyInput } from "@commune/core";

// Every money field (Add expense, corrections, funds, pledges, receipts,
// recurring bills and exact splits) reads amounts with readMoneyInput, so
// these are the amounts each of them accepts and refuses.
describe("reading an amount someone typed", () => {
  it("reads the same amounts in every currency", () => {
    for (const currency of ["GBP", "USD", "EUR", null, undefined]) {
      expect(readMoneyInput("12.5", currency)).toEqual({ minor: 1250, problem: null });
      expect(readMoneyInput("1,200", currency)).toEqual({ minor: 120000, problem: null });
      expect(readMoneyInput(" 12,345,678.90 ", currency)).toEqual({ minor: 1234567890, problem: null });
      expect(readMoneyInput("0.01", currency)).toEqual({ minor: 1, problem: null });
    }
  });

  it("says why an amount cannot be used", () => {
    expect(readMoneyInput("  ", "GBP").problem).toBe("empty");
    expect(readMoneyInput("0.00", "GBP").problem).toBe("zero");
    for (const value of ["-5", "12.", ".5", "12.345", "1,20,0", "1 200", "£12", "1e3", "0,500"]) {
      expect(readMoneyInput(value, "EUR").problem, value).toBe("format");
    }
    expect(readMoneyInput("12,50", "GBP").problem).toBe("decimal-comma");
    expect(readMoneyInput("12,50", "EUR")).toEqual({ minor: 1250, problem: null });
    expect(readMoneyInput("1.200,50", "EUR")).toEqual({ minor: 120050, problem: null });
    expect(acceptsDecimalComma("EUR")).toBe(true);
    expect(acceptsDecimalComma("USD")).toBe(false);
  });

  it("keeps to the database's limit, without losing precision near it", () => {
    expect(readMoneyInput("10,000,000,000.00", "GBP")).toEqual({ minor: MAX_MONEY_MINOR, problem: null });
    expect(readMoneyInput("10000000000.01", "GBP").problem).toBe("too-large");
    expect(readMoneyInput("99999999999999999999.99", "USD").problem).toBe("too-large");
    expect(moneyProblemMessage("too-large", "GBP")).toBe("Enter an amount no larger than 10,000,000,000.00.");
    expect(moneyProblemMessage("decimal-comma", "USD")).toBe("Use a full stop for cents, like 12.50.");
    expect(moneyProblemMessage("format", "GBP")).toBeNull();
  });

  it("writes an amount back the way exact split templates store it", () => {
    expect(plainAmount(120050)).toBe("1200.50");
    expect(plainAmount(7)).toBe("0.07");
    expect(readMoneyInput(plainAmount(MAX_MONEY_MINOR), "GBP").minor).toBe(MAX_MONEY_MINOR);
  });
});
