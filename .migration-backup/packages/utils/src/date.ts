/**
 * Today's date as a YYYY-MM-DD key in the user's local timezone. We use the
 * user's local calendar for "today" so that "overdue" and "upcoming" badges
 * match what the user sees on their own calendar, not UTC's.
 */
function getTodayKey(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Add `days` to a YYYY-MM-DD key without ever converting to a Date in a
 * non-UTC timezone (which would shift the calendar day in certain offsets).
 */
function addDaysToKey(key: string, days: number): string {
  const [year, month, day] = key.split('-').map(Number);
  const utc = new Date(Date.UTC(year!, (month ?? 1) - 1, (day ?? 1) + days));
  const y = utc.getUTCFullYear();
  const m = String(utc.getUTCMonth() + 1).padStart(2, '0');
  const d = String(utc.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getMonthKey(date: Date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function formatMonthKey(
  monthKey: string,
  locale: string = 'en-GB',
  options: Intl.DateTimeFormatOptions = { month: 'short' },
): string {
  const [year, month] = monthKey.split('-').map(Number);
  const date = new Date(Date.UTC(year!, (month ?? 1) - 1, 1));
  return date.toLocaleDateString(locale, options);
}

/**
 * Is `dueDate` (YYYY-MM-DD) strictly before today? Compares as calendar-day
 * strings to avoid the UTC-vs-local-midnight trap — `new Date('2026-04-20')`
 * is UTC midnight, which in PDT/PST is the previous calendar day, so the
 * old Date-object comparison would flag today's bills as overdue for US-West
 * users near midnight.
 */
export function isOverdue(dueDate: string): boolean {
  return dueDate < getTodayKey();
}

/**
 * Is `dueDate` within the next `days` days (inclusive of today)? Same
 * timezone-safety argument as `isOverdue`.
 */
export function isUpcoming(dueDate: string, days: number = 7): boolean {
  const todayKey = getTodayKey();
  const horizonKey = addDaysToKey(todayKey, days);
  return dueDate >= todayKey && dueDate <= horizonKey;
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Month bounds as `{ start: 'YYYY-MM-01', end: 'YYYY-MM-<last>' }`. Uses UTC
 * date construction so the `.toISOString()` boundary doesn't shift the day
 * in positive-offset timezones (NZ/AU/JP used to get
 * `{ start: '2026-03-31', ... }` back for April).
 */
export function getMonthRange(monthKey: string): { start: string; end: string } {
  const [year, month] = monthKey.split('-').map(Number);
  const start = new Date(Date.UTC(year!, month! - 1, 1));
  const end = new Date(Date.UTC(year!, month!, 0)); // day 0 of next month = last day of this month
  return {
    start: start.toISOString().split('T')[0]!,
    end: end.toISOString().split('T')[0]!,
  };
}
