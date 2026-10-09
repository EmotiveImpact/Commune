import type { CurrencyLock, Snapshot } from "../live/model";
import { nameList } from "./recurring";

const RECORD: Record<CurrencyLock, string> = {
  expenses: "an expense",
  funds: "a fund",
  recurringBills: "a recurring bill",
  exactSplitTemplates: "an exact split template",
};

/**
 * What keeps a commune's currency as it is: an expense, fund, recurring bill
 * or exact split template, voided or archived ones too, as they all keep
 * their amounts. The database enforces this rule and reports it with the
 * snapshot. A database from before 0035 does not report it, so the same rule
 * is then worked out from the records loaded.
 */
export function currencyLockedBy(snapshot: Snapshot | undefined): CurrencyLock[] {
  if (!snapshot) return [];
  if (snapshot.commune.currencyLockedBy) return snapshot.commune.currencyLockedBy;
  const present: Array<[CurrencyLock, boolean]> = [
    ["expenses", snapshot.expenses.length > 0],
    ["funds", snapshot.funds.length > 0],
    ["recurringBills", (snapshot.recurringBills ?? []).length > 0],
    ["exactSplitTemplates", (snapshot.splitTemplates ?? []).some((template) => template.method === "Exact")],
  ];
  return present.filter(([, found]) => found).map(([lock]) => lock);
}

/** Why the currency can no longer change, or what will fix it. */
export function currencyHint(lockedBy: CurrencyLock[]): string {
  return lockedBy.length
    ? `Locked because this commune already has ${nameList(lockedBy.map((lock) => RECORD[lock]))}, counting voided and archived ones. Changing it would relabel their amounts.`
    : "You can change this until the first expense, fund, recurring bill or exact split template is saved.";
}
