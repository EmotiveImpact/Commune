// @vitest-environment node
import { describe, expect, it } from "vitest";
import { joinReference, roomFor, splitReference } from "../src/lib/reference";
import { pressKey, type Key } from "../src/lib/keypad";

const type = (keys: string) => [...keys].reduce((amount, key) => pressKey(amount, (key === "<" ? "del" : key) as Key), "");

describe("keypad amounts", () => {
  it("keeps at most two decimals and one point", () => {
    expect(type("12.345")).toBe("12.34");
    expect(type("1..5")).toBe("1.5");
  });
  it("starts a bare point with a zero and drops leading zeros", () => {
    expect(type(".5")).toBe("0.5");
    expect(type("007")).toBe("7");
  });
  it("caps the whole pounds at six digits", () => {
    expect(type("12345678")).toBe("123456");
    expect(type("123456.78")).toBe("123456.78");
  });
  it("deletes the last character", () => {
    expect(type("12.5<<")).toBe("12");
    expect(type("<")).toBe("");
  });
});

describe("payment references", () => {
  it("puts how in front of anything typed", () => {
    expect(joinReference("bank", " Rent Oct ")).toBe("Bank transfer · Rent Oct");
    expect(joinReference("cash", "")).toBe("Cash");
    expect(joinReference("other", "Monzo pot")).toBe("Monzo pot");
    expect(joinReference("other", "  ")).toBeNull();
  });
  it("stays within the database's 80 characters", () => {
    expect(joinReference("bank", "x".repeat(100))!.length).toBe(80);
    expect(roomFor("other")).toBe(80);
  });
  it("reads how and the note back", () => {
    expect(splitReference("Bank transfer · Rent Oct")).toEqual({ how: "Bank transfer", note: "Rent Oct" });
    expect(splitReference("Cash")).toEqual({ how: "Cash", note: null });
    expect(splitReference("Cashback")).toEqual({ how: null, note: "Cashback" });
    expect(splitReference(null)).toEqual({ how: null, note: null });
  });
});
