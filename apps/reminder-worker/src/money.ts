/**
 * Amounts in reminder emails, written as the app writes them: "$32.10",
 * "£42.00", "€8.50". This is a copy of formatMoney in
 * packages/core/src/format.ts, because the worker runs from its own folder
 * and imports nothing from outside it; apps/web/tests/formatting.test.ts
 * checks that the two agree.
 */
const NARROW_SYMBOL = new Set(["GBP", "USD", "EUR"]);

const moneyFormats = new Map<string, Intl.NumberFormat>();

/** An amount in minor units (pence or cents) in its currency. */
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
