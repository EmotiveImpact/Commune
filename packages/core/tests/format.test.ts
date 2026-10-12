// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { formatDay, formatMoney } from "@commune/core";

describe("writing money", () => {
  it("uses each offered currency's own symbol", () => {
    expect(formatMoney(3210, "USD")).toBe("$32.10");
    expect(formatMoney(4200, "GBP")).toBe("£42.00");
    expect(formatMoney(850, "EUR")).toBe("€8.50");
    expect(formatMoney(123456789, "GBP")).toBe("£1,234,567.89");
    expect(formatMoney(1, "USD")).toBe("$0.01");
    expect(formatMoney(0, "EUR")).toBe("€0.00");
    expect(formatMoney(-500, "GBP")).toBe("-£5.00");
  });

  it("keeps the three offered currencies distinguishable", () => {
    const symbols = ["GBP", "USD", "EUR"].map((currency) => formatMoney(100, currency).replace(/[\d.,]/g, ""));
    expect(new Set(symbols).size).toBe(3);
  });

  it("writes a currency that shares a symbol with an offered one with its code", () => {
    // Canadian and Australian dollars are not offered; if they were, they would not read as US dollars.
    expect(formatMoney(3210, "CAD")).toBe("CA$32.10");
    expect(formatMoney(3210, "AUD")).toBe("A$32.10");
  });

  it("writes the largest amount the database accepts to the penny", () => {
    expect(formatMoney(1_000_000_000_000, "GBP")).toBe("£10,000,000,000.00");
    expect(formatMoney(999_999_999_999, "USD")).toBe("$9,999,999,999.99");
  });

  it("makes one formatter per currency and keeps it", () => {
    const made = vi.spyOn(Intl, "NumberFormat");
    // A currency not formatted before in this file, so the first call makes its formatter.
    for (let index = 0; index < 50; index += 1) formatMoney(index, "JPY");
    expect(made).toHaveBeenCalledTimes(1);
    made.mockRestore();
  });
});

describe("writing a date", () => {
  afterEach(() => vi.useRealTimers());

  it("writes the day and month, with the year when it is not this year", () => {
    expect(formatDay("2026-10-09", "2026-10-09")).toBe("9 Oct");
    expect(formatDay("2026-01-31", "2026-12-31")).toBe("31 Jan");
    expect(formatDay("2025-12-31", "2026-01-01")).toBe("31 Dec 2025");
    expect(formatDay("2027-03-01", "2026-10-09")).toBe("1 Mar 2027");
  });

  it("takes this year from the reader's own calendar", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2031, 4, 20, 12));
    expect(formatDay("2031-02-03")).toBe("3 Feb");
    expect(formatDay("2030-02-03")).toBe("3 Feb 2030");
  });

  it("never moves a date to another day, wherever the reader is", () => {
    const zone = process.env.TZ;
    try {
      for (const place of ["Pacific/Auckland", "America/Los_Angeles", "Europe/London"]) {
        process.env.TZ = place;
        // Days either side of the clocks changing, and the ends of the year.
        expect(["2026-03-29", "2026-10-25", "2026-12-31", "2026-01-01", "2024-02-29"].map((day) => formatDay(day, "2026-06-01")))
          .toEqual(["29 Mar", "25 Oct", "31 Dec", "1 Jan", "29 Feb 2024"]);
      }
    } finally {
      if (zone === undefined) delete process.env.TZ;
      else process.env.TZ = zone;
    }
  });

  it("uses the calendar day of a longer value as it is", () => {
    expect(formatDay("2026-10-06T00:00:00", "2026-10-09")).toBe("6 Oct");
  });

  it("returns anything that is not a calendar date unchanged", () => {
    for (const value of ["", "soon", "2026-02-30", "2026-13-01", "06/10/2026"]) {
      expect(formatDay(value, "2026-10-09")).toBe(value);
    }
  });
});
