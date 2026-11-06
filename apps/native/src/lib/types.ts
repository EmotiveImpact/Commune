/**
 * The shapes the phone app reads. They match the web app's snapshot contract
 * (apps/web/src/live/model.ts): the same server functions answer both, so
 * only the fields the phone uses are listed here.
 */
export type CurrencyCode = "GBP" | "USD" | "EUR";
export type MemberRole = "admin" | "member";

export type User = { id: string; name: string; email: string; emailVerified?: boolean };

export type Commune = {
  id: string;
  name: string;
  kind: "household" | "workspace" | "trip";
  currency: CurrencyCode;
  role: MemberRole;
  memberCount?: number;
  address?: string;
  destination?: string;
};

export type Member = { userId: string; name: string; email?: string; role: MemberRole; active?: boolean };

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
  note: string | null;
  receiptId: string | null;
};

export type Share = {
  id: string;
  userId: string;
  amountMinor: number;
  /** What the bill payer has confirmed so far. */
  settledMinor: number;
  /** The latest reports, newest first; at most one is pending. */
  paymentReports?: PaymentReport[];
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
  version?: number;
  voidedAt?: string | null;
  shares: Share[];
};

export type Commitment = {
  id: string; userId: string; amountMinor: number; dueOn: string; contributedMinor: number; cancelledAt?: string | null;
};
export type Fund = {
  id: string; name: string; targetMinor: number | null; commitments: Commitment[]; archivedAt?: string | null;
};
export type RecurringBill = {
  id: string; title: string; amountMinor: number; paidByUserId: string;
  allocations: Array<{ userId: string; amountMinor: number }>;
  frequency: "weekly" | "monthly"; nextDueOn: string; paused: boolean;
};
export type SplitTemplate = {
  id: string; name: string; method: "Equal" | "Exact" | "Percentage" | "Shares";
  participants: Array<{ userId: string; value: string }>; archivedAt: string | null;
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
export type Note = {
  id: string; title: string; lede?: string; body?: string; kicker?: string;
  /** The kind of detail, such as "Wi-Fi" or "Bins". */
  pill?: string;
  /** Labelled details such as ["Password", "…"]; secret ones stay hidden until asked for. */
  facts?: Array<[string, string]>;
};
export type Operation = {
  id: string;
  kind: "task" | "event";
  title: string;
  date: string;
  allDay?: boolean;
  assigneeId?: string | null;
  rotationIds?: string[] | null;
  repeat: "none" | "weekly" | "monthly";
  status: "open" | "done";
  notes?: string;
  time?: string | null;
  /** The latest completion that can still be undone. */
  undoOccurrenceId?: string | null;
};
export type Announcement = {
  id: string; title: string; body: string; authorId: string; createdAt: string; needsAcknowledgement: boolean;
  acknowledgements: Array<{ userId: string; acknowledgedAt: string }>;
};
export type ActivityEvent = {
  id: string; actorId: string; kind: string; entityId: string; title: string; description: string; createdAt: string;
};

export type Snapshot = {
  commune: Commune;
  members: Member[];
  expenses: Expense[];
  funds: Fund[];
  notifications: Notification[];
  reminderTargets: ReminderTarget[];
  notes?: Note[];
  operations?: Operation[];
  recurringBills?: RecurringBill[];
  splitTemplates?: SplitTemplate[];
  announcements?: Announcement[];
  /** Pay links of current members who have saved any, keyed by user id. */
  payLinks?: Record<string, unknown>;
  activityEvents?: ActivityEvent[];
};
