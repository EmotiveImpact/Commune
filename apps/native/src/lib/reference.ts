/**
 * How a payment was made travels in its reference, which the database keeps
 * to 80 characters: "Bank transfer · Rent Oct", "Cash", or just what was typed.
 */
export type How = "bank" | "cash" | "other";
export const HOW_LABEL: Record<How, string> = { bank: "Bank transfer", cash: "Cash", other: "Other" };
const LIMIT = 80;
const SEP = " · ";

/** "Other" adds nothing in front: the typed reference itself says how. */
export function prefixOf(how: How): string {
  return how === "other" ? "" : HOW_LABEL[how];
}

/** Room left for the typed part once the prefix is in front. */
export function roomFor(how: How): number {
  const prefix = prefixOf(how);
  return LIMIT - (prefix ? prefix.length + SEP.length : 0);
}

export function joinReference(how: How, typed: string): string | null {
  const text = typed.trim().slice(0, roomFor(how)).trim();
  return [prefixOf(how), text].filter(Boolean).join(SEP) || null;
}

export function splitReference(reference: string | null): { how: string | null; note: string | null } {
  const text = reference?.trim() ?? "";
  const how = [HOW_LABEL.bank, HOW_LABEL.cash].find((item) => text === item || text.startsWith(item + SEP)) ?? null;
  const note = how ? text.slice(how.length + SEP.length).trim() : text;
  return { how, note: note || null };
}
