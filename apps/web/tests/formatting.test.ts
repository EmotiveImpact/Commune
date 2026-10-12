// @vitest-environment node
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { formatDay, formatMoney } from "@commune/core";
import { formatMoney as emailMoney } from "../../reminder-worker/src/money";
import { dateLabel, money } from "../src/live/model";
import { formatReminderDay } from "../src/data/reminders";

const source = fileURLToPath(new URL("../src", import.meta.url));
function files(folder: string): string[] {
  return readdirSync(folder).flatMap((name) => {
    const path = join(folder, name);
    return statSync(path).isDirectory() ? files(path) : /\.tsx?$/.test(name) ? [path] : [];
  });
}

describe("one way of writing money", () => {
  const amounts = [0, 1, 99, 3210, 4200, 123456, 99_999_999, 1_000_000_000_000, -500];

  it("is the same in reminder emails as on screen", () => {
    for (const currency of ["GBP", "USD", "EUR"]) {
      for (const minor of amounts) {
        expect(emailMoney(minor, currency)).toBe(formatMoney(minor, currency));
        expect(money(minor, currency as "GBP")).toBe(formatMoney(minor, currency));
      }
    }
    expect(money(3210, "USD")).toBe("$32.10");
  });

  it("is the only money and date formatting in the web app", () => {
    // Screens format through @commune/core (formatMoney and formatDay), so no
    // screen makes a formatter of its own or writes a date in another style.
    const offenders = files(source).flatMap((path) => {
      const text = readFileSync(path, "utf8");
      return [/Intl\.NumberFormat/, /toLocaleDateString/, /toLocaleString\(/]
        .filter((pattern) => pattern.test(text)).map((pattern) => `${relative(source, path)}: ${pattern}`);
    });
    expect(offenders).toEqual([]);
  });
});

describe("one way of writing a date", () => {
  it("writes due, received and recorded dates alike", () => {
    const today = "2026-10-09";
    expect(dateLabel("2026-10-06", today)).toBe("6 Oct");
    expect(dateLabel("2025-10-06", today)).toBe("6 Oct 2025");
    expect(dateLabel(null)).toBe("No due date");
    expect(formatReminderDay("2026-11-04")).toBe(formatDay("2026-11-04"));
    expect(formatReminderDay("")).toBe("");
  });
});
