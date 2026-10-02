import { addDays, dateFromIso, isoFromDate, todayIso } from "../data/operations";
import { cx } from "./cx";

const weekday = new Intl.DateTimeFormat("en-GB", { weekday: "short" });
const month = new Intl.DateTimeFormat("en-GB", { month: "short" });
const fullDate = new Intl.DateTimeFormat("en-GB", {
  weekday: "long", day: "numeric", month: "long", year: "numeric",
});

/** Operations' approved calendar, shared by dated product rows. Date-only input
 * stays in local calendar time; it must not shift a day through UTC parsing. */
export function CalendarDate({ date, today = todayIso(), showMonth = true, label, className }: {
  date: string; today?: string; showMonth?: boolean; label?: string; className?: string;
}) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const value = dateFromIso(date);
  if (!Number.isFinite(value.getTime()) || isoFromDate(value) !== date) return null;
  const relative = date === today ? "Today" : date === addDays(today, 1) ? "Tomorrow" : "";
  const description = `${label ? `${label}: ` : ""}${fullDate.format(value)}${relative ? ` (${relative})` : ""}`;
  return <time className={cx("c-calendar-date", date === today && "is-today", className)}
    dateTime={date} title={description} aria-label={description}>
    <small className="c-calendar-weekday" aria-hidden="true">{weekday.format(value)}</small>
    <strong className="c-calendar-number" aria-hidden="true">{value.getDate()}</strong>
    {(relative || showMonth) && <em className="c-calendar-caption" aria-hidden="true">{relative || month.format(value)}</em>}
  </time>;
}
