import { addDays, dateFromIso, isoFromDate } from "./format";

/** First day of the month an ISO date falls in, as an ISO date. */
export function monthStart(iso: string): string {
  return `${iso.slice(0, 7)}-01`;
}

/** The month before or after, as its first day. */
export function shiftMonth(firstOfMonth: string, by: number): string {
  const date = dateFromIso(firstOfMonth);
  return isoFromDate(new Date(date.getFullYear(), date.getMonth() + by, 1, 12));
}

/**
 * A month as weeks starting on Monday: each cell is an ISO date, or null for
 * the blanks before the 1st and after the last day.
 */
export function monthGrid(firstOfMonth: string): Array<Array<string | null>> {
  const first = dateFromIso(firstOfMonth);
  const lead = (first.getDay() + 6) % 7;
  const days = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const cells: Array<string | null> = Array.from({ length: lead }, () => null);
  for (let d = 0; d < days; d++) cells.push(addDays(firstOfMonth, d));
  while (cells.length % 7) cells.push(null);
  const weeks: Array<Array<string | null>> = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}
