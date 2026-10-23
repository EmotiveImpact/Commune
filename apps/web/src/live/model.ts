import {
  HUBS,
  initialsOf,
  type ActivityType,
  type AvatarTone,
  type ExpenseRow,
  type Hub,
  type NoteCard,
} from "../data/household";
import type { OperationItem } from "../data/operations";
import { notePreview } from "../data/notePresentation";
import { addDays, timestampDay, todayIso } from "../data/operations";
import { formatDay, formatMoney, netBalances, overallNet } from "@commune/core";

export type CurrencyCode = "GBP" | "USD" | "EUR";
/** Records that keep a commune's currency as it is, voided or archived ones too. */
export type CurrencyLock = "expenses" | "funds" | "recurringBills" | "exactSplitTemplates";
export type MemberRole = "admin" | "member";
export type User = {
  id: string;
  name: string;
  email: string;
  emailVerified?: boolean;
};
export type Commune = {
  id: string;
  name: string;
  kind: "household" | "workspace" | "trip";
  currency: CurrencyCode;
  role: MemberRole;
  memberCount?: number;
  address?: string;
  destination?: string;
  stayName?: string;
  stayAddress?: string;
  /** Moves whenever anything in the commune changes; compared with a snapshot's own. */
  changeMark?: string;
  /** The reader's unread notices in this commune (0039), for the bell across communes. */
  unreadNotices?: number;
  /** In a snapshot: what the database says keeps the currency as it is (0035). */
  currencyLockedBy?: CurrencyLock[];
};
export type Member = {
  userId: string;
  name: string;
  email?: string;
  role: MemberRole;
  active?: boolean;
};
/** One entry in a share's repayment ledger. Reversed entries stay visible. */
export type Receipt = {
  id: string;
  amountMinor: number;
  receivedOn: string;
  reference: string | null;
  recordedBy: string;
  recordedAt: string;
  /** "migrated" marks a confirmation made before the ledger existed. */
  origin?: "recorded" | "migrated";
  reversedAt: string | null;
  reversedBy: string | null;
  reversalReason: string | null;
};
export type ReceiptResult = {
  id: string;
  duplicate: boolean;
  settledMinor: number;
  outstandingMinor: number;
};
/**
 * "I've sent it": a claim by the member who owes a share. It never changes a
 * balance by itself; the bill payer confirms it (recording a receipt) or
 * declines it with a reason. It closes on its own if the share is settled
 * another way or the expense is voided.
 */
export type PaymentReport = {
  id: string;
  reportedBy: string;
  amountMinor: number;
  sentOn: string;
  reference: string | null;
  reportedAt: string;
  status: "pending" | "confirmed" | "declined" | "withdrawn" | "closed";
  resolvedAt: string | null;
  resolvedBy: string | null;
  /** Why it was declined, or why it closed on its own. */
  note: string | null;
  receiptId: string | null;
};
export type PaymentReportResult = {
  id: string;
  duplicate: boolean;
  status: PaymentReport["status"];
  receiptId: string | null;
  settledMinor: number;
  outstandingMinor: number;
};
export type Share = {
  id: string;
  userId: string;
  amountMinor: number;
  /** Projection of the receipts that have not been reversed. */
  settledMinor: number;
  settledAt?: string | null;
  receipts?: Receipt[];
  /** The latest reports, newest first; at most one is pending. */
  paymentReports?: PaymentReport[];
};
/** The financial and descriptive fields a correction can change. */
export type ExpenseState = {
  title: string;
  amountMinor: number;
  paidByUserId: string;
  category: string;
  dueOn: string | null;
  shares: Array<{ userId: string; amountMinor: number }>;
  voided?: boolean;
};
export type ExpenseRevision = {
  id: string;
  /** The version this change produced. Version 1 is the expense as recorded. */
  version: number;
  action: "corrected" | "voided";
  actorId: string;
  reason: string;
  before: ExpenseState;
  after: ExpenseState;
  createdAt: string;
};
export type ExpenseChangeResult = { version: number; duplicate: boolean };
export type Expense = {
  id: string;
  title: string;
  category?: string;
  amountMinor: number;
  paidByUserId: string;
  recordedBy?: string;
  dueOn: string | null;
  createdAt?: string;
  recurring?: boolean;
  /** Increments on every correction or void. Sent back as expectedVersion. */
  version?: number;
  updatedAt?: string | null;
  voidedAt?: string | null;
  voidedBy?: string | null;
  voidReason?: string | null;
  revisions?: ExpenseRevision[];
  shares: Share[];
};
export type Commitment = {
  id: string;
  userId: string;
  amountMinor: number;
  dueOn: string;
  contributedMinor: number;
  cancelledAt?: string | null;
  contributions?: Array<{ id: string; amountMinor: number; contributedAt: string; voidedAt: string | null; voidReason: string | null }>;
};
export type Fund = {
  id: string;
  name: string;
  targetMinor: number | null;
  createdBy?: string;
  commitments: Commitment[];
  contributedMinor: number;
  archivedAt?: string | null;
};
export type RecurringBill = {
  id: string; title: string; amountMinor: number; paidByUserId: string;
  allocations: Array<{ userId: string; amountMinor: number }>;
  frequency: "weekly" | "monthly"; nextDueOn: string; paused: boolean; createdBy: string;
  /** Every change makes a new version; an edit sends the one it was based on. */
  version: number;
  /** An archived bill is paused and out of the due list until restored. */
  archivedAt?: string | null;
  /** The latest periods, newest first. */
  history?: RecurringPeriod[];
};
/** What pausing, resuming, archiving or restoring left the bill as. */
export type RecurringBillState = {
  id: string; paused: boolean; archivedAt: string | null; version: number; duplicate: boolean;
};
export type RecurringPeriod = {
  dueOn: string; status: "recorded" | "skipped"; amountMinor: number | null; expenseId: string | null;
  actorId: string | null; actedAt: string; note: string | null;
};
export type RecurringPeriodResult = {
  status: RecurringPeriod["status"]; expenseId: string | null; amountMinor: number | null;
  dueOn: string; nextDueOn: string; duplicate: boolean;
};
export type SplitTemplate = {
  id: string; name: string; method: "Equal" | "Exact" | "Percentage" | "Shares";
  participants: Array<{ userId: string; value: string }>; createdBy: string; archivedAt: string | null;
};
export type ReminderTarget = {
  kind: "nudge" | "chase";
  sourceId: string;
  recipientUserId: string;
  amountMinor: number;
  currency: CurrencyCode;
  label: string;
  dueOn: string | null;
  lastSentAt: string | null;
};
export type ReminderUsage = {
  totalUsed: number;
  totalLimit: number;
  recipientLimit: number;
  recipientUsage: Record<string, number>;
  nextSlotAt: string | null;
  /** Last reminder to each person in the past day, across all communes. */
  recipientLastSent?: Record<string, string>;
};
/**
 * "none": no email can go out (delivery is not configured, or the obligation
 * was withdrawn). "possible": one may be sent, depending on the recipient's
 * own preference. Finer states would reveal that preference to the sender.
 */
export type ReminderEmailStatus = "possible" | "none";
/** What the server reports after accepting (or recognising a repeat of) a reminder. */
export type ReminderResult = {
  id: string;
  duplicate: boolean;
  emailStatus: ReminderEmailStatus;
};
/** The signed-in sender's own recent reminders in one commune. */
export type SentReminder = {
  id: string;
  kind: "nudge" | "chase";
  sourceId: string;
  recipientUserId: string;
  amountMinor: number;
  createdAt: string;
  emailStatus: ReminderEmailStatus;
};
export type Notification = {
  id: string;
  /**
   * Reminders, ledger notices about an expense the reader is part of, and
   * changes someone else made to the reader's own pledge (sourceId is the pledge).
   */
  kind: "nudge" | "chase" | "receipt-reversed" | "expense-corrected" | "expense-voided"
    | "payment-reported" | "payment-confirmed" | "payment-declined" | "pledge-changed" | "pledge-cancelled";
  sourceId: string;
  amountMinor: number | null;
  communeId: string;
  senderUserId: string;
  expenseId?: string | null;
  title?: string | null;
  detail?: string | null;
  createdAt: string;
  readAt: string | null;
};
/**
 * An unread notice from any of the reader's communes (0039), with what the
 * reader may not have loaded: the sender's name, and for a pledge notice the
 * fund that holds the pledge while it is open.
 */
export type UnreadNotice = Notification & { senderName?: string | null; fundId?: string | null };
/** A note's earlier content, as a summary; the content is read on demand. */
export type NoteRevisionSummary = {
  id: string; version: number; title: string;
  editedBy: string | null; editedAt: string; replacedBy: string | null; replacedAt: string;
};
export type NoteRevision = NoteCard & { id: string; version: number; editedBy: string | null; editedAt: string };
export type LiveNote = NoteCard & {
  id: string;
  /** Saves name the version they were based on (migration 0023). */
  version?: number; createdBy?: string; updatedBy?: string | null; updatedAt?: string;
  revisions?: NoteRevisionSummary[];
};
/** A notice from an admin. Taken-down notices are not in the snapshot. */
export type Announcement = {
  id: string;
  title: string;
  body: string;
  authorId: string;
  createdAt: string;
  needsAcknowledgement: boolean;
  acknowledgements: Array<{ userId: string; acknowledgedAt: string }>;
};
export type AnnouncementResult = { id: string; duplicate: boolean; archived: boolean };
export type Snapshot = {
  commune: Commune;
  members: Member[];
  expenses: Expense[];
  funds: Array<Omit<Fund, "contributedMinor">>;
  notifications: Notification[];
  reminderTargets: ReminderTarget[];
  sentReminders?: SentReminder[];
  notes?: LiveNote[];
  operations?: OperationItem[];
  recurringBills?: RecurringBill[];
  splitTemplates?: SplitTemplate[];
  announcements?: Announcement[];
  /** Pay links of current members who have saved any, keyed by user id (0042). */
  payLinks?: Record<string, unknown>;
  /** recordType: the kind of record the event is about (0039). */
  activityEvents?: Array<{id:string;actorId:string;kind:ActivityEventKind;entityId:string;title:string;description:string;createdAt:string;recordType?:ActivityType}>;
  /**
   * The snapshot holds every expense created since `since`, every open one
   * and the five newest that are not voided.
   */
  expenseHistory?: ExpenseHistory;
  changeMark?: string;
  /** An overview summary leaves out what only the commune's own screens show. */
  detail?: "summary";
};
export type ExpenseHistory = { since: string; olderCount: number; olderVoidedCount: number };
/** Older expenses: those created from `from` up to `before`, and how many are older still. */
export type ExpensePage = { expenses: Expense[]; before: string; from: string | null; olderCount: number; olderVoidedCount: number };
export type LiveExpenseRow = Omit<ExpenseRow, "amountMinor" | "paidByUserId" | "dueOn" | "shares"> & {
  amountMinor: number;
  paidByUserId: string;
  dueOn: string | null;
  shares: Share[];
  createdAt?: string;
  version: number;
  voidedAt: string | null;
  voidedBy: string | null;
  voidReason: string | null;
  revisions: ExpenseRevision[];
};
export type LiveHub = Omit<Hub, "members" | "activity" | "now"> & {
  currency: CurrencyCode;
  role: MemberRole;
  activityState?: "loading" | "error" | "ready";
  memberCount?: number;
  members: Array<Hub["members"][number] & { userId: string }>;
  activity: Array<Hub["activity"][number] & { type: ActivityType }>;
  /** Needs you: what the viewer has to do here, in order (see needsYou). */
  now: Need[];
  /** What the viewer is waiting on others for, with nothing to do. */
  waiting: Need[];
  /** The viewer's outstanding shares here, and everyone's outstanding shares of bills the viewer paid, in minor units. */
  youOweMinor: number;
  owedToYouMinor: number;
  /** Who has an outstanding share of a bill the viewer paid. */
  owingYou: string[];
  /** Coming up: turns and regular bills in the next fortnight (see comingUp). */
  coming: Upcoming[];
  /** This commune's week in a few words, for its card on Home (see communePulse). */
  pulse?: { text: string; late: boolean };
};

/**
 * A commune's week in a few words, at most two things, the most pressing
 * first: late chores, overdue bills, then bills due this week. Failing those,
 * the next bill due; failing that, "Nothing due".
 */
export function communePulse(snapshot: Snapshot, today = todayIso()): { text: string; late: boolean } {
  const end = addDays(today, 6);
  const unsettled = snapshot.expenses.filter((expense) => !expense.voidedAt && expense.dueOn && expense.shares.some((share) => share.settledMinor < share.amountMinor));
  const lateChores = (snapshot.operations ?? []).filter((item) => item.kind === "task" && item.status === "open" && item.date < today).length;
  const overdue = unsettled.filter((expense) => expense.dueOn! < today).length;
  const thisWeek = unsettled.filter((expense) => expense.dueOn! >= today && expense.dueOn! <= end).length;
  const parts = [
    lateChores ? `${lateChores} late ${lateChores === 1 ? "chore" : "chores"}` : "",
    overdue ? `${overdue} overdue ${overdue === 1 ? "bill" : "bills"}` : "",
    thisWeek ? `${thisWeek} ${thisWeek === 1 ? "bill" : "bills"} this week` : "",
  ].filter(Boolean);
  if (parts.length) return { text: parts.slice(0, 2).join(" · "), late: Boolean(lateChores || overdue) };
  const next = unsettled.filter((expense) => expense.dueOn! > end).sort((a, b) => a.dueOn!.localeCompare(b.dueOn!))[0];
  if (!next) return { text: "Nothing due", late: false };
  const [y1, m1, d1] = today.split("-").map(Number);
  const [y2, m2, d2] = next.dueOn!.split("-").map(Number);
  const days = Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
  return { text: `${next.title} due in ${days} days`, late: false };
}

/**
 * One row of "Coming up": a task's next turn or a regular bill's next date in
 * the next fortnight, with nothing to do yet. A task nobody holds can be taken.
 */
export type Upcoming = {
  kind: "task" | "bill";
  title: string;
  dueOn: string;
  /** Whose turn, or what the bill comes to and who pays it. */
  when: string;
  operationId?: string;
  billId?: string;
  /** A task nobody holds yet, which any member can take. */
  open?: boolean;
};

/**
 * One row of "Needs you". confirm: someone says they have sent a payment
 * only the viewer, the bill payer, can confirm. pay: the viewer's unpaid
 * share. task: the viewer's task, late or due today. pledge: the viewer's
 * pledge that is due. owed and reported wait on others: what people owe the
 * viewer, and a payment the viewer said they sent.
 */
export type Need = {
  kind: "confirm" | "pay" | "task" | "pledge" | "owed" | "reported";
  go: "expense" | "operation" | "funds";
  title: string;
  /** Who and what, without the amount. */
  when: string;
  amount?: string;
  /** The amount in minor units, where there is one. */
  minor?: number;
  dueOn?: string;
  /** Past its date. */
  late: boolean;
  expenseId?: string;
  operationId?: string;
  fundId?: string;
  /** The share it is about: the viewer's own (pay, reported) or one the viewer can confirm. */
  shareId?: string;
  /** The other person: who paid the bill (pay, reported) or who says they sent it (confirm). */
  person?: string;
  /** Everyone who still owes the viewer for this bill (owed). */
  people?: string[];
  /** The payment to confirm. */
  report?: PaymentReport;
};
/**
 * The name of anyone a snapshot knows, former members included (0031). With
 * left, someone who is no longer a member is named "(left)", where a screen
 * needs to make that clear. Only someone the snapshot does not know gets the
 * fallback words, such as "a former member".
 */
export function personName(members: Member[] | undefined, userId: string | null | undefined, fallback: string,
  options: { left?: boolean } = {}): string {
  const member = userId ? members?.find((item) => item.userId === userId) : undefined;
  if (!member?.name.trim()) return fallback;
  return options.left && member.active === false ? `${member.name} (left)` : member.name;
}

/** Turns and regular bills from today to 13 days on, soonest first. The viewer's own task due today is in Needs you. */
export function comingUp(snapshot: Snapshot, viewerId: string, today = todayIso()): Upcoming[] {
  const currency = snapshot.commune.currency;
  const last = addDays(today, 13);
  const nameOf = (userId: string) => personName(snapshot.members, userId, "a former member", { left: true });
  const rows: Upcoming[] = [];
  for (const item of snapshot.operations ?? []) {
    if (item.kind !== "task" || item.status !== "open" || item.date < today || item.date > last) continue;
    if (item.assigneeId === viewerId && item.date === today) continue;
    rows.push({ kind: "task", title: item.title, dueOn: item.date, operationId: item.id, open: !item.assigneeId,
      when: !item.assigneeId ? "nobody yet" : item.assigneeId === viewerId ? "your turn" : `${nameOf(item.assigneeId)}’s turn` });
  }
  for (const bill of snapshot.recurringBills ?? []) {
    if (bill.paused || bill.archivedAt || bill.nextDueOn < today || bill.nextDueOn > last) continue;
    const shares = bill.allocations.filter((share) => share.amountMinor > 0);
    const even = shares.length > 1 && shares.every((share) => share.amountMinor === shares[0].amountMinor);
    const yours = shares.find((share) => share.userId === viewerId)?.amountMinor;
    const split = even ? ` · ${money(shares[0].amountMinor, currency)} each` : yours ? ` · your share ${money(yours, currency)}` : "";
    rows.push({ kind: "bill", title: bill.title, dueOn: bill.nextDueOn, billId: bill.id,
      when: `${money(bill.amountMinor, currency)}, ${bill.paidByUserId === viewerId ? "you pay" : `${nameOf(bill.paidByUserId)} pays`}${split}` });
  }
  return rows.sort((a, b) => a.dueOn.localeCompare(b.dueOn));
}

const NEED_ORDER: Need["kind"][] = ["confirm", "pay", "task", "pledge", "owed", "reported"];
/** Actions in their order, then the earliest date first; anything undated after the dated ones. */
export function compareNeeds(a: Need, b: Need): number {
  return NEED_ORDER.indexOf(a.kind) - NEED_ORDER.indexOf(b.kind) || (a.dueOn ?? "9999").localeCompare(b.dueOn ?? "9999");
}
function namesList(names: string[]): string {
  return names.length < 3 ? names.join(" and ") : `${names.length} people`;
}

/**
 * "Needs you", one rule for Home and This Hub. Actions first, in this order:
 * payments someone says they have sent, which only the bill payer can
 * confirm; the viewer's unpaid shares; their tasks that are late or due
 * today; then their pledges that are due. "Waiting on others" holds what
 * people owe the viewer, and payments the viewer said they sent, while
 * there is nothing for the viewer to do. A summary snapshot keeps pending
 * payment reports (0039), so Home sees them for every commune.
 */
/** Owed both ways: say where that leaves the viewer, so the two figures never read as opposite answers. */
function overallLine(netMinor: number, currency: CurrencyCode): string {
  if (netMinor > 0) return `, so you’re ${money(netMinor, currency)} ahead overall`;
  if (netMinor < 0) return `, so you owe ${money(-netMinor, currency)} overall`;
  return ", so you’re even overall";
}

export function needsYou(snapshot: Snapshot, viewerId: string, today = todayIso()): { actions: Need[]; waiting: Need[] } {
  const currency = snapshot.commune.currency;
  const nameOf = (userId: string) => personName(snapshot.members, userId, "a former member", { left: true });
  const actions: Need[] = [];
  const waiting: Need[] = [];
  for (const expense of snapshot.expenses) {
    if (expense.voidedAt) continue;
    const dueOn = expense.dueOn ?? undefined;
    const late = !!dueOn && dueOn < today;
    const base = { go: "expense" as const, title: expense.title, expenseId: expense.id, dueOn, late };
    const owing: Array<{ userId: string; minor: number }> = [];
    for (const share of expense.shares) {
      const outstanding = share.amountMinor - share.settledMinor;
      if (share.userId === expense.paidByUserId || outstanding <= 0) continue;
      const report = share.paymentReports?.find((item) => item.status === "pending");
      if (expense.paidByUserId === viewerId) {
        if (report) {
          actions.push({ ...base, kind: "confirm", when: `${nameOf(share.userId)} says they sent it`, amount: money(report.amountMinor, currency),
            minor: report.amountMinor, shareId: share.id, person: share.userId, report });
        } else {
          owing.push({ userId: share.userId, minor: outstanding });
        }
      } else if (share.userId === viewerId) {
        const payer = nameOf(expense.paidByUserId);
        const yours = { shareId: share.id, person: expense.paidByUserId };
        if (report) {
          waiting.push({ ...base, ...yours, kind: "reported", when: `You said you sent it · waiting for ${payer}`, amount: money(report.amountMinor, currency),
            minor: report.amountMinor });
        } else {
          actions.push({ ...base, ...yours, kind: "pay", when: `You owe ${payer}${late ? " · overdue" : ""}`, amount: money(outstanding, currency),
            minor: outstanding });
        }
      }
    }
    if (owing.length) {
      const who = namesList(owing.map((item) => nameOf(item.userId)));
      const minor = owing.reduce((total, item) => total + item.minor, 0);
      waiting.push({ ...base, kind: "owed", when: `${who.charAt(0).toUpperCase()}${who.slice(1)} ${owing.length === 1 ? "owes" : "owe"} you`,
        amount: money(minor, currency), minor, people: owing.map((item) => item.userId) });
    }
  }
  for (const item of snapshot.operations ?? []) {
    if (item.kind !== "task" || item.status !== "open" || item.assigneeId !== viewerId || item.date > today) continue;
    const late = item.date < today;
    actions.push({ kind: "task", go: "operation", title: item.title, when: late ? "Overdue · your turn" : "Your turn today",
      operationId: item.id, dueOn: item.date, late });
  }
  for (const fund of snapshot.funds) {
    if (fund.archivedAt) continue;
    for (const pledge of fund.commitments) {
      if (pledge.cancelledAt || pledge.userId !== viewerId || pledge.amountMinor <= pledge.contributedMinor || pledge.dueOn > today) continue;
      const late = pledge.dueOn < today;
      const remaining = pledge.amountMinor - pledge.contributedMinor;
      actions.push({ kind: "pledge", go: "funds", title: fund.name, when: `Remaining on your pledge${late ? " · overdue" : ""}`,
        amount: money(remaining, currency), minor: remaining, fundId: fund.id, dueOn: pledge.dueOn, late });
    }
  }
  return { actions: actions.sort(compareNeeds), waiting: waiting.sort(compareNeeds) };
}
export type ActivityEventKind = "funds" | "members" | "recurring" | "templates" | "notes" | "operations" | "expenses" | "announcements";
/** The record type an event's area suggests, while the database does not name one (before 0039). */
const EVENT_TYPES: Record<ActivityEventKind, ActivityType> = {
  funds: "fund", members: "member", recurring: "recurring", templates: "template", notes: "note",
  operations: "task", expenses: "expense", announcements: "announcement",
};

const TONES: AvatarTone[] = ["jordan", "alex", "priya", "sam", "ness"];

/** An amount in the commune's currency: "£12.50", "$32.10". The shared, cached formatter. */
export function money(minor: number, currency: CurrencyCode): string {
  return formatMoney(minor, currency);
}

/** A due date as "9 Oct" (with the year when it is not this year), or "No due date". */
export function dateLabel(iso: string | null | undefined, today?: string): string {
  return iso ? formatDay(iso, today) : "No due date";
}

/** today: the member's own calendar date, as tasks and pledges use. */
export function expenseRows(snapshot: Snapshot, viewerId: string, today = todayIso()): LiveExpenseRow[] {
  const currency = snapshot.commune.currency;
  const names = new Map(snapshot.members.map((member) => [member.userId, member.name]));
  return snapshot.expenses.map((expense) => {
    const voided = !!expense.voidedAt;
    // A voided expense keeps its shares for history but is never outstanding.
    const outstanding = !voided && expense.shares.some((share) => share.settledMinor < share.amountMinor);
    const overdue = outstanding && !!expense.dueOn && expense.dueOn < today;
    const isPayer = expense.paidByUserId === viewerId;
    const splitEqual = expense.shares.length > 0 &&
      Math.max(...expense.shares.map((share) => share.amountMinor)) -
      Math.min(...expense.shares.map((share) => share.amountMinor)) <= 1;
    return {
      id: expense.id,
      name: expense.title,
      category: expense.category ?? "Other",
      paidBy: names.get(expense.paidByUserId) ?? "Member",
      paidByUserId: expense.paidByUserId,
      amount: money(expense.amountMinor, currency),
      amountMinor: expense.amountMinor,
      due: dateLabel(expense.dueOn, today),
      dueOn: expense.dueOn,
      createdAt: expense.createdAt,
      status: outstanding ? (overdue ? "warn" : "open") : "settled",
      statusLabel: voided ? "Voided" : outstanding ? (overdue ? "Overdue" : "Open") : "Settled",
      version: expense.version ?? 1,
      voidedAt: expense.voidedAt ?? null,
      voidedBy: expense.voidedBy ?? null,
      voidReason: expense.voidReason ?? null,
      revisions: expense.revisions ?? [],
      action: outstanding && isPayer ? "choose" : "none",
      open: outstanding,
      recurring: expense.recurring ?? false,
      split: splitEqual
        ? `Equal · ${expense.shares.length} ${expense.shares.length === 1 ? "way" : "ways"}`
        : "Custom split",
      shares: expense.shares,
    };
  });
}

export function hubFromSnapshot(
  source: Snapshot,
  viewer: User,
  photo?: string,
  today = todayIso(),
): LiveHub {
  // Voided expenses stay in the ledger as history but never count towards a
  // balance, a total or an outstanding share anywhere on the hub.
  const snapshot: Snapshot = { ...source, expenses: source.expenses.filter((expense) => !expense.voidedAt) };
  // Older settled expenses stay on the server until asked for; they still count as logged.
  const olderLogged = (source.expenseHistory?.olderCount ?? 0) - (source.expenseHistory?.olderVoidedCount ?? 0);
  const { commune } = snapshot;
  const currency = commune.currency;
  const names = new Map(snapshot.members.map((member) => [member.userId, member.name]));
  const rows = expenseRows(snapshot, viewer.id, today);
  const openRows = rows.filter((row) => row.open);
  const moves: Hub["moves"] = [];
  let youOwe = 0;
  let youAreOwed = 0;
  const owingYou = new Set<string>();
  for (const expense of snapshot.expenses) {
    for (const share of expense.shares) {
      if (share.userId === expense.paidByUserId) continue;
      const due = Math.max(0, share.amountMinor - share.settledMinor);
      if (!due) continue;
      if (share.userId === viewer.id) {
        youOwe += due;
        moves.push({
          go: "settle",
          arrow: "→",
          names: `You → ${names.get(expense.paidByUserId) ?? "Member"}`,
          why: expense.title,
          amt: money(due, currency),
          expenseId: expense.id,
        });
      } else if (expense.paidByUserId === viewer.id) {
        youAreOwed += due;
        owingYou.add(share.userId);
        moves.push({
          go: "settle",
          arrow: "→",
          names: `${names.get(share.userId) ?? "Member"} → You`,
          why: expense.title,
          amt: money(due, currency),
          expenseId: expense.id,
        });
      }
    }
  }
  const activeMembers = snapshot.members.filter(member => member.active !== false);
  // One net figure per person, so money owed both ways is never half shown.
  // The breakdown's statement uses the same figures.
  const nets = netBalances(snapshot.expenses, viewer.id);
  const members: LiveHub["members"] = activeMembers.map((member, index) => {
    const net = member.userId === viewer.id ? overallNet(nets) : nets.get(member.userId) ?? 0;
    const balance = member.userId === viewer.id
      ? net < 0
        ? `Owe ${money(-net, currency)} overall`
        : net > 0
          ? `Owed ${money(net, currency)} overall`
          : "Even"
      : net > 0
        ? `Owes you ${money(net, currency)}`
        : net < 0
          ? `You owe ${money(-net, currency)}`
          : "Even";
    return {
      userId: member.userId,
      cls: member.userId === viewer.id ? "maya" : TONES[index % TONES.length],
      ini: initialsOf(member.name),
      name: member.name,
      meta: `${member.userId === viewer.id ? "You · " : ""}${member.role === "admin" ? "Admin" : "Member"}`,
      bal: balance,
      muted: balance === "Even",
      nudge: snapshot.reminderTargets.some((target) =>
        target.kind === "nudge" && target.recipientUserId === member.userId),
    };
  });
  const fundTotal = snapshot.funds.reduce((sum, fund) => sum +
    fund.commitments.reduce((subtotal, commitment) => subtotal + commitment.contributedMinor, 0), 0);
  // This month where the member is: an expense entered late on the last
  // evening of a month belongs to that month.
  const month = today.slice(0, 7);
  const monthExpenses = snapshot.expenses.filter((expense) => timestampDay(expense.createdAt).startsWith(month));
  const monthTotal = monthExpenses
    .reduce((sum, expense) => sum + expense.amountMinor, 0);
  const nextDue = openRows
    .filter((row) => row.dueOn)
    .sort((a, b) => (a.dueOn ?? "").localeCompare(b.dueOn ?? ""))[0];
  const type = commune.kind === "workspace" ? "Workspace" : commune.kind === "trip" ? "Trip" : "Household";
  const defaultPhoto = type === "Workspace" ? HUBS.studio.photo : type === "Trip" ? HUBS.lisbon.photo : HUBS.park.photo;
  const moneyFocus = youOwe > 0 ? youOwe : youAreOwed;
  const oweLabel = youOwe > 0 ? "You owe" : youAreOwed > 0 ? "You’re owed" : "You’re even";
  const notes = (snapshot.notes ?? []).map((note) => ({
    go: "note" as const,
    note: note.id,
    title: note.title,
    when: notePreview(note),
  }));
  const needs = needsYou(source, viewer.id, today);
  return {
    id: commune.id,
    currency,
    role: commune.role,
    name: commune.name,
    type,
    address: commune.address ?? "",
    destination: commune.destination ?? "",
    stayName: commune.stayName ?? "",
    stayAddress: commune.stayAddress ?? "",
    lede: `${type} · ${activeMembers.length} ${activeMembers.length === 1 ? "person" : "people"}`,
    people: activeMembers.map((member) => member.name.split(" ")[0]).join(", "),
    photo: photo ?? defaultPhoto,
    switchMeta: `${type} · ${activeMembers.length} ${activeMembers.length === 1 ? "person" : "people"}`,
    status: `${openRows.length} open ${openRows.length === 1 ? "expense" : "expenses"} · ${moves.length} outstanding ${moves.length === 1 ? "share" : "shares"}`,
    youMeta: `${commune.role === "admin" ? "Admin" : "Member"} · ${commune.name}`,
    avatars: members.slice(0, 5).map((member) => [member.cls, member.ini]),
    oweLabel,
    oweAmount: money(moneyFocus, currency),
    oweCopy: youOwe > 0
      ? `You owe ${money(youOwe, currency)} in outstanding shares.${youAreOwed > 0 ? ` You’re also owed ${money(youAreOwed, currency)}${overallLine(youAreOwed - youOwe, currency)}.` : ""}`
      : youAreOwed > 0
        ? `You’re owed ${money(youAreOwed, currency)} in outstanding shares.`
        : "No outstanding shares involving you.",
    oweCta: moves.length ? "Open settlement" : "Add expense",
    credit: youOwe === 0 && youAreOwed > 0,
    kpis: [
      { go: "funds", tone: "peach", kicker: "Recorded contributions", num: money(fundTotal, currency), hint: `${snapshot.funds.length} ${snapshot.funds.length === 1 ? "fund" : "funds"}` },
      { go: "expenses", tone: "lilac", kicker: "This month", num: money(monthTotal, currency), hint: `${monthExpenses.length} ${monthExpenses.length === 1 ? "expense" : "expenses"} logged` },
      { go: "expenses", tone: "sage", kicker: "Open bills", num: String(openRows.length), hint: openRows[0]?.name ?? "Nothing waiting" },
      // A date that has passed says so rather than reading as still to come.
      { go: "expenses", tone: "ink", kicker: "Next due", num: nextDue?.dueOn ? nextDue.dueOn < today ? `Overdue since ${dateLabel(nextDue.dueOn, today)}` : dateLabel(nextDue.dueOn, today) : "-", hint: nextDue?.name ?? "No dated open bills" },
    ],
    now: needs.actions,
    waiting: needs.waiting,
    youOweMinor: youOwe,
    owedToYouMinor: youAreOwed,
    owingYou: [...owingYou],
    coming: comingUp(source, viewer.id, today),
    pulse: communePulse(snapshot, today),
    moves,
    members,
    activity: [...snapshot.expenses.map((expense) => ({
      go: "expenses" as const,
      cls: members.find(member => member.userId === expense.paidByUserId)?.cls ?? "jordan",
      ini: initialsOf(names.get(expense.paidByUserId) ?? "Member"),
      title: expense.title,
      when: `${names.get(expense.paidByUserId) ?? "Member"} paid`,
      amount: money(expense.amountMinor, currency),
      time: expense.createdAt ? dateLabel(timestampDay(expense.createdAt), today) : "Recently",
      createdAt: expense.createdAt,
      expenseId: expense.id,
      type: "expense" as const,
    })), ...(snapshot.activityEvents ?? []).map(event => ({
      // Announcements live on This Hub.
      go:event.kind === "announcements" ? "hub" as const : event.kind,cls:members.find(member=>member.userId===event.actorId)?.cls ?? "jordan" as const,
      ini:initialsOf(names.get(event.actorId) ?? "Member"), title:event.title,
      when:`${event.description} · ${names.get(event.actorId) ?? "Member"}`, time:dateLabel(timestampDay(event.createdAt), today),createdAt:event.createdAt,
      expenseId:event.kind==="expenses" ? event.entityId : undefined,
      type:event.recordType ?? EVENT_TYPES[event.kind],
    }))].sort((a,b)=>(Date.parse(b.createdAt ?? "")||0)-(Date.parse(a.createdAt ?? "")||0)),
    notes,
    jumps: [
      { go: "expenses", kicker: "Expenses", title: `${snapshot.expenses.length + olderLogged} logged`, hint: `${openRows.length} open` },
      { go: "settle", kicker: "Settle", title: moves.length ? oweLabel : "You’re even", hint: moves.length ? money(moneyFocus, currency) : "No outstanding shares involving you" },
      { go: "funds", kicker: "Funds", title: `${snapshot.funds.length} funds`, hint: `${money(fundTotal, currency)} recorded in` },
      { go: "notes", kicker: "Notes", title: `${notes.length} notes`, hint: "Shared information" },
      { go: "operations", kicker: "Operations", title: `${snapshot.operations?.length ?? 0} items`, hint: "The week ahead" },
    ],
  };
}

/** A commune whose snapshot is loaded, as the app shows it. */
export type ReadyPlace = LiveHub & { activityState: "ready" };
const readyPlaces = new WeakMap<Snapshot, { viewerId: string; photo: string | undefined; today: string; place: ReadyPlace }>();
/**
 * hubFromSnapshot, kept with the snapshot it was built from. A commune's
 * views are built again only when the commune is read again (a new
 * snapshot), its photo changes or the date does, and never for a change
 * anywhere else in the app.
 */
export function readyPlace(snapshot: Snapshot, viewer: User, photo?: string, today = todayIso()): ReadyPlace {
  const held = readyPlaces.get(snapshot);
  if (held && held.viewerId === viewer.id && held.photo === photo && held.today === today) return held.place;
  const place: ReadyPlace = { ...hubFromSnapshot(snapshot, viewer, photo, today), activityState: "ready" };
  readyPlaces.set(snapshot, { viewerId: viewer.id, photo, today, place });
  return place;
}
