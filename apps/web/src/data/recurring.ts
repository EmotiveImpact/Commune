import type { SplitMethod } from "../../../../packages/core/src/expenseSplit";
import { dateLabel, money, type CurrencyCode, type RecurringBill, type RecurringPeriodResult } from "../live/model";
import { addDays, todayIso } from "./operations";
import { formatReminderDay } from "./reminders";

type RecurringFields = Pick<RecurringBill, "title" | "amountMinor" | "paidByUserId" | "allocations" | "frequency" | "nextDueOn">;

/** The editor's form, with amounts as the text the person types. */
export type RecurringEditorFields = {
  title: string; amount: string; payer: string; frequency: RecurringBill["frequency"]; date: string;
  included: string[]; method: SplitMethod; values: Record<string, string>;
};

/**
 * A saved bill as the editor opens it. People who have left are taken out of
 * the split with their amounts, so the rest needs checking, and a payer who
 * has left leaves the payer empty until someone is chosen.
 */
export function recurringEditorFields(bill: RecurringBill, activeIds: ReadonlySet<string>): RecurringEditorFields {
  const shares = bill.allocations.filter((share) => activeIds.has(share.userId));
  return {
    title: bill.title,
    amount: (bill.amountMinor / 100).toFixed(2),
    payer: activeIds.has(bill.paidByUserId) ? bill.paidByUserId : "",
    frequency: bill.frequency,
    date: bill.nextDueOn,
    included: shares.map((share) => share.userId),
    method: "Exact",
    values: Object.fromEntries(shares.map((share) => [share.userId, (share.amountMinor / 100).toFixed(2)])),
  };
}

/**
 * Someone's edits carried onto a newer version: each field they changed
 * keeps their value and every other field takes the newer one, so a period
 * recorded meanwhile moves the due date on under them. The split (who is in
 * it, the method and the amounts) moves as one.
 */
export function mergeRecurringEdits(
  mine: RecurringEditorFields,
  base: RecurringEditorFields,
  latest: RecurringEditorFields,
): RecurringEditorFields {
  const split = (fields: RecurringEditorFields) => ({ included: fields.included, method: fields.method, values: fields.values });
  const splitChanged = JSON.stringify(split(mine)) !== JSON.stringify(split(base));
  return {
    title: mine.title === base.title ? latest.title : mine.title,
    amount: mine.amount === base.amount ? latest.amount : mine.amount,
    payer: mine.payer === base.payer ? latest.payer : mine.payer,
    frequency: mine.frequency === base.frequency ? latest.frequency : mine.frequency,
    date: mine.date === base.date ? latest.date : mine.date,
    ...(splitChanged ? split(mine) : split(latest)),
  };
}

/** What the screen says after recording a period, including a repeat. */
export function recordedMessage(
  bill: Pick<RecurringBill, "title" | "amountMinor" | "nextDueOn">,
  amountMinor: number,
  result: Pick<RecurringPeriodResult, "duplicate">,
  currency: CurrencyCode,
): string {
  if (result.duplicate) return `${bill.title} for ${dateLabel(bill.nextDueOn)} was already recorded, so nothing new was added.`;
  return amountMinor === bill.amountMinor
    ? "Bill recorded and next occurrence scheduled."
    : `Bill recorded at ${money(amountMinor, currency)} and next occurrence scheduled.`;
}

/** What the screen says after skipping a period, including a repeat. */
export function skippedMessage(bill: Pick<RecurringBill, "title" | "nextDueOn">, result: Pick<RecurringPeriodResult, "duplicate">): string {
  return result.duplicate
    ? `${bill.title} for ${dateLabel(bill.nextDueOn)} was already skipped, so nothing changed.`
    : `${bill.title} skipped for ${dateLabel(bill.nextDueOn)}. Nothing was charged.`;
}

/**
 * What the viewer may do with a bill, as the database commands decide it.
 * Record and skip: the payer or an admin. Pause, resume, archive and restore:
 * the person who added the bill, its payer or an admin. Edit: an admin, or
 * the member who both added the bill and pays it. An archived bill can only
 * be restored.
 */
export function recurringActions(
  bill: Pick<RecurringBill, "createdBy" | "paidByUserId" | "archivedAt">,
  viewerId: string | undefined,
  admin: boolean,
) {
  const archived = Boolean(bill.archivedAt);
  const added = !!viewerId && bill.createdBy === viewerId;
  const pays = !!viewerId && bill.paidByUserId === viewerId;
  const involved = admin || added || pays;
  return {
    record: !archived && (admin || pays),
    edit: !archived && (admin || (added && pays)),
    pause: !archived && involved,
    archive: !archived && involved,
    restore: archived && involved,
  };
}

/** The payer and the people in the split who are no longer members. */
export function recurringDepartures(
  bill: Pick<RecurringBill, "paidByUserId" | "allocations">,
  activeIds: ReadonlySet<string>,
): { payer: string | null; split: string[] } {
  return {
    payer: activeIds.has(bill.paidByUserId) ? null : bill.paidByUserId,
    split: bill.allocations.map((share) => share.userId).filter((userId) => !activeIds.has(userId)),
  };
}

/** "Sam", "Sam and Ali", "Sam, Ali and Jo". */
export function nameList(names: string[]): string {
  return names.length < 2 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/** What the editor says when it opens a bill that includes people who left. */
export function departureNotices(
  departures: { payer: string | null; split: string[] },
  name: (userId: string) => string,
): string[] {
  const notices: string[] = [];
  if (departures.split.length) {
    const names = departures.split.map(name);
    notices.push(`${nameList(names)} ${names.length === 1 ? "has" : "have"} left, so they were taken out of this split. Check the amounts before saving.`);
  }
  if (departures.payer) notices.push(`${name(departures.payer)} paid this bill and has left. Choose who pays it now.`);
  return notices;
}

/** Why a paused bill cannot resume yet, for someone who cannot edit it. */
export function resumeBlockedNotice(departures: { payer: string | null; split: string[] }, name: (userId: string) => string): string {
  const names = [...new Set([...(departures.payer ? [departures.payer] : []), ...departures.split])].map(name);
  return `${nameList(names)} ${names.length === 1 ? "has" : "have"} left the commune, so an admin needs to update this bill before it can resume.`;
}

/**
 * The first day the next period can be skipped: one period before it is due,
 * as skip_recurring_period allows. A month back keeps the day where it can
 * and otherwise takes the month's last day, as the database does.
 */
export function recurringSkipOpensOn(bill: Pick<RecurringBill, "frequency" | "nextDueOn">): string {
  if (bill.frequency === "weekly") return addDays(bill.nextDueOn, -7);
  const [year, month, day] = bill.nextDueOn.split("-").map(Number);
  const previousMonthDays = new Date(Date.UTC(year, month - 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month - 2, Math.min(day, previousMonthDays))).toISOString().slice(0, 10);
}

/** The server allows a day's grace for time zones, as it does for recording. */
export function canSkipNextPeriod(bill: Pick<RecurringBill, "frequency" | "nextDueOn">, today = todayIso()): boolean {
  return recurringSkipOpensOn(bill) <= addDays(today, 1);
}

function sameSplit(before: RecurringFields["allocations"], after: RecurringFields["allocations"]): boolean {
  return before.length === after.length &&
    before.every((share, index) => share.userId === after[index].userId && share.amountMinor === after[index].amountMinor);
}

/** Whether a saved bill already matches what an editor sent. */
export function sameRecurringFields(bill: RecurringFields, input: RecurringFields): boolean {
  return bill.title === input.title && bill.amountMinor === input.amountMinor && bill.paidByUserId === input.paidByUserId &&
    bill.frequency === input.frequency && bill.nextDueOn === input.nextDueOn && sameSplit(bill.allocations, input.allocations);
}

/** What someone else changed while an editor was open, in plain lines. */
export function recurringChanges(
  before: RecurringFields & Pick<RecurringBill, "paused">,
  after: RecurringFields & Pick<RecurringBill, "paused">,
  name: (userId: string) => string,
  currency: CurrencyCode,
): string[] {
  const lines: string[] = [];
  if (before.title !== after.title) lines.push(`Name: “${before.title}” to “${after.title}”`);
  if (before.amountMinor !== after.amountMinor) lines.push(`Amount: ${money(before.amountMinor, currency)} to ${money(after.amountMinor, currency)}`);
  if (before.paidByUserId !== after.paidByUserId) lines.push(`Paid by: ${name(before.paidByUserId)} to ${name(after.paidByUserId)}`);
  if (before.frequency !== after.frequency) lines.push(`Repeats: ${before.frequency} to ${after.frequency}`);
  if (before.nextDueOn !== after.nextDueOn) lines.push(`Next due: ${formatReminderDay(before.nextDueOn)} to ${formatReminderDay(after.nextDueOn)}`);
  if (!sameSplit(before.allocations, after.allocations)) lines.push("The split changed");
  if (before.paused !== after.paused) lines.push(after.paused ? "Paused" : "Resumed");
  return lines;
}

/**
 * The saved split scaled to a different total, exactly as the server does it
 * (commune_private.scale_recurring_shares): each share in proportion, rounded
 * down, then the leftover pennies to the largest remainders, ties in saved
 * order. Shares that round to nothing are left out. Preview only: the server
 * computes the split it records.
 */
export function scaleRecurringShares(
  shares: Array<{ userId: string; amountMinor: number }>,
  amountMinor: number,
): Array<{ userId: string; amountMinor: number }> {
  const total = shares.reduce((sum, share) => sum + BigInt(share.amountMinor), 0n);
  if (total <= 0n || amountMinor <= 0) return [];
  const target = BigInt(amountMinor);
  const parts = shares.map((share, order) => {
    const product = target * BigInt(share.amountMinor);
    return { userId: share.userId, order, base: product / total, rem: product % total };
  });
  let spare = target - parts.reduce((sum, part) => sum + part.base, 0n);
  const ranked = [...parts].sort((a, b) => (a.rem === b.rem ? a.order - b.order : a.rem > b.rem ? -1 : 1));
  const bonus = new Set<number>();
  for (const part of ranked) {
    if (spare <= 0n) break;
    bonus.add(part.order);
    spare -= 1n;
  }
  return parts
    .map((part) => ({ userId: part.userId, amountMinor: Number(part.base + (bonus.has(part.order) ? 1n : 0n)) }))
    .filter((share) => share.amountMinor > 0);
}
