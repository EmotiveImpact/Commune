import {
  HUBS,
  initialsOf,
  type AvatarTone,
  type ExpenseRow,
  type Hub,
  type NoteCard,
} from "../data/household";
import type { OperationItem } from "../data/operations";
import { notePreview } from "../data/notePresentation";
import { todayIso } from "../data/operations";

export type CurrencyCode = "GBP" | "USD" | "EUR";
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
  /** The latest periods, newest first. */
  history?: RecurringPeriod[];
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
  /** Reminders, plus ledger notices about an expense the reader is part of. */
  kind: "nudge" | "chase" | "receipt-reversed" | "expense-corrected" | "expense-voided"
    | "payment-reported" | "payment-confirmed" | "payment-declined";
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
  activityEvents?: Array<{id:string;actorId:string;kind:"funds"|"members"|"recurring"|"templates"|"notes"|"operations"|"expenses"|"announcements";entityId:string;title:string;description:string;createdAt:string}>;
};
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
export type LiveHub = Omit<Hub, "members"> & {
  currency: CurrencyCode;
  role: MemberRole;
  activityState?: "loading" | "error" | "ready";
  memberCount?: number;
  members: Array<Hub["members"][number] & { userId: string }>;
};

const TONES: AvatarTone[] = ["jordan", "alex", "priya", "sam", "ness"];

export function money(minor: number, currency: CurrencyCode): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
  }).format(minor / 100);
}

export function dateLabel(iso: string | null | undefined): string {
  if (!iso) return "No due date";
  const date = new Date(`${iso.slice(0, 10)}T12:00:00`);
  return Number.isNaN(date.getTime())
    ? iso
    : new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(date);
}

export function equalShares(
  amountMinor: number,
  userIds: string[],
): Array<{ userId: string; amountMinor: number }> {
  const ids = [...userIds];
  if (new Set(ids).size !== ids.length) {
    throw new Error("Each person may appear only once in a split.");
  }
  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0 || !ids.length || amountMinor < ids.length) {
    throw new Error("The amount must have at least one penny for each person in the split.");
  }
  const base = Math.floor(amountMinor / ids.length);
  const remainder = amountMinor % ids.length;
  return ids.map((userId, index) => ({
    userId,
    amountMinor: base + (index < remainder ? 1 : 0),
  }));
}

export function expenseRows(snapshot: Snapshot, viewerId: string): LiveExpenseRow[] {
  const currency = snapshot.commune.currency;
  const names = new Map(snapshot.members.map((member) => [member.userId, member.name]));
  // The member's own calendar date, as tasks and pledges use.
  const today = todayIso();
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
      due: dateLabel(expense.dueOn),
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
): LiveHub {
  // Voided expenses stay in the ledger as history but never count towards a
  // balance, a total or an outstanding share anywhere on the hub.
  const snapshot: Snapshot = { ...source, expenses: source.expenses.filter((expense) => !expense.voidedAt) };
  const { commune } = snapshot;
  const currency = commune.currency;
  const names = new Map(snapshot.members.map((member) => [member.userId, member.name]));
  const rows = expenseRows(snapshot, viewer.id);
  const openRows = rows.filter((row) => row.open);
  const moves: Hub["moves"] = [];
  let youOwe = 0;
  let youAreOwed = 0;
  const byMember = new Map<string, { owesYou: number; youOwe: number }>();
  for (const expense of snapshot.expenses) {
    for (const share of expense.shares) {
      if (share.userId === expense.paidByUserId) continue;
      const due = Math.max(0, share.amountMinor - share.settledMinor);
      if (!due) continue;
      if (share.userId === viewer.id) {
        youOwe += due;
        const prior = byMember.get(expense.paidByUserId) ?? { owesYou: 0, youOwe: 0 };
        prior.youOwe += due;
        byMember.set(expense.paidByUserId, prior);
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
        const prior = byMember.get(share.userId) ?? { owesYou: 0, youOwe: 0 };
        prior.owesYou += due;
        byMember.set(share.userId, prior);
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
  const members: LiveHub["members"] = activeMembers.map((member, index) => {
    const relation = byMember.get(member.userId) ?? { owesYou: 0, youOwe: 0 };
    const balance = member.userId === viewer.id
      ? youOwe > 0
        ? `Owe ${money(youOwe, currency)}`
        : youAreOwed > 0
          ? `Owed ${money(youAreOwed, currency)}`
          : "Even"
      : relation.owesYou > 0
        ? `Owes you ${money(relation.owesYou, currency)}`
        : relation.youOwe > 0
          ? `You owe ${money(relation.youOwe, currency)}`
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
  const month = todayIso().slice(0, 7);
  const monthExpenses = snapshot.expenses.filter((expense) => expense.createdAt?.startsWith(month));
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
  const today = todayIso();
  const personalNeeds: Hub["now"] = [
    ...openRows.filter(row => row.paidByUserId === viewer.id || row.shares.some(share => share.userId === viewer.id && share.settledMinor < share.amountMinor)).map(row => ({
      go: "expense" as const, pill: row.status, tag: row.due, title: row.name,
      when: `${row.amount} · ${row.paidBy} paid`, expenseId: row.id, dueOn: row.dueOn ?? undefined,
    })),
    ...(snapshot.operations ?? []).filter(item => item.kind === "task" && item.status === "open" && item.assigneeId === viewer.id && item.date <= today).map(item => ({
      go: "operation" as const, pill: item.date < today ? "warn" : "open", tag: item.date < today ? "Overdue" : "Today",
      title: item.title, when: item.date < today ? "Overdue · your turn" : "Your turn today", operationId: item.id, dueOn: item.date,
    })),
    ...snapshot.funds.filter(fund => !fund.archivedAt).flatMap(fund => fund.commitments.filter(pledge => !pledge.cancelledAt && pledge.userId === viewer.id && pledge.amountMinor > pledge.contributedMinor && pledge.dueOn <= today).map(pledge => ({
      go: "funds" as const, pill: pledge.dueOn < today ? "warn" : "open", tag: dateLabel(pledge.dueOn), title: fund.name,
      when: `${money(pledge.amountMinor - pledge.contributedMinor, currency)} remaining on your pledge`, dueOn: pledge.dueOn,
    }))),
  ];
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
      ? `You owe ${money(youOwe, currency)} in outstanding shares.${youAreOwed > 0 ? ` You’re also owed ${money(youAreOwed, currency)}.` : ""}`
      : youAreOwed > 0
        ? `You’re owed ${money(youAreOwed, currency)} in outstanding shares.`
        : "No outstanding shares involving you.",
    oweCta: moves.length ? "Open settlement" : "Add expense",
    credit: youOwe === 0 && youAreOwed > 0,
    kpis: [
      { go: "funds", tone: "peach", kicker: "Recorded contributions", num: money(fundTotal, currency), hint: `${snapshot.funds.length} ${snapshot.funds.length === 1 ? "fund" : "funds"}` },
      { go: "analytics", tone: "lilac", kicker: "This month", num: money(monthTotal, currency), hint: `${monthExpenses.length} ${monthExpenses.length === 1 ? "expense" : "expenses"} logged` },
      { go: "expenses", tone: "sage", kicker: "Open bills", num: String(openRows.length), hint: openRows[0]?.name ?? "Nothing waiting" },
      { go: "expenses", tone: "ink", kicker: "Next due", num: nextDue ? dateLabel(nextDue.dueOn) : "-", hint: nextDue?.name ?? "No dated open bills" },
    ],
    now: personalNeeds.sort((a, b) => (a.dueOn ?? "9999").localeCompare(b.dueOn ?? "9999")),
    moves,
    members,
    activity: [...snapshot.expenses.map((expense) => ({
      go: "expenses" as const,
      cls: members.find(member => member.userId === expense.paidByUserId)?.cls ?? "jordan",
      ini: initialsOf(names.get(expense.paidByUserId) ?? "Member"),
      title: expense.title,
      when: `${names.get(expense.paidByUserId) ?? "Member"} paid`,
      time: expense.createdAt ? dateLabel(expense.createdAt.slice(0, 10)) : "Recently",
      createdAt: expense.createdAt,
      expenseId: expense.id,
    })), ...(snapshot.activityEvents ?? []).map(event => ({
      // Announcements live on This Hub.
      go:event.kind === "announcements" ? "hub" as const : event.kind,cls:members.find(member=>member.userId===event.actorId)?.cls ?? "jordan" as const,
      ini:initialsOf(names.get(event.actorId) ?? "Member"), title:event.title,
      when:`${event.description} · ${names.get(event.actorId) ?? "Member"}`, time:dateLabel(event.createdAt),createdAt:event.createdAt,
      expenseId:event.kind==="expenses" ? event.entityId : undefined,
    }))].sort((a,b)=>(Date.parse(b.createdAt ?? "")||0)-(Date.parse(a.createdAt ?? "")||0)),
    notes,
    jumps: [
      { go: "expenses", kicker: "Expenses", title: `${snapshot.expenses.length} logged`, hint: `${openRows.length} open` },
      { go: "settle", kicker: "Settle", title: moves.length ? oweLabel : "You’re even", hint: moves.length ? money(moneyFocus, currency) : "No outstanding shares involving you" },
      { go: "funds", kicker: "Funds", title: `${snapshot.funds.length} funds`, hint: `${money(fundTotal, currency)} recorded in` },
      { go: "notes", kicker: "Notes", title: `${notes.length} notes`, hint: "Shared information" },
      { go: "operations", kicker: "Operations", title: `${snapshot.operations?.length ?? 0} items`, hint: "The week ahead" },
    ],
  };
}
