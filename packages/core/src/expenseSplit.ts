export type SplitMethod = "Equal" | "Exact" | "Percentage" | "Shares";
export type ExpenseAllocation = { userId: string; amountMinor: number };
export function validateExpenseAllocation(total: number, shares: ExpenseAllocation[]): ExpenseAllocation[] {
  if (!Number.isSafeInteger(total) || total <= 0 || !shares.length) throw new Error("Enter a positive total and select at least one person.");
  if (new Set(shares.map(s => s.userId)).size !== shares.length) throw new Error("Each person can appear only once.");
  if (shares.some(s => !s.userId || !Number.isSafeInteger(s.amountMinor) || s.amountMinor <= 0)) throw new Error("Each included person needs at least one penny. Exclude anyone with no share.");
  if (shares.reduce((sum, s) => sum + BigInt(s.amountMinor), 0n) !== BigInt(total)) throw new Error("Shares must add up to the total.");
  return shares;
}
/** Stable largest-remainder allocation, using integer arithmetic throughout. */
export function allocateExpense(total: number, ids: string[], method: SplitMethod, values: Record<string, string> = {}): ExpenseAllocation[] {
  if (!Number.isSafeInteger(total) || total <= 0 || !ids.length) throw new Error("Enter a positive total and choose who is included.");
  const units = ids.map(id => {
    if (method === "Equal") return 1n;
    const raw = (values[id] ?? "").trim();
    if (!(method === "Shares" ? /^\d+$/ : /^\d+(?:\.\d{1,2})?$/).test(raw)) throw new Error(`Enter a valid ${method.toLowerCase()} value for everyone included.`);
    const [whole, fraction = ""] = raw.split(".");
    return method === "Shares" ? BigInt(whole) : BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
  });
  if (units.some(n => n <= 0n)) throw new Error("Each included person needs a positive share.");
  const sum = units.reduce((a, b) => a + b, 0n);
  if (method === "Percentage" && sum !== 10000n) throw new Error("Percentages must add up to 100%.");
  if (method === "Exact") return validateExpenseAllocation(total, ids.map((userId, i) => ({ userId, amountMinor: Number(units[i]) })));
  const raw = units.map(n => BigInt(total) * n);
  const allocated = raw.map(n => n / sum);
  const pennies = Number(BigInt(total) - allocated.reduce((a, b) => a + b, 0n));
  raw.map((n, i) => ({ i, remainder: n % sum })).sort((a, b) => a.remainder === b.remainder ? a.i - b.i : a.remainder > b.remainder ? -1 : 1).slice(0, pennies).forEach(({ i }) => allocated[i] += 1n);
  return validateExpenseAllocation(total, ids.map((userId, i) => ({ userId, amountMinor: Number(allocated[i]) })));
}
