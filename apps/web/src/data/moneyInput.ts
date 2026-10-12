import { moneyProblemMessage, readMoneyInput } from "@commune/core";

/**
 * An amount typed in the commune's currency, in minor units, or null when it
 * cannot be used. Every money field reads amounts this way: thousands commas
 * ("1,200.50") everywhere, a decimal comma ("12,50") in a euro commune, and
 * the database's limit of 10,000,000,000.00.
 */
export function parseMoneyInput(value: string, currency?: string | null): number | null {
  return readMoneyInput(value, currency).minor;
}

/**
 * The message for an amount that cannot be used: a specific one for a decimal
 * comma outside a euro commune or an amount over the limit, otherwise the
 * field's own message.
 */
export function moneyInputError(value: string, currency: string | null | undefined, fallback: string): string {
  return moneyProblemMessage(readMoneyInput(value, currency).problem, currency) ?? fallback;
}
