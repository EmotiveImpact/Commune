export type Key = "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "." | "0" | "del";
export const KEYS: Key[] = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "del"];

/** Pounds stop at six figures (£999,999.99), well past any shared bill. */
export const MAX_WHOLE_DIGITS = 6;

/**
 * The typed amount after one key, as v7's keypad does it: at most two
 * decimals, one point, no leading zeros, and a cap on the whole pounds.
 * A key that would break a rule leaves the amount as it was.
 */
export function pressKey(amount: string, key: Key): string {
  if (key === "del") return amount.slice(0, -1);
  if (key === ".") return amount.includes(".") ? amount : `${amount || "0"}.`;
  const [whole, pence] = amount.split(".");
  if (pence !== undefined) return pence.length >= 2 ? amount : amount + key;
  if (whole === "0") return key;
  return whole.length >= MAX_WHOLE_DIGITS ? amount : amount + key;
}
