import type { CurrencyCode } from "./types";

/** £16.00. Amounts stay in their own currency; they are never added across currencies. */
export function money(minor: number, currency: CurrencyCode): string {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(minor / 100);
}

/** £16.00 and €320.00, for totals kept per currency. */
export function moneyList(totals: Partial<Record<CurrencyCode, number>>): string {
  const parts = (Object.entries(totals) as Array<[CurrencyCode, number]>)
    .filter(([, minor]) => minor > 0)
    .map(([currency, minor]) => money(minor, currency));
  return joinAnd(parts);
}

export function joinAnd(parts: string[]): string {
  if (parts.length <= 1) return parts[0] ?? "";
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

const WORDS = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];
export function word(n: number): string {
  return WORDS[n] ?? String(n);
}
export function cap(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
export function plural(n: number, one: string, many: string): string {
  return `${word(n)} ${n === 1 ? one : many}`;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** The person's own calendar date, as the web app uses for due dates. */
export function isoFromDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
export function todayIso(now = new Date()): string {
  return isoFromDate(now);
}
export function dateFromIso(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d, 12);
}
export function addDays(iso: string, days: number): string {
  const date = dateFromIso(iso);
  date.setDate(date.getDate() + days);
  return isoFromDate(date);
}
export function daysBetween(from: string, to: string): number {
  return Math.round((dateFromIso(to).getTime() - dateFromIso(from).getTime()) / 86_400_000);
}

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAY_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MON_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** The three lines of the calendar tile: weekday, day, month (or "Today"). */
export function calParts(iso: string, today: string): { dow: string; day: string; mon: string; isToday: boolean } {
  const date = dateFromIso(iso);
  const isToday = iso.slice(0, 10) === today;
  return { dow: DOW[date.getDay()], day: String(date.getDate()), mon: isToday ? "Today" : MON[date.getMonth()], isToday };
}

/** Saturday 11 October */
export function longDate(iso: string): string {
  const date = dateFromIso(iso);
  return `${DAY_LONG[date.getDay()]} ${date.getDate()} ${MON_LONG[date.getMonth()]}`;
}
/** 11 Oct */
export function shortDate(iso: string): string {
  const date = dateFromIso(iso);
  return `${date.getDate()} ${MON[date.getMonth()]}`;
}
/** Mon 5 Oct */
export function dayDate(iso: string): string {
  const date = dateFromIso(iso);
  return `${DOW[date.getDay()]} ${date.getDate()} ${MON[date.getMonth()]}`;
}
/** "Mon" for this week, otherwise "5 Oct". For feeds. */
export function feedTime(isoDateTime: string, today: string): string {
  const day = isoDateTime.slice(0, 10);
  const ago = daysBetween(day, today);
  if (ago <= 0) return "Today";
  if (ago < 7) return DOW[dateFromIso(day).getDay()];
  return shortDate(day);
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?";
}
export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name;
}

/** A request id so a retried command cannot be recorded twice. */
export function requestId(): string {
  const native = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto?.randomUUID;
  if (native) return native.call((globalThis as { crypto: object }).crypto);
  const hex = "0123456789abcdef";
  let out = "";
  for (let i = 0; i < 36; i += 1) {
    if (i === 8 || i === 13 || i === 18 || i === 23) out += "-";
    else if (i === 14) out += "4";
    else if (i === 19) out += hex[(Math.random() * 4) | 8];
    else out += hex[(Math.random() * 16) | 0];
  }
  return out;
}

/** Splits an amount equally; the first people carry any spare penny. */
export function equalShares(amountMinor: number, userIds: string[]): Array<{ userId: string; amountMinor: number }> {
  if (new Set(userIds).size !== userIds.length) throw new Error("Each person may appear only once in a split.");
  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0 || !userIds.length || amountMinor < userIds.length) {
    throw new Error("The amount must have at least one penny for each person in the split.");
  }
  const base = Math.floor(amountMinor / userIds.length);
  const remainder = amountMinor % userIds.length;
  return userIds.map((userId, index) => ({ userId, amountMinor: base + (index < remainder ? 1 : 0) }));
}

/** "12.5" or "£12.50" to 1250 pence; null when it is not a usable amount. */
export function parseAmount(text: string): number | null {
  const cleaned = text.replace(/[£€$,\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const minor = Math.round(Number(cleaned) * 100);
  return minor > 0 && Number.isSafeInteger(minor) ? minor : null;
}
