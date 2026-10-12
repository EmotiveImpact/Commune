/**
 * Reading amounts people type. Every money field, and every exact split
 * value, goes through readMoneyInput, so the same text means the same amount
 * on every screen and the limit is the one the database enforces.
 */

/** The largest amount the database accepts, in minor units: 10,000,000,000.00. */
export const MAX_MONEY_MINOR = 1_000_000_000_000;

export type MoneyInputProblem = "empty" | "format" | "zero" | "decimal-comma" | "too-large";
export type MoneyReading = { minor: number; problem: null } | { minor: null; problem: MoneyInputProblem };

/** Euro communes may write twelve euros fifty as "12,50". */
export function acceptsDecimalComma(currency?: string | null): boolean {
  return currency === "EUR";
}

// "1200", "1,200" or "12,345,678", with up to two decimals after a full stop.
// A first group of thousands never starts with 0, so "0,500" is refused
// rather than read as 500.
const FULL_STOP = /^(\d+|[1-9]\d{0,2}(?:,\d{3})+)(?:\.(\d{1,2}))?$/;
// "12,50", "1200,5" or "1.200,50": a decimal comma, with full stops between thousands.
const DECIMAL_COMMA = /^(\d+|[1-9]\d{0,2}(?:\.\d{3})+),(\d{1,2})$/;

/**
 * The amount typed, in minor units, or the reason it cannot be used. A comma
 * followed by three digits always separates thousands. A comma followed by
 * one or two digits is a decimal comma, read only in a euro commune.
 */
export function readMoneyInput(value: string, currency?: string | null): MoneyReading {
  const clean = value.trim();
  if (!clean) return { minor: null, problem: "empty" };
  let whole: string;
  let fraction: string;
  const point = FULL_STOP.exec(clean);
  const comma = point ? null : DECIMAL_COMMA.exec(clean);
  if (point) {
    whole = point[1].replaceAll(",", "");
    fraction = point[2] ?? "";
  } else if (comma) {
    if (!acceptsDecimalComma(currency)) return { minor: null, problem: "decimal-comma" };
    whole = comma[1].replaceAll(".", "");
    fraction = comma[2];
  } else {
    return { minor: null, problem: "format" };
  }
  const minor = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
  if (minor === 0n) return { minor: null, problem: "zero" };
  if (minor > BigInt(MAX_MONEY_MINOR)) return { minor: null, problem: "too-large" };
  return { minor: Number(minor), problem: null };
}

/**
 * What to tell someone about an amount that cannot be used, when there is
 * something more useful to say than the field's own example. Null otherwise.
 */
export function moneyProblemMessage(problem: MoneyInputProblem | null, currency?: string | null): string | null {
  if (problem === "decimal-comma") return `Use a full stop for ${currency === "USD" ? "cents" : "pence"}, like 12.50.`;
  if (problem === "too-large") return "Enter an amount no larger than 10,000,000,000.00.";
  return null;
}

/** An amount written the way exact split templates are stored: "1200.50". */
export function plainAmount(minor: number): string {
  return `${Math.floor(minor / 100)}.${String(minor % 100).padStart(2, "0")}`;
}
