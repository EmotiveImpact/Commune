/**
 * Changing a repeating bill's amount keeps the split it already had: an even
 * split stays even, and set shares keep their proportions. Shares are whole
 * pence and always add up to the new amount; spare pence go to the first
 * people, as an even split does everywhere else in Commune.
 */
export type Allocation = { userId: string; amountMinor: number };

export function isEven(allocations: Allocation[]): boolean {
  if (!allocations.length) return true;
  const amounts = allocations.map((item) => item.amountMinor);
  return Math.max(...amounts) - Math.min(...amounts) <= 1;
}

export function rescale(allocations: Allocation[], amountMinor: number): Allocation[] {
  if (!allocations.length) return [];
  const count = allocations.length;
  if (isEven(allocations)) {
    const each = Math.floor(amountMinor / count);
    return allocations.map((item, index) => ({ userId: item.userId, amountMinor: each + (index < amountMinor - each * count ? 1 : 0) }));
  }
  const total = allocations.reduce((sum, item) => sum + item.amountMinor, 0);
  const exact = allocations.map((item) => (total ? (item.amountMinor * amountMinor) / total : amountMinor / count));
  const floors = exact.map(Math.floor);
  let spare = amountMinor - floors.reduce((sum, value) => sum + value, 0);
  // Largest remainder first; ties go to the earlier person.
  const order = exact.map((value, index) => ({ index, rest: value - floors[index] })).sort((a, b) => b.rest - a.rest || a.index - b.index);
  for (const { index } of order) { if (spare <= 0) break; floors[index] += 1; spare -= 1; }
  return allocations.map((item, index) => ({ userId: item.userId, amountMinor: floors[index] }));
}
