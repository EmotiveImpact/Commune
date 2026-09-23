import {
  HUBS,
  initialsOf,
  type AvatarTone,
  type ExpenseRow,
  type Hub,
  type NoteCard,
} from "../data/household";
import type { OperationItem } from "../data/operations";

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
};
export type Share = {
  id: string;
  userId: string;
  amountMinor: number;
  settledMinor: number;
};
export type Expense = {
  id: string;
  title: string;
  category?: string;
  amountMinor: number;
  paidByUserId: string;
  dueOn: string | null;
  createdAt?: string;
  recurring?: boolean;
  shares: Share[];
};
export type Commitment = {
  id: string;
  userId: string;
  amountMinor: number;
  dueOn: string;
  contributedMinor: number;
};
export type Fund = {
  id: string;
  name: string;
  targetMinor: number | null;
  createdBy?: string;
  commitments: Commitment[];
  contributedMinor: number;
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
export type Notification = {
  id: string;
  kind: "nudge" | "chase";
  sourceId: string;
  amountMinor: number;
  communeId: string;
  senderUserId: string;
  createdAt: string;
  readAt: string | null;
};
export type LiveNote = NoteCard & { id: string };
export type Snapshot = {
  commune: Commune;
  members: Member[];
  expenses: Expense[];
  funds: Array<Omit<Fund, "contributedMinor">>;
  notifications: Notification[];
  reminderTargets: ReminderTarget[];
  notes?: LiveNote[];
  operations?: OperationItem[];
};
export type LiveExpenseRow = ExpenseRow & {
  amountMinor: number;
  paidByUserId: string;
  dueOn: string | null;
  shares: Share[];
};
export type LiveHub = Hub & {
  currency: CurrencyCode;
  role: MemberRole;
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
  const today = new Date().toISOString().slice(0, 10);
  return snapshot.expenses.map((expense) => {
    const outstanding = expense.shares.some((share) => share.settledMinor < share.amountMinor);
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
      status: outstanding ? (overdue ? "warn" : "open") : "settled",
      statusLabel: outstanding ? (overdue ? "Overdue" : "Open") : "Settled",
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
  snapshot: Snapshot,
  viewer: User,
  photo?: string,
): LiveHub {
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
  const members: LiveHub["members"] = snapshot.members.map((member, index) => {
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
  const month = new Date().toISOString().slice(0, 7);
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
    when: note.lede,
  }));
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
    lede: `${type} · ${snapshot.members.length} ${snapshot.members.length === 1 ? "person" : "people"}`,
    people: snapshot.members.map((member) => member.name.split(" ")[0]).join(", "),
    photo: photo ?? defaultPhoto,
    switchMeta: `${type} · ${snapshot.members.length} ${snapshot.members.length === 1 ? "person" : "people"}`,
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
      { go: "expenses", tone: "ink", kicker: "Next due", num: nextDue ? dateLabel(nextDue.dueOn) : "—", hint: nextDue?.name ?? "No dated open bills" },
    ],
    now: openRows.slice(0, 4).map((row) => ({
      go: "expenses" as const,
      pill: row.status,
      tag: row.due,
      title: row.name,
      when: `${row.amount} · ${row.paidBy} paid`,
    })),
    moves,
    members,
    activity: snapshot.expenses.slice(0, 8).map((expense, index) => ({
      go: "expenses" as const,
      cls: TONES[index % TONES.length],
      ini: initialsOf(names.get(expense.paidByUserId) ?? "Member"),
      title: expense.title,
      when: `${names.get(expense.paidByUserId) ?? "Member"} logged an expense`,
      time: expense.createdAt ? dateLabel(expense.createdAt.slice(0, 10)) : "Recently",
    })),
    notes,
    jumps: [
      { go: "expenses", kicker: "Expenses", title: `${snapshot.expenses.length} logged`, hint: `${openRows.length} open` },
      { go: "settle", kicker: "Settle", title: moves.length ? oweLabel : "Everyone is even", hint: moves.length ? money(moneyFocus, currency) : "No outstanding shares" },
      { go: "funds", kicker: "Funds", title: `${snapshot.funds.length} funds`, hint: `${money(fundTotal, currency)} recorded in` },
      { go: "notes", kicker: "Notes", title: `${notes.length} notes`, hint: "Shared information" },
      { go: "operations", kicker: "Operations", title: `${snapshot.operations?.length ?? 0} items`, hint: "The week ahead" },
    ],
  };
}
