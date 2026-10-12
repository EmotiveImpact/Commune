/**
 * Money and dates the one way every screen writes them, and the reminder
 * worker's emails too (apps/reminder-worker/src/money.ts keeps a copy, checked
 * against this one by apps/web/tests/formatting.test.ts). Each formatter is
 * made once and kept: making one costs far more than using it.
 */

/**
 * The currencies Commune offers write their narrow symbol, since each one's is
 * its own: "£12.50", "$32.10", "€8.00". A currency added later that shares a
 * symbol with one of these (Canadian and Australian dollars also use "$")
 * keeps the code-prefixed form ("CA$32.10", "A$32.10") unless it is listed
 * here instead of the one it shares with, so two currencies never read alike.
 */
const NARROW_SYMBOL = new Set(["GBP", "USD", "EUR"]);

const moneyFormats = new Map<string, Intl.NumberFormat>();

/** An amount in minor units (pence or cents) in its currency: formatMoney(3210, "USD") is "$32.10". */
export function formatMoney(minor: number, currency: string): string {
  let format = moneyFormats.get(currency);
  if (!format) {
    format = new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency,
      currencyDisplay: NARROW_SYMBOL.has(currency) ? "narrowSymbol" : "symbol",
    });
    moneyFormats.set(currency, format);
  }
  return format.format(minor / 100);
}

const CALENDAR_DAY = /^(\d{4})-(\d{2})-(\d{2})/;
let thisYear: Intl.DateTimeFormat | undefined;
let otherYear: Intl.DateTimeFormat | undefined;

/** Today's calendar date where the reader is, as YYYY-MM-DD. */
function localToday(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

/**
 * A calendar date (YYYY-MM-DD) as "9 Oct", with the year when it is not this
 * year: "9 Oct 2025". The date is written as it is, never moved by a time zone,
 * so a timestamp should become the reader's own calendar day first (the web
 * app's timestampDay). Anything that is not a date comes back unchanged.
 * `today` is the reader's calendar date, for deciding whether to show the year.
 */
export function formatDay(iso: string, today: string = localToday()): string {
  const match = CALENDAR_DAY.exec(iso);
  if (!match) return iso;
  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return iso;
  const format = match[1] === today.slice(0, 4)
    ? thisYear ??= new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })
    : otherYear ??= new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  return format.format(date);
}
