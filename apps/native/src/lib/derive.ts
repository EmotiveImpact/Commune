import { addDays, calParts, cap, daysBetween, firstName, joinAnd, money } from "./format";
import { parsePayLinks, type PayLink } from "./payLinks";
import type { CurrencyCode, Expense, Operation, PaymentReport, Share, Snapshot } from "./types";

/**
 * Everything the phone screens show is worked out here from the same
 * snapshots the web app reads. Screens never do arithmetic of their own.
 * Amounts are always kept per currency.
 */

export type Tone = "late" | "attention" | "plain";
export type Band = "Overdue" | "Today" | "This week" | "Later" | "No due date";
export const BAND_ORDER: Band[] = ["Overdue", "Today", "This week", "Later", "No due date"];

type NeedBase = { key: string; communeId: string; title: string; dueOn: string | null; band: Band; status: { text: string; tone: Tone } };
export type ShareNeed = NeedBase & {
  kind: "share";
  expenseId: string;
  shareId: string;
  payerId: string;
  payerName: string;
  /** What is still to pay on this share. */
  amountMinor: number;
  totalMinor: number;
  currency: CurrencyCode;
  createdAt?: string;
};
export type TaskNeed = NeedBase & { kind: "task"; operationId: string; date: string };
export type Need = ShareNeed | TaskNeed;

export type Debtor = {
  userId: string;
  name: string;
  shareId: string;
  amountMinor: number;
  /** Their "I've sent it", waiting for you to confirm. */
  pending: PaymentReport | null;
  canNudge: boolean;
  nudgedToday: boolean;
};
export type Waiting = {
  key: string;
  communeId: string;
  expenseId: string;
  title: string;
  currency: CurrencyCode;
  dueOn: string | null;
  status: { text: string; tone: Tone };
  debtors: Debtor[];
};
/** A payment you reported that the bill payer has not confirmed yet. */
export type Recorded = {
  key: string; communeId: string; expenseId: string; title: string; payerName: string;
  amountMinor: number; currency: CurrencyCode; report: PaymentReport;
};

export function memberName(snapshot: Snapshot, userId: string, viewerId?: string): string {
  if (viewerId && userId === viewerId) return "You";
  return snapshot.members.find((member) => member.userId === userId)?.name ?? "A former member";
}

export function outstanding(share: Share): number {
  return Math.max(0, share.amountMinor - share.settledMinor);
}

export function pendingReport(share: Share): PaymentReport | null {
  return share.paymentReports?.find((report) => report.status === "pending") ?? null;
}

function live(snapshot: Snapshot): Expense[] {
  return snapshot.expenses.filter((expense) => !expense.voidedAt);
}

export function bandFor(dueOn: string | null, today: string): Band {
  if (!dueOn) return "No due date";
  if (dueOn < today) return "Overdue";
  if (dueOn === today) return "Today";
  return dueOn <= addDays(today, 7) ? "This week" : "Later";
}

export function statusFor(dueOn: string | null, today: string, kind: "share" | "task" = "share"): { text: string; tone: Tone } {
  if (!dueOn) return { text: "Whenever suits", tone: "plain" };
  const late = daysBetween(dueOn, today);
  if (late > 0) {
    if (kind === "task" && late === 1) return { text: "Due yesterday", tone: "late" };
    return { text: `${late} ${late === 1 ? "day" : "days"} overdue`, tone: "late" };
  }
  if (late === 0) return { text: "Today", tone: "attention" };
  const parts = calParts(dueOn, today);
  return { text: dueOn <= addDays(today, 6) ? `Due ${parts.dow}` : `Due ${parts.dow} ${parts.day} ${parts.mon}`, tone: "plain" };
}

function byDue<T extends { dueOn: string | null }>(a: T, b: T): number {
  return (a.dueOn ?? "9999").localeCompare(b.dueOn ?? "9999");
}

/** What the viewer has to do: shares to pay and their turns on tasks, soonest first. */
export function needs(snapshots: Snapshot[], viewerId: string, today: string): Need[] {
  const out: Need[] = [];
  for (const snapshot of snapshots) {
    const { commune } = snapshot;
    for (const expense of live(snapshot)) {
      if (expense.paidByUserId === viewerId) continue;
      for (const share of expense.shares) {
        if (share.userId !== viewerId) continue;
        const due = outstanding(share);
        if (!due || pendingReport(share)) continue;
        out.push({
          kind: "share", key: `share:${share.id}`, communeId: commune.id, title: expense.title,
          dueOn: expense.dueOn, band: bandFor(expense.dueOn, today), status: statusFor(expense.dueOn, today),
          expenseId: expense.id, shareId: share.id, payerId: expense.paidByUserId,
          payerName: memberName(snapshot, expense.paidByUserId), amountMinor: due, totalMinor: expense.amountMinor,
          currency: commune.currency, createdAt: expense.createdAt,
        });
      }
    }
    for (const item of snapshot.operations ?? []) {
      if (!isMyTurn(item, viewerId, today)) continue;
      out.push({
        kind: "task", key: `task:${item.id}`, communeId: commune.id, title: item.title, dueOn: item.date,
        band: bandFor(item.date, today), status: statusFor(item.date, today, "task"), operationId: item.id, date: item.date,
      });
    }
  }
  return out.sort((a, b) => BAND_ORDER.indexOf(a.band) - BAND_ORDER.indexOf(b.band) || byDue(a, b));
}

function isMyTurn(item: Operation, viewerId: string, today: string): boolean {
  return item.kind === "task" && item.status === "open" && item.assigneeId === viewerId && item.date <= today;
}

/** Shares other people owe the viewer, by expense. */
export function waiting(snapshots: Snapshot[], viewerId: string, today: string): Waiting[] {
  const out: Waiting[] = [];
  for (const snapshot of snapshots) {
    for (const expense of live(snapshot)) {
      if (expense.paidByUserId !== viewerId) continue;
      const debtors: Debtor[] = expense.shares
        .filter((share) => share.userId !== viewerId && outstanding(share) > 0)
        .map((share) => {
          const target = snapshot.reminderTargets.find((item) => item.kind === "nudge" && item.sourceId === share.id);
          return {
            userId: share.userId, name: memberName(snapshot, share.userId), shareId: share.id,
            amountMinor: outstanding(share), pending: pendingReport(share),
            canNudge: !!target, nudgedToday: !!target?.lastSentAt && target.lastSentAt.slice(0, 10) === today,
          };
        });
      if (!debtors.length) continue;
      out.push({
        key: `wait:${expense.id}`, communeId: snapshot.commune.id, expenseId: expense.id, title: expense.title,
        currency: snapshot.commune.currency, dueOn: expense.dueOn,
        status: expense.dueOn && expense.dueOn < today
          ? { text: `${daysBetween(expense.dueOn, today)} ${daysBetween(expense.dueOn, today) === 1 ? "day" : "days"} past due`, tone: "attention" }
          : statusFor(expense.dueOn, today),
        debtors,
      });
    }
  }
  return out.sort(byDue);
}

/** Payments the viewer reported that are waiting for the bill payer. */
export function recorded(snapshots: Snapshot[], viewerId: string): Recorded[] {
  const out: Recorded[] = [];
  for (const snapshot of snapshots) {
    for (const expense of live(snapshot)) {
      for (const share of expense.shares) {
        const report = share.userId === viewerId ? pendingReport(share) : null;
        if (!report) continue;
        out.push({
          key: `rec:${report.id}`, communeId: snapshot.commune.id, expenseId: expense.id, title: expense.title,
          payerName: memberName(snapshot, expense.paidByUserId), amountMinor: report.amountMinor,
          currency: snapshot.commune.currency, report,
        });
      }
    }
  }
  return out;
}

export type Totals = Partial<Record<CurrencyCode, number>>;
function add(totals: Totals, currency: CurrencyCode, minor: number) {
  totals[currency] = (totals[currency] ?? 0) + minor;
}
export function oweTotals(items: Need[], communeId?: string): Totals {
  const totals: Totals = {};
  for (const item of items) if (item.kind === "share" && (!communeId || item.communeId === communeId)) add(totals, item.currency, item.amountMinor);
  return totals;
}
export function owedTotals(items: Waiting[], communeId?: string): Totals {
  const totals: Totals = {};
  for (const item of items) {
    if (communeId && item.communeId !== communeId) continue;
    for (const debtor of item.debtors) add(totals, item.currency, debtor.amountMinor);
  }
  return totals;
}
export function hasAny(totals: Totals): boolean {
  return Object.values(totals).some((value) => (value ?? 0) > 0);
}

export type Settle = {
  youOwe: Array<{ userId: string; name: string; currency: CurrencyCode; amountMinor: number; items: ShareNeed[] }>;
  owedToYou: Array<{ userId: string; name: string; currency: CurrencyCode; amountMinor: number; items: Array<{ waiting: Waiting; debtor: Debtor }> }>;
};
/** Who you pay and who pays you, one row per person and currency. */
export function settle(items: Need[], owed: Waiting[]): Settle {
  const youOwe = new Map<string, Settle["youOwe"][number]>();
  for (const item of items) {
    if (item.kind !== "share") continue;
    const key = `${item.payerId}:${item.currency}`;
    const row = youOwe.get(key) ?? { userId: item.payerId, name: item.payerName, currency: item.currency, amountMinor: 0, items: [] };
    row.amountMinor += item.amountMinor;
    row.items.push(item);
    youOwe.set(key, row);
  }
  const owedToYou = new Map<string, Settle["owedToYou"][number]>();
  for (const entry of owed) {
    for (const debtor of entry.debtors) {
      const key = `${debtor.userId}:${entry.currency}`;
      const row = owedToYou.get(key) ?? { userId: debtor.userId, name: debtor.name, currency: entry.currency, amountMinor: 0, items: [] };
      row.amountMinor += debtor.amountMinor;
      row.items.push({ waiting: entry, debtor });
      owedToYou.set(key, row);
    }
  }
  return { youOwe: [...youOwe.values()], owedToYou: [...owedToYou.values()] };
}

/** One line for a commune tile or the Hub: the viewer's standing there. */
export function standing(snapshot: Snapshot, items: Need[], owed: Waiting[], mine: Recorded[]):
  { line: string; state: { text: string; tone: Tone } | null } {
  const id = snapshot.commune.id;
  const currency = snapshot.commune.currency;
  const owe = oweTotals(items, id)[currency] ?? 0;
  const late = items.filter((item) => item.kind === "share" && item.communeId === id && item.band === "Overdue").length;
  if (owe > 0) return { line: `You owe ${money(owe, currency)}`, state: late ? { text: late > 1 ? `${late} overdue` : "Overdue", tone: "late" } : null };
  const due = owedTotals(owed, id)[currency] ?? 0;
  if (due > 0) {
    const toConfirm = owed.some((entry) => entry.communeId === id && entry.debtors.some((debtor) => debtor.pending));
    const pastDue = owed.some((entry) => entry.communeId === id && entry.status.tone === "attention");
    return {
      line: `Owed ${money(due, currency)}`,
      state: toConfirm ? { text: "To confirm", tone: "attention" } : pastDue ? { text: "Past due", tone: "attention" } : null,
    };
  }
  if (mine.some((item) => item.communeId === id)) return { line: "All recorded", state: { text: "Waiting to confirm", tone: "plain" } };
  return { line: "All square", state: null };
}

export type FeedItem = { key: string; actorId: string; actorName: string; text: string; communeName: string; at: string };
/** The newest things other people did, across communes. The text follows the person's first name. */
export function feed(snapshots: Snapshot[], viewerId: string, limit = 4): FeedItem[] {
  const out: FeedItem[] = [];
  for (const snapshot of snapshots) {
    const { commune } = snapshot;
    for (const expense of live(snapshot)) {
      if (!expense.createdAt || expense.paidByUserId === viewerId) continue;
      const name = memberName(snapshot, expense.paidByUserId);
      out.push({
        key: `e:${expense.id}`, actorId: expense.paidByUserId, actorName: name, communeName: commune.name, at: expense.createdAt,
        text: `added ${expense.title}, ${money(expense.amountMinor, commune.currency)}, to ${commune.name}.`,
      });
    }
    for (const expense of live(snapshot)) {
      if (expense.paidByUserId !== viewerId) continue;
      for (const share of expense.shares) {
        const report = pendingReport(share);
        if (!report || share.userId === viewerId) continue;
        out.push({
          key: `r:${report.id}`, actorId: share.userId, actorName: memberName(snapshot, share.userId), communeName: commune.name, at: report.reportedAt,
          text: `said they paid you ${money(report.amountMinor, commune.currency)} for ${expense.title}.`,
        });
      }
    }
    for (const event of snapshot.activityEvents ?? []) {
      if (event.actorId === viewerId || event.kind === "expenses") continue;
      const name = memberName(snapshot, event.actorId);
      out.push({
        key: `a:${event.id}`, actorId: event.actorId, actorName: name, communeName: commune.name, at: event.createdAt,
        text: event.kind === "operations" && /completed/i.test(event.description)
          ? `finished ${event.title} · ${commune.name}`
          // Joining names the person as the title; say it once.
          : `· ${event.title === name ? "" : `${event.title}: `}${event.description.replace(/\.$/, "")} · ${commune.name}`,
      });
    }
  }
  return out.sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);
}

/** Things coming up in the next fortnight that are not the viewer's to do yet. */
export function comingUp(snapshots: Snapshot[], viewerId: string, today: string, limit = 3):
  Array<{ key: string; date: string; title: string; meta: string; claimable: boolean }> {
  const out: Array<{ key: string; date: string; title: string; meta: string; claimable: boolean }> = [];
  const until = addDays(today, 14);
  for (const snapshot of snapshots) {
    for (const item of snapshot.operations ?? []) {
      if (item.status !== "open" || item.date > until || (item.assigneeId === viewerId && item.date <= today)) continue;
      if (item.date < today) continue;
      const who = !item.assigneeId ? "nobody yet" : item.assigneeId === viewerId ? "your turn" : `${firstName(memberName(snapshot, item.assigneeId))}’s turn`;
      out.push({ key: `op:${item.id}`, date: item.date, title: item.title, meta: `${snapshot.commune.name} · ${who}`, claimable: !item.assigneeId && item.kind === "task" });
    }
    for (const bill of snapshot.recurringBills ?? []) {
      if (bill.paused || bill.nextDueOn < today || bill.nextDueOn > until) continue;
      const who = bill.paidByUserId === viewerId ? "you pay" : `${firstName(memberName(snapshot, bill.paidByUserId))} pays`;
      out.push({ key: `rb:${bill.id}`, date: bill.nextDueOn, title: `${bill.title} renews`, meta: `${snapshot.commune.name} · ${money(bill.amountMinor, snapshot.commune.currency)}, ${who}`, claimable: false });
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date)).slice(0, limit);
}

export function payLinksOf(snapshot: Snapshot | undefined, userId: string): PayLink[] {
  return parsePayLinks(snapshot?.payLinks?.[userId]);
}

export function activeMembers(snapshot: Snapshot) {
  return snapshot.members.filter((member) => member.active !== false);
}

const CURRENCY_WORD: Record<CurrencyCode, string> = { GBP: "pounds", EUR: "euros", USD: "dollars" };

/**
 * Where you stand once both directions count, per currency: positive when
 * you are ahead. Only currencies you owe in are listed, because otherwise
 * "you're owed" already says it.
 */
export function aheadBy(owe: Totals, owed: Totals): Array<{ currency: CurrencyCode; netMinor: number }> {
  return (Object.keys(owe) as CurrencyCode[])
    .filter((currency) => (owe[currency] ?? 0) > 0)
    .map((currency) => ({ currency, netMinor: (owed[currency] ?? 0) - (owe[currency] ?? 0) }));
}

/** "so you’re £92.45 ahead overall", or "so in pounds you’re £92.45 ahead" when more than one currency is in play. */
export function standingClause(net: { currency: CurrencyCode; netMinor: number }, manyCurrencies: boolean): string {
  const amount = money(Math.abs(net.netMinor), net.currency);
  const where = manyCurrencies ? `in ${CURRENCY_WORD[net.currency]} ` : "";
  const end = manyCurrencies ? "" : " overall";
  if (net.netMinor > 0) return `so ${where}you’re ${amount} ahead${end}`;
  if (net.netMinor < 0) return `so ${where}you owe ${amount}${end}`;
  return `so ${where}you’re even${end}`;
}

/** The Hub's money sentence under the headline, matching the web Hub. */
export function hubMoneyLine(oweMinor: number, owedMinor: number, currency: CurrencyCode): string {
  if (oweMinor > 0 && owedMinor > 0) {
    return `You’re also owed ${money(owedMinor, currency)}, ${standingClause({ currency, netMinor: owedMinor - oweMinor }, false)}.`;
  }
  if (oweMinor > 0) return "Nobody owes you anything here.";
  if (owedMinor > 0) return "You don’t owe anything here.";
  return "Nothing is owed either way.";
}

export type WeekItem = {
  key: string;
  kind: "task" | "event" | "bill";
  title: string;
  date: string;
  /** "You", a first name, or "Nobody yet". */
  who: string;
  assigneeId: string | null;
  mine: boolean;
  operation?: Operation;
  expenseId?: string;
  amountMinor?: number;
  /** What is still yours to pay on a bill. */
  yourShareMinor?: number;
  currency: CurrencyCode;
};
export type Week = { late: WeekItem[]; days: Array<{ date: string; items: WeekItem[] }> };

/** One commune's week: late tasks first, then seven days of tasks, events and bills due. */
export function week(snapshot: Snapshot, viewerId: string, today: string): Week {
  const { currency } = snapshot.commune;
  const end = addDays(today, 6);
  const who = (assigneeId: string | null | undefined) =>
    !assigneeId ? "Nobody yet" : assigneeId === viewerId ? "You" : firstName(memberName(snapshot, assigneeId));
  const fromOperation = (item: Operation): WeekItem => ({
    key: `op:${item.id}`, kind: item.kind, title: item.title, date: item.date, who: who(item.assigneeId),
    assigneeId: item.assigneeId ?? null, mine: item.assigneeId === viewerId, operation: item, currency,
  });
  const open = (snapshot.operations ?? []).filter((item) => item.status === "open");
  const late = open.filter((item) => item.kind === "task" && item.date < today).sort((a, b) => a.date.localeCompare(b.date)).map(fromOperation);
  const bills: WeekItem[] = live(snapshot)
    .filter((expense) => expense.dueOn && expense.dueOn >= today && expense.dueOn <= end && expense.shares.some((share) => outstanding(share) > 0))
    .map((expense) => {
      const mine = expense.shares.find((share) => share.userId === viewerId && expense.paidByUserId !== viewerId);
      return {
        key: `bill:${expense.id}`, kind: "bill", title: expense.title, date: expense.dueOn!, who: who(expense.paidByUserId),
        assigneeId: expense.paidByUserId, mine: expense.paidByUserId === viewerId, expenseId: expense.id,
        amountMinor: expense.amountMinor, yourShareMinor: mine ? outstanding(mine) : 0, currency,
      };
    });
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = addDays(today, index);
    const items = [
      ...open.filter((item) => item.date === date && (item.kind === "event" || item.date >= today)).map(fromOperation),
      ...bills.filter((bill) => bill.date === date),
    ];
    return { date, items };
  });
  return { late, days };
}

/** One line for the photo: what this week holds, worded as the web Hub words it. */
export function weekSentence(value: Week): string {
  const late = value.late.length;
  const today = value.days[0]?.items.filter((item) => item.kind !== "bill").length ?? 0;
  const bills = value.days.reduce((sum, day) => sum + day.items.filter((item) => item.kind === "bill").length, 0);
  const parts = [late ? `${late} late` : "", today ? `${today} due today` : "", bills ? `${bills} ${bills === 1 ? "bill" : "bills"} due this week` : ""].filter(Boolean);
  if (!parts.length) return "A quiet week.";
  return `${cap(joinAnd(parts))}.`;
}

/** A short pulse for a commune tile on Home: at most two things, the most pressing first. */
export function tilePulse(snapshot: Snapshot, viewerId: string, today: string): { text: string; late: boolean } {
  const value = week(snapshot, viewerId, today);
  const overdue = live(snapshot).filter((expense) => expense.dueOn && expense.dueOn < today && expense.shares.some((share) => outstanding(share) > 0)).length;
  const bills = value.days.reduce((sum, day) => sum + day.items.filter((item) => item.kind === "bill").length, 0);
  const parts = [
    value.late.length ? `${value.late.length} late ${value.late.length === 1 ? "chore" : "chores"}` : "",
    overdue ? `${overdue} overdue ${overdue === 1 ? "bill" : "bills"}` : "",
    bills ? `${bills} ${bills === 1 ? "bill" : "bills"} this week` : "",
  ].filter(Boolean);
  if (parts.length) return { text: parts.slice(0, 2).join(" · "), late: !!(value.late.length || overdue) };
  const next = live(snapshot)
    .filter((expense) => expense.dueOn && expense.dueOn > today && expense.shares.some((share) => outstanding(share) > 0))
    .sort((a, b) => a.dueOn!.localeCompare(b.dueOn!))[0];
  if (next) {
    const days = daysBetween(today, next.dueOn!);
    return { text: `${next.title} due in ${days} ${days === 1 ? "day" : "days"}`, late: false };
  }
  return { text: "Nothing due", late: false };
}

export type PersonLine = {
  userId: string; name: string; isYou: boolean;
  /** "Owes you £5.10", "You owe £12.00", "£108.45 ahead" or "All square". */
  balance: string;
  /** Money coming to the viewer reads green. */
  coming: boolean;
  /** Their next job, such as "Water the plants · Sun". */
  job: string;
};

/**
 * Each member's balance with the viewer in this commune, and what they have
 * on next. Worked out from the shares themselves, so a payment someone says
 * they sent still counts until it is confirmed.
 */
export function people(snapshot: Snapshot, viewerId: string, today: string): PersonLine[] {
  const { currency } = snapshot.commune;
  const net = new Map<string, number>();
  for (const expense of live(snapshot)) {
    for (const share of expense.shares) {
      const left = outstanding(share);
      if (!left) continue;
      if (expense.paidByUserId === viewerId && share.userId !== viewerId) net.set(share.userId, (net.get(share.userId) ?? 0) + left);
      if (share.userId === viewerId && expense.paidByUserId !== viewerId) net.set(expense.paidByUserId, (net.get(expense.paidByUserId) ?? 0) - left);
    }
  }
  const end = addDays(today, 6);
  const job = (userId: string) => {
    const next = (snapshot.operations ?? [])
      .filter((item) => item.kind === "task" && item.status === "open" && item.assigneeId === userId)
      .sort((a, b) => a.date.localeCompare(b.date))[0];
    if (!next || next.date > end) return "Nothing this week";
    const when = next.date < today ? "late" : next.date === today ? "today" : calParts(next.date, today).dow;
    return `${next.title} · ${when}`;
  };
  const members = activeMembers(snapshot);
  const you = members.find((member) => member.userId === viewerId);
  const yourNet = [...net.values()].reduce((sum, value) => sum + value, 0);
  const others = members.filter((member) => member.userId !== viewerId).map((member): PersonLine => {
    const value = net.get(member.userId) ?? 0;
    return {
      userId: member.userId, name: member.name, isYou: false, coming: value > 0, job: job(member.userId),
      balance: value > 0 ? `Owes you ${money(value, currency)}` : value < 0 ? `You owe ${money(-value, currency)}` : "All square",
    };
  });
  return [
    ...(you ? [{
      userId: you.userId, name: "You", isYou: true, coming: yourNet > 0, job: job(you.userId),
      balance: yourNet > 0 ? `${money(yourNet, currency)} ahead` : yourNet < 0 ? `You owe ${money(-yourNet, currency)}` : "All square",
    }] : []),
    ...others,
  ];
}

const SECRET = /password|passcode|door code|access code|pin code|\bcode\b/i;
const PHONE = /^\+?[\d ()-]{7,}$/;
const PRIORITY = ["Emergency", "Wi-Fi", "Keys / door", "Bins", "Contacts", "House rules", "Other"];
export type Essential = {
  id: string; title: string; category: string | null;
  facts: Array<{ label: string; value: string; secret: boolean; phone: boolean }>;
  /** When there are no labelled facts, the note's first line. */
  summary: string;
};
/** Shared notes as the Hub shows them: the details people look up most first, facts in place, secrets marked. */
export function essentials(snapshot: Snapshot, limit = 4): Essential[] {
  const rank = (pill?: string) => {
    const index = PRIORITY.indexOf(pill === "Landlord" ? "Contacts" : pill ?? "");
    return index === -1 ? PRIORITY.length : index;
  };
  return [...(snapshot.notes ?? [])]
    .sort((a, b) => rank(a.pill) - rank(b.pill))
    .slice(0, limit)
    .map((note) => {
      const facts = (note.facts ?? []).filter(([label, value]) => label !== "This Hub" && value).slice(0, 3)
        .map(([label, value]) => ({ label, value, secret: SECRET.test(label), phone: !SECRET.test(label) && PHONE.test(value.trim()) }));
      const category = note.pill && note.pill !== note.title ? note.pill : null;
      return { id: note.id, title: note.title, category, facts, summary: facts.length ? "" : (note.lede || note.body || "").slice(0, 120) };
    });
}
