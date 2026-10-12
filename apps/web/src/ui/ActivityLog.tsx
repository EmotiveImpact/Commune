import { useId } from "react";
import { formatDay } from "@commune/core";
import {
  ArrowRightLeft, CalendarDays, Clock3, FileText, Files, HandCoins, Handshake, Megaphone, ReceiptText, Repeat2,
  ShoppingBag, SquareCheck, UsersRound, type LucideIcon,
} from "lucide-react";
import type { ActivityType } from "../data/household";
import { addDays, dateFromIso, timestampDay, todayIso } from "../data/operations";
import type { LiveHub } from "../live/model";
import { Panel } from "./components";

type ActivityItem = LiveHub["activity"][number];

/**
 * Each kind of record: its word, the icon its own screen uses, and the chip
 * colour that sets money apart from plans and from what everyone shares.
 */
const TYPES: Record<ActivityType, { word: string; icon: LucideIcon; tone: "money" | "plan" | "shared" }> = {
  expense: { word: "Expense", icon: ReceiptText, tone: "money" },
  repayment: { word: "Repayment", icon: ArrowRightLeft, tone: "money" },
  fund: { word: "Fund", icon: ShoppingBag, tone: "money" },
  pledge: { word: "Pledge", icon: Handshake, tone: "money" },
  contribution: { word: "Contribution", icon: HandCoins, tone: "money" },
  recurring: { word: "Recurring bill", icon: Repeat2, tone: "money" },
  template: { word: "Saved split", icon: Files, tone: "money" },
  task: { word: "Task", icon: SquareCheck, tone: "plan" },
  event: { word: "Event", icon: CalendarDays, tone: "plan" },
  note: { word: "Note", icon: FileText, tone: "shared" },
  member: { word: "Member", icon: UsersRound, tone: "shared" },
  announcement: { word: "Announcement", icon: Megaphone, tone: "shared" },
};
// A kind this version of the app does not know yet still gets a calm row.
const UNKNOWN = { word: "", icon: Clock3, tone: "shared" as const };

/** The word for a kind of record, such as "Event". */
export function activityWord(type: ActivityType | undefined): string {
  return (type && TYPES[type]?.word) || UNKNOWN.word;
}

/** The kind of record as a coloured icon chip; the row names it in words. */
export function ActivityTypeChip({ type }: { type: ActivityType | undefined }) {
  const { icon: Glyph, tone } = (type && TYPES[type]) || UNKNOWN;
  return <span className={`c-type-chip is-${tone}`} aria-hidden="true"><Glyph size={18} strokeWidth={1.5} /></span>;
}

/** The time of day something was recorded, where the member is ("14:05"). */
export function activityClock(createdAt: string | undefined): string {
  const date = createdAt ? new Date(createdAt) : null;
  if (!date || Number.isNaN(date.getTime())) return "";
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function relativeDay(day: string, today: string): string {
  return day === today ? "Today" : day === addDays(today, -1) ? "Yesterday" : "";
}

// A calendar day (YYYY-MM-DD) in words, with the year only when it is not this one.
// The short form is the date every screen uses ("5 Oct").
function dayWords(day: string, today: string, style: "long" | "short"): string {
  if (style === "short") return formatDay(day, today);
  const options: Intl.DateTimeFormatOptions = { weekday: "long", day: "numeric", month: "long" };
  if (day.slice(0, 4) !== today.slice(0, 4)) options.year = "numeric";
  return new Intl.DateTimeFormat("en-GB", options).format(dateFromIso(day));
}

/** A day heading: Today, Yesterday, or the weekday and date. */
export function activityDayHeading(day: string, today = todayIso()): string {
  if (!day) return "Earlier";
  return relativeDay(day, today) || dayWords(day, today, "long");
}

/** When, in one short line for a row without a day heading: "Today, 14:05" or "5 Oct, 09:30". */
export function activityStamp(item: Pick<ActivityItem, "createdAt" | "time">, today = todayIso()): string {
  const day = timestampDay(item.createdAt);
  if (!day) return item.time;
  return `${relativeDay(day, today) || dayWords(day, today, "short")}, ${activityClock(item.createdAt)}`;
}

/** Rows already in order, grouped under the local day each was recorded on. */
export function groupByDay<T>(rows: T[], createdAt: (row: T) => string | undefined): Array<{ day: string; rows: T[] }> {
  const groups: Array<{ day: string; rows: T[] }> = [];
  for (const row of rows) {
    const day = timestampDay(createdAt(row));
    const last = groups[groups.length - 1];
    if (last && last.day === day) last.rows.push(row);
    else groups.push({ day, rows: [row] });
  }
  return groups;
}

export type ActivityLogRow = { key: string; item: ActivityItem; commune?: string; onOpen: () => void };

/**
 * The activity log: rows newest first under a heading for each day, each
 * naming the kind of record in an icon and a word, and the time it was recorded.
 */
export function ActivityLog({ rows }: { rows: ActivityLogRow[] }) {
  const headingId = useId();
  const today = todayIso();
  return (
    <div className="c-log">
      {groupByDay(rows, (row) => row.item.createdAt).map((group, index) => (
        <section className="c-log-day" aria-labelledby={`${headingId}-${index}`} key={`${group.day}-${index}`}>
          <h3 id={`${headingId}-${index}`}>{activityDayHeading(group.day, today)}</h3>
          <Panel>
            {group.rows.map(({ key, item, commune, onOpen }) => {
              const time = activityClock(item.createdAt);
              return (
                <button className="c-result-row" type="button" key={key} onClick={onOpen}>
                  <ActivityTypeChip type={item.type} />
                  <span>
                    <strong>{item.title}</strong>
                    <small>{[commune, activityWord(item.type), item.when].filter(Boolean).join(" · ")}</small>
                  </span>
                  {time ? <time dateTime={item.createdAt}>{time}</time> : null}
                </button>
              );
            })}
          </Panel>
        </section>
      ))}
    </div>
  );
}
