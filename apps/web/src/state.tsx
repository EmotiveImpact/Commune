import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useLocation, useRouter, useSearch } from "wouter";
import { useBrowserLocation } from "wouter/use-browser-location";
import { isConnectionFailure } from "./live/connection";
import { allocateExpense, validateExpenseAllocation, type ExpenseAllocation } from "../../../packages/core/src/expenseSplit";
import {
  PAGE_LEDES,
  PAGE_TITLES,
  WINDOW_PAGE,
  initialsOf,
  isWindowId,
  type CreatedHub,
  type HubId,
  type NoteCard,
  type ScreenId,
  type WindowId,
} from "./data/household";
import {
  todayIso,
  type NewOperation,
  type OperationChange,
  type OperationItem,
  type OperationStore,
} from "./data/operations";
import { newRequestId } from "./data/requestId";
import { COMMUNE_SCREENS, FORM_WINDOWS, addressOf, isNativeNow, keepSearch, readAddress, withCommune } from "./nav";
import { api, post, loadCommunes, loadExpensePage, loadExpenseRecords, loadSnapshot, ApiError } from "./live/api";
import { announceSession, currentViewer, onOtherTabSession, setViewer } from "./live/session";
import {
  DEFAULT_ACCOUNT,
  DEFAULT_DEVICE,
  DEVICE_KEY,
  accountKey,
  adoptTabPrefs,
  forgetAccountPrefs,
  readAccountPrefs,
  readDevicePrefs,
  saveAccountPrefs,
  saveDevicePrefs,
  type AccountPrefs,
  type DevicePrefs,
  type NavMode,
  type PayMethod,
  type Theme,
} from "./live/preferences";
import {
  expenseRows,
  hubFromSnapshot,
  money,
  personName,
  type Commune,
  type CurrencyCode,
  type Expense,
  type Fund,
  type LiveExpenseRow,
  type LiveHub,
  type Notification,
  type ExpenseChangeResult,
  type ReceiptResult,
  type LiveNote,
  type NoteRevision,
  type PaymentReportResult,
  type RecurringPeriodResult,
  type ReminderResult,
  type ReminderTarget,
  type ReminderUsage,
  type SentReminder,
  type Snapshot,
  type User,
  type RecurringBill,
  type RecurringBillState,
  type SplitTemplate,
  type Announcement,
  type AnnouncementResult,
  type UnreadNotice,
} from "./live/model";

export type Seed = "new";
export type { NavMode, PayMethod, Theme };
/** An invitation and where it is in its life. Admins see them all. */
export type PendingInvite = {
  /** Null once the person who accepted it has left: their address is theirs. */
  id: string; email: string | null; role: "Member" | "Admin";
  status: "pending" | "expired" | "accepted" | "revoked";
  createdAt: string; expiresAt: string; acceptedAt: string | null; revokedAt: string | null;
  /** Who sent it. Their open invitations end when they stop being an admin. */
  invitedBy: string | null; invitedByName: string | null;
  /** Who accepted it, so a former member can be named from the snapshot. */
  acceptedBy: string | null;
};
type InviteRecord = { id: string; email: string | null; role: "member" | "admin"; createdAt: string; expiresAt: string; acceptedAt: string | null; revokedAt: string | null;
  invitedBy?: string | null; invitedByName?: string | null; acceptedBy?: string | null };
export function inviteStatus(invite: Pick<InviteRecord, "acceptedAt" | "revokedAt" | "expiresAt">, now = Date.now()): PendingInvite["status"] {
  if (invite.acceptedAt) return "accepted";
  if (invite.revokedAt) return "revoked";
  return Date.parse(invite.expiresAt) > now ? "pending" : "expired";
}
export type Session = {
  userId: string;
  name: string;
  email: string;
  emailVerified: boolean;
  hasHubs: boolean;
  emptyLedger: boolean;
  seed: Seed;
  // Old screens may read these fields while being migrated. They are never
  // used as a shared-data source and are not populated from sample fixtures.
  createdHub?: CreatedHub;
  hubPhotos?: Partial<Record<HubId, string>>;
  avatar?: string;
};
export type CreateExpenseInput = {
  name: string;
  amountMinor: number;
  category?: string;
  dueOn?: string | null;
  shareUserIds: string[];
  allocations?: ExpenseAllocation[];
  paidByUserId?: string;
  /** One id per open form, kept across retries, so a retry cannot record it twice. */
  requestId: string;
};
/** A pledge edit or cancellation, with the amount and date it was based on. */
export type PledgeChange = {
  amountMinor?: number; dueOn?: string; cancel?: boolean;
  expectedAmountMinor?: number; expectedDueOn?: string;
};
export type CorrectExpenseInput = {
  expectedVersion: number;
  name: string;
  amountMinor: number;
  category: string;
  dueOn: string | null;
  paidByUserId: string;
  allocations: ExpenseAllocation[];
  reason: string;
  requestId: string;
};
/** An add carries one request id per open form, so a retry cannot add it
 * twice. An edit names the version the editor loaded and never pauses or
 * resumes the bill. */
export type RecurringBillInput = Pick<RecurringBill, "title" | "amountMinor" | "paidByUserId" | "allocations" | "frequency" | "nextDueOn"> &
  ({ requestId: string; paused?: boolean } | { id: string; expectedVersion: number });
export type SplitTemplateInput = Omit<SplitTemplate, "id" | "createdBy" | "archivedAt"> & { id?: string; archived?: boolean };

function locationForKind(input: {
  type: LiveHub["type"];
  address?: string;
  destination?: string;
  stayName?: string;
  stayAddress?: string;
}) {
  return input.type === "Trip"
    ? {
      address: "",
      destination: input.destination?.trim() ?? "",
      stayName: input.stayName?.trim() ?? "",
      stayAddress: input.stayAddress?.trim() ?? "",
    }
    : {
      address: input.address?.trim() ?? "",
      destination: "",
      stayName: "",
      stayAddress: "",
    };
}
export type InvitePreview = {
  communeName: string;
  role: "admin" | "member";
  expiresAt: string;
};
export type GoTarget =
  | ScreenId
  | WindowId
  | "login"
  | "signup"
  | "forgot"
  | "invite"
  | "onboard";
type GoOpts = {
  hub?: HubId;
  note?: string;
  operation?: string;
  date?: string;
  time?: string;
  expense?: string;
  /** A fund opens at its own address, over Funds. */
  fund?: string;
  template?: string;
  record?: { kind: "fund" | "recurring" | "member" | "template"; id: string };
};
export type SearchTarget = NonNullable<GoOpts["record"]> & { communeId: string };
type LiveData = {
  user: User;
  communes: Commune[];
  snapshots: Record<string, Snapshot>;
  invites: Record<string, PendingInvite[]>;
  reminderUsage: ReminderUsage | null;
  older: Record<string, OlderExpenses>;
};
/**
 * Expenses older than a commune's snapshot holds, fetched when someone asks
 * for earlier months, a statement, an export or a link to one. They are kept
 * when the snapshot is read again, and the snapshot's copy of an expense wins.
 */
type OlderExpenses = {
  /** The snapshot's window these continue. When it moves on, they are dropped. */
  since: string;
  /** Every expense created from this date (UTC) on is loaded; null once all are. */
  from: string | null;
  olderCount: number;
  olderVoidedCount: number;
  expenses: Record<string, Expense>;
};
/** How far back the open commune's expenses are loaded. */
export type ExpenseHistoryState = {
  /** Every expense created from this date (UTC) on is loaded. */
  loadedFrom: string | null;
  complete: boolean;
  /** Expenses older than what is loaded, and how many of them are voided. */
  olderCount: number;
  olderVoidedCount: number;
};
type AuthStatus = "loading" | "guest" | "authenticated" | "error";

export type AppState = {
  authStatus: AuthStatus;
  apiError: string | null;
  mutationPending: boolean;
  clearApiError: () => void;
  refresh: () => Promise<void>;
  signInWithPassword: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signUpWithPassword: (name: string, email: string, password: string) => Promise<"ready" | "verify">;
  verifyEmailCode: (email: string, code: string) => Promise<void>;
  session: Session | null;
  screen: ScreenId;
  hubId: HubId;
  hub: LiveHub;
  places: LiveHub[];
  snapshots: Record<string, Snapshot>;
  contentLoading: boolean;
  contentError: string | null;
  emptyHub: boolean;
  /** The address names a commune this account is not in, or no longer in. */
  unknownCommune: boolean;
  window: WindowId | null;
  moreOpen: boolean;
  navMode: NavMode;
  noteKey: string;
  notes: Record<string, LiveNote>;
  operationKey: string;
  operationDate: string;
  operationTime: string;
  operationsByHub: OperationStore;
  operations: OperationItem[];
  selectedOperation: OperationItem | null;
  /** The fund whose address is open, shown in a dialog on Funds. */
  fundKey: string;
  /** Whether the app is dark now: chosen, or following the device. */
  dark: boolean;
  theme: Theme;
  noticesOn: boolean;
  searchQuery: string;
  searchScope: string | null;
  searchTarget: SearchTarget | null;
  noteSearchQuery: string;
  invites: PendingInvite[];
  payMethods: PayMethod[];
  native: boolean;
  you: { id: string; name: string; email: string; initials: string; photo?: string };
  lastExpense: { name: string; amount: string; paidBy: string } | null;
  expenses: LiveExpenseRow[];
  selectedExpense: LiveExpenseRow | null;
  createdExpenses: LiveExpenseRow[];
  /** Kept for history. Never part of a balance, total or open count. */
  voidedExpenses: LiveExpenseRow[];
  /**
   * The open expense window's expense is older than what is loaded: it is
   * being fetched, or fetching it failed and can be tried again.
   */
  expenseRead: "loading" | "failed" | null;
  retryExpenseRead: () => void;
  expenseHistory: ExpenseHistoryState;
  /**
   * The month (UTC) to show settled expenses from, or voided ones, going back
   * from `before`: the latest earlier month that has one, loading older
   * expenses as needed. Null when there are none before it.
   */
  loadEarlierExpenses: (before: string, voided?: boolean) => Promise<string | null>;
  /** Loads every older expense, for a statement or an export, and returns the whole record. */
  loadFullHistory: () => Promise<Snapshot | null>;
  funds: Fund[];
  recurringBills: RecurringBill[];
  splitTemplates: SplitTemplate[];
  expenseTemplateId: string;
  reminderTargets: ReminderTarget[];
  reminderUsage: ReminderUsage | null;
  sentReminders: SentReminder[];
  /** Notices up on This Hub, newest first. */
  announcements: Announcement[];
  /** Admin only. requestId comes from the form so a retry cannot post twice. */
  postAnnouncement: (input: { title: string; body: string; needsAcknowledgement: boolean; requestId: string }) => Promise<AnnouncementResult>;
  acknowledgeAnnouncement: (id: string) => Promise<AnnouncementResult>;
  archiveAnnouncement: (id: string) => Promise<AnnouncementResult>;
  notifications: Notification[];
  /**
   * The name of anyone the open commune's records know, former members
   * included. left: name someone who has left as "Name (left)". fallback:
   * the words for someone the records do not know.
   */
  personName: (userId: string | null | undefined, fallback: string, options?: { left?: boolean }) => string;
  /**
   * Unread notices in each of the reader's communes, by commune id. Each
   * comes with the commune list, so the bell counts every commune.
   */
  noticeCounts: Record<string, number>;
  /** Unread notices from every commune the reader belongs to, for Notices. */
  loadUnreadNotices: () => Promise<UnreadNotice[]>;
  /** Clears this tab, then signs out. Never throws: see signOutUnconfirmed. */
  signOut: () => Promise<void>;
  /** The last sign-out cleared this tab but the server did not confirm it. */
  signOutUnconfirmed: boolean;
  retrySignOut: () => Promise<boolean>;
  /** Both keep this device signed in and end the account's other sessions. */
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  signOutOtherDevices: () => Promise<void>;
  /** Why this tab was sent back to sign-in, when it was not the person's choice. */
  sessionNotice: string | null;
  go: (target: GoTarget, opts?: GoOpts) => void;
  /** Back to the window's screen: the entry before it when that is where it opened. */
  closeWindow: () => void;
  /**
   * An open window reports whether it holds typed text, so Back can ask
   * before discarding it. Returns a function that stops the reporting.
   */
  watchTypedText: (hasTyped: () => boolean) => () => void;
  /** Back was pressed over typed text; the window waits for an answer. */
  leaveAsked: boolean;
  answerLeave: (discard: boolean) => void;
  setMoreOpen: (open: boolean) => void;
  setNavMode: (mode: NavMode) => void;
  setTheme: (theme: Theme) => void;
  setNoticesOn: (on: boolean) => void;
  setSearchQuery: (query: string) => void;
  setSearchScope: (id: string | null) => void;
  clearSearchTarget: () => void;
  setNoteSearchQuery: (query: string) => void;
  savePayMethod: (method: PayMethod) => boolean;
  setHubPhoto: (id: HubId, dataUrl: string | null) => void;
  setAvatar: (dataUrl: string | null) => void;
  /** requestId: one per open form, so a retried add returns the note it already added. */
  addNote: (card: NoteCard & { id: string }, requestId: string) => Promise<string>;
  /** expectedVersion: the version the edit started from. Defaults to the version on screen now. */
  updateNote: (card: NoteCard & { id: string; expectedVersion?: number }) => Promise<string>;
  loadNoteRevision: (noteId: string, revisionId: string) => Promise<NoteRevision>;
  /** requestId: one per open form, so a retried add returns what it already added. */
  addOperation: (item: NewOperation, requestId: string) => Promise<string>;
  /**
   * expectedVersion: the version the edit started from. Any change since, a
   * completion or handover included, makes the edit stale: it is refused and
   * the latest is loaded.
   */
  updateOperation: (id: string, item: NewOperation, expectedVersion?: number) => Promise<void>;
  /** Completes an open task, or reopens a done one. The server advances repeats and rotation. */
  toggleOperation: (id: string) => Promise<OperationChange>;
  skipOperation: (id: string, reason?: string) => Promise<OperationChange>;
  handOverOperation: (id: string, toMemberId: string, reason?: string) => Promise<OperationChange>;
  /** Restores the task to exactly how it was before that action. */
  undoOperation: (occurrenceId: string) => Promise<OperationChange>;
  removeOperation: (id: string) => Promise<void>;
  createHub: (input: CreatedHub, opts?: { openExpense?: boolean }) => Promise<string>;
  updateCommune: (input: {
    name: string; type: LiveHub["type"]; currency: CurrencyCode;
    address: string; destination: string; stayName: string; stayAddress: string;
  }) => Promise<void>;
  recordExpense: (input: CreateExpenseInput) => Promise<string>;
  confirmExpenseShare: (shareId: string) => Promise<void>;
  /** Payer or admin corrects an expense. A stale expectedVersion is a conflict. */
  correctExpense: (expenseId: string, input: CorrectExpenseInput) => Promise<ExpenseChangeResult>;
  /** Payer or admin voids an expense, keeping it and its history. */
  voidExpense: (expenseId: string, input: { expectedVersion: number; reason: string; requestId: string }) => Promise<ExpenseChangeResult>;
  /** Payer records money received against one share. Retry-safe on requestId. */
  recordShareReceipt: (shareId: string, input: { amountMinor: number; receivedOn: string; reference?: string; requestId: string }) => Promise<ReceiptResult>;
  /** Payer reverses one receipt with a reason. The original entry is kept. */
  reverseShareReceipt: (receiptId: string, reason: string) => Promise<ReceiptResult>;
  /** The member who owes says they have paid. A claim, not a receipt. */
  reportSharePayment: (shareId: string, input: { amountMinor: number; sentOn: string; reference?: string; requestId: string }) => Promise<PaymentReportResult>;
  withdrawPaymentReport: (reportId: string) => Promise<PaymentReportResult>;
  /** The bill payer confirms (records a receipt) or declines with a reason. */
  resolvePaymentReport: (reportId: string, input: { decision: "confirm"; requestId: string } | { decision: "decline"; note: string }) => Promise<PaymentReportResult>;
  markExpensePaid: (expenseId: string) => Promise<void>;
  createInvite: (email: string, role: "admin" | "member") => Promise<{ token: string; url: string }>;
  sendInviteEmail: (token: string) => Promise<void>;
  revokeInvite: (id: string) => Promise<void>;
  previewInvite: (token: string) => Promise<InvitePreview | null>;
  /** The address an invitation this account cannot see was sent to, masked, when it is another one. */
  inviteAddressHint: (token: string) => Promise<string | null>;
  acceptInvite: (token: string) => Promise<string>;
  /** requestId stays the same across retries of one open form. */
  createFund: (name: string, targetMinor: number | null, requestId: string) => Promise<string>;
  pledgeFund: (fundId: string, amountMinor: number, dueOn: string, requestId: string) => Promise<string>;
  recordFundContribution: (commitmentId: string, amountMinor: number, requestId: string) => Promise<string>;
  updateFund: (fundId: string, name: string, targetMinor: number | null) => Promise<void>;
  archiveFund: (fundId: string, archived: boolean) => Promise<void>;
  /**
   * expectedAmountMinor and expectedDueOn are what the editor opened with. If
   * the pledge has changed since, nothing is saved: a 409, after the fund reloads.
   */
  updatePledge: (commitmentId: string, input: PledgeChange) => Promise<void>;
  voidContribution: (contributionId: string, reason: string) => Promise<void>;
  saveRecurringBill: (input: RecurringBillInput) => Promise<string>;
  /** Pause or resume only; a repeat reports duplicate: true. */
  pauseRecurringBill: (id: string, paused: boolean) => Promise<RecurringBillState>;
  /** Archive (which also pauses) or restore, still paused. */
  archiveRecurringBill: (id: string, archived: boolean) => Promise<RecurringBillState>;
  recordRecurringBill: (id: string, expectedDueOn: string) => Promise<string>;
  /** Record one period as paid, optionally at a different amount. */
  recordRecurringPeriod: (id: string, expectedDueOn: string, amountMinor?: number) => Promise<RecurringPeriodResult>;
  /** Skip one period with a reason; nothing is charged for it. */
  skipRecurringPeriod: (id: string, expectedDueOn: string, reason: string) => Promise<RecurringPeriodResult>;
  saveSplitTemplate: (input: SplitTemplateInput) => Promise<string>;
  manageMember: (userId: string, action: "admin" | "member" | "leave" | "remove") => Promise<void>;
  /** requestId stays the same across retries so one decision sends once. */
  sendReminder: (kind: "nudge" | "chase", sourceId: string, requestId: string) => Promise<ReminderResult>;
  /** communeId: the notice's commune, when it is not the open one. */
  markNotificationRead: (id: string, communeId?: string) => Promise<void>;
  pageTitle: string;
  pageLede: string;
};

const Ctx = createContext<AppState | null>(null);

function endedNotice(unsaved: boolean): string {
  return unsaved
    ? "You were signed out, so your last change wasn’t saved. Sign in to try again."
    : "You were signed out. Sign in to carry on.";
}

// Commands that failed. A screen or form that catches one shows the error
// itself; only one that nothing caught reaches the alert strip.
const commandFailures = new WeakSet<object>();

// Whether the device is set to dark, followed while the theme is "system".
function usePrefersDark(): boolean {
  const query = () => typeof window.matchMedia === "function" ? window.matchMedia("(prefers-color-scheme: dark)") : null;
  const [dark, setDark] = useState(() => query()?.matches === true);
  useEffect(() => {
    const media = query();
    if (!media) return;
    const update = () => setDark(media.matches);
    update();
    media.addEventListener?.("change", update);
    return () => media.removeEventListener?.("change", update);
  }, []);
  return dark;
}

function emptyHub(): LiveHub {
  return {
    id: "",
    currency: "GBP",
    role: "member",
    name: "Your commune",
    type: "Household",
    lede: "",
    people: "",
    photo: "",
    switchMeta: "No commune yet",
    status: "No expenses yet",
    youMeta: "",
    avatars: [],
    oweLabel: "You’re even",
    oweAmount: money(0, "GBP"),
    oweCopy: "No shared expenses yet.",
    oweCta: "Add expense",
    credit: false,
    kpis: [],
    now: [],
    waiting: [],
    moves: [],
    members: [],
    activity: [],
    notes: [],
    jumps: [],
  };
}

function addressAt(url: string) {
  const at = url.indexOf("?");
  return at < 0 ? readAddress(url) : readAddress(url.slice(0, at), url.slice(at + 1));
}

function authPath(target: GoTarget): string {
  if (target === "login") return "/login";
  if (target === "signup") return "/signup";
  if (target === "forgot") return "/forgot-password";
  if (target === "invite") return "/invite";
  if (target === "onboard") return "/onboard";
  return "/";
}

function operationFromApi(item: OperationItem, communeId: string): OperationItem {
  return {
    ...item,
    hubId: communeId,
    // Postgres returns a time column as HH:MM:SS; the app and API use HH:MM.
    time: item.time ? item.time.slice(0, 5) : undefined,
    assignee: item.assignee ?? undefined,
    rotation: item.rotation ?? undefined,
    assigneeId: item.assigneeId ?? null,
    rotationIds: item.rotationIds?.length ? item.rotationIds : null,
    turnOwnerId: item.turnOwnerId ?? null,
    turnOwner: item.turnOwner ?? null,
    lastDone: item.lastDone ?? undefined,
  };
}

function operationPayload(item: NewOperation | OperationItem) {
  return {
    kind: item.kind,
    category: item.category,
    title: item.title,
    date: item.date,
    time: item.time ?? null,
    allDay: item.allDay,
    // People are sent by member id; the server copies the names.
    assigneeId: item.kind === "task" ? item.assigneeId ?? null : null,
    rotationIds: item.kind === "task" && item.rotationIds?.length ? item.rotationIds : null,
    // No status or completion: only task actions change those.
    repeat: item.repeat,
    notes: item.notes,
  };
}

// The older expenses kept for this snapshot's window, if any.
function olderFor(snapshot: Snapshot, older: OlderExpenses | undefined): OlderExpenses | undefined {
  return older && older.since === snapshot.expenseHistory?.since ? older : undefined;
}

function historyState(snapshot: Snapshot | undefined, older: OlderExpenses | undefined): ExpenseHistoryState {
  const history = snapshot?.expenseHistory;
  // A snapshot that does not say holds every expense.
  if (!snapshot || !history) return { loadedFrom: null, complete: true, olderCount: 0, olderVoidedCount: 0 };
  const kept = olderFor(snapshot, older);
  return kept
    ? { loadedFrom: kept.from, complete: kept.from === null || kept.olderCount === 0, olderCount: kept.olderCount, olderVoidedCount: kept.olderVoidedCount }
    : { loadedFrom: history.since, complete: history.olderCount === 0, olderCount: history.olderCount, olderVoidedCount: history.olderVoidedCount };
}

// The snapshot's expenses and the older ones fetched for it, newest first as
// the database orders them. The snapshot's copy of an expense is the latest.
function withOlderExpenses(snapshot: Snapshot, older: OlderExpenses | undefined): Snapshot {
  const kept = olderFor(snapshot, older);
  if (!kept) return snapshot;
  const held = new Set(snapshot.expenses.map((expense) => expense.id));
  const extra = Object.values(kept.expenses).filter((expense) => !held.has(expense.id));
  if (!extra.length) return snapshot;
  return { ...snapshot, expenses: [...snapshot.expenses, ...extra].sort((a, b) =>
    (Date.parse(b.createdAt ?? "") || 0) - (Date.parse(a.createdAt ?? "") || 0) || b.id.localeCompare(a.id)) };
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [path, setLocation] = useLocation();
  const search = useSearch();
  // Back and Forward belong to the browser's history; tests use a memory location.
  const browserHistory = useRouter().hook === useBrowserLocation;
  const url = search ? `${path}?${search}` : path;
  const [authStatus, setAuthStatus] = useState<AuthStatus>("loading");
  const [apiError, setApiError] = useState<string | null>(null);
  const [signOutUnconfirmed, setSignOutUnconfirmed] = useState(false);
  const [sessionNotice, setSessionNotice] = useState<string | null>(null);
  const [mutationCount, setMutationCount] = useState(0);
  const [data, setData] = useState<LiveData | null>(null);
  const dataRef = useRef<LiveData | null>(null);
  const publishData = useCallback((next: LiveData | null) => {
    dataRef.current = next;
    setData(next);
  }, []);
  const [prefs, setPrefs] = useState<AccountPrefs>(DEFAULT_ACCOUNT);
  const [device, setDevice] = useState<DevicePrefs>(() => readDevicePrefs() ?? DEFAULT_DEVICE);
  const prefersDark = usePrefersDark();
  const [hubId, setHubId] = useState<HubId>("");
  const [snapshotErrors, setSnapshotErrors] = useState<Record<string, string>>({});
  const [moreOpen, setMoreOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchScope, setSearchScope] = useState<string | null>(null);
  const [searchTarget, setSearchTarget] = useState<SearchTarget | null>(null);
  const clearSearchTarget = useCallback(() => setSearchTarget(null), []);
  const [noteSearchQuery, setNoteSearchQuery] = useState("");
  const loadedRef = useRef(false);
  const refreshSequence = useRef(0);
  const refreshing = useRef(false);
  // An action was refused for want of a session; the check that follows says
  // it was not saved if the tab is then signed out.
  const refusedAction = useRef(false);
  const lastRefreshAt = useRef(0);
  // Someone used this tab (pointer, keys, touch). The minute check stops
  // after ten quiet minutes and starts again with the next use.
  const lastActivityAt = useRef(Date.now());
  const snapshotReads = useRef(new Map<string, Promise<void>>());
  const snapshotRevisions = useRef(new Map<string, number>());
  const olderReads = useRef(new Map<string, Promise<void>>());
  // Linked expenses being fetched, and the ones that were refused or failed,
  // by account, commune and expense.
  const recordReads = useRef(new Set<string>());
  const [recordResults, setRecordResults] = useState<Partial<Record<string, "missing" | "failed">>>({});

  // Navigations this tab makes itself. Any other change of address is the
  // browser's: Back, Forward or an address typed in.
  const navigating = useRef(false);
  const typedText = useRef<(() => boolean) | null>(null);
  // Back over typed text in a window keeps the window at its address until
  // the person says whether to discard what they typed.
  const [heldUrl, setHeldUrl] = useState<string | null>(null);
  const [leaveAsked, setLeaveAsked] = useState(false);
  const [seen, setSeen] = useState(url);
  if (seen !== url) {
    setSeen(url);
    const before = addressAt(seen);
    const after = readAddress(path, search);
    const closing = Boolean(before.window) && (before.window !== after.window || before.record !== after.record);
    if (!navigating.current && closing && after.screen && data && typedText.current?.()) setHeldUrl(seen);
    else if (heldUrl === url) setHeldUrl(null);
  }
  const shown = heldUrl ? addressAt(heldUrl) : readAddress(path, search);
  const screen: ScreenId = shown.screen ?? "home";
  const urlRef = useRef(url);
  urlRef.current = url;
  const shownRef = useRef(shown);
  shownRef.current = shown;
  // A screen for one commune names it in its address. Other screens show the
  // commune this tab showed last.
  const urlCommune = shown.screen && COMMUNE_SCREENS.has(shown.screen) ? shown.commune : "";
  const unknownCommune = Boolean(urlCommune) && Boolean(data) && !data!.communes.some((commune) => commune.id === urlCommune);
  const chosenId = urlCommune && !unknownCommune ? urlCommune : hubId;
  const activeRef = useRef("");
  const overview = screen === "home" || screen === "home-empty" || screen === "home-inbox" || screen === "communes" || screen === "home-activity";
  const viewRef = useRef({ hubId: chosenId, overview });
  viewRef.current = { hubId: chosenId, overview };
  const native = isNativeNow();

  useEffect(() => { navigating.current = false; }, [url]);
  // Back went past a window with typed text: put the window back and ask.
  useEffect(() => {
    if (!heldUrl || heldUrl === url) return;
    navigating.current = true;
    setLocation(heldUrl, { state: { communeBack: url } });
    setLeaveAsked(true);
  }, [heldUrl, url, setLocation]);

  // Opening something adds an entry to the history; leaving a window returns
  // to the entry before it when that is where it opened, so Back never goes
  // to a window already closed. A replaced entry keeps where it opened from.
  const navigate = useCallback((to: string, how: { returning?: boolean; fallback?: "push" | "replace" } = {}) => {
    const target = keepSearch(to);
    const here = urlRef.current;
    if (target === here) return;
    navigating.current = true;
    const entry: unknown = browserHistory ? window.history.state : null;
    const back = entry && typeof entry === "object" && typeof (entry as { communeBack?: unknown }).communeBack === "string"
      ? (entry as { communeBack: string }).communeBack : null;
    // Where this tab is going, before the address shows it.
    urlRef.current = target;
    if (how.returning && back === target) {
      window.history.back();
      return;
    }
    if (how.fallback === "replace") setLocation(target, { replace: true, state: back ? { communeBack: back } : null });
    else setLocation(target, { state: { communeBack: here } });
  }, [browserHistory, setLocation]);
  // A window, or a fund's dialog, closes to the screen it is over.
  const leaveRecord = useCallback(() => {
    const here = shownRef.current;
    if (!here.screen || (!here.window && !here.record)) return;
    navigate(addressOf(here.screen, { commune: here.commune || activeRef.current }), { returning: true, fallback: "replace" });
  }, [navigate]);
  const watchTypedText = useCallback((hasTyped: () => boolean) => {
    typedText.current = hasTyped;
    return () => { if (typedText.current === hasTyped) typedText.current = null; };
  }, []);
  const answerLeave = useCallback((discard: boolean) => {
    setLeaveAsked(false);
    if (!discard) return;
    // Carry on to where Back was going.
    if (!browserHistory) return leaveRecord();
    navigating.current = true;
    window.history.back();
  }, [browserHistory, leaveRecord]);

  const readSnapshot = useCallback((commune: Commune, sequence: number, force = false, detail?: "summary"): Promise<void> => {
    const current = dataRef.current;
    if (!current || sequence !== refreshSequence.current) return Promise.resolve();
    const cacheKey = `${current.user.id}:${commune.id}`;
    const revision = snapshotRevisions.current.get(cacheKey) ?? 0;
    const key = `${sequence}:${commune.id}:${revision}:${detail ?? "full"}`;
    const pending = snapshotReads.current.get(key);
    if (pending) return pending;
    // The list's change mark says whether anything changed since the copy held
    // here was read. A summary will do only where one was asked for.
    const held = current.snapshots[commune.id];
    if (!force && held && held.changeMark === commune.changeMark && (detail === "summary" || held.detail !== "summary")) {
      return Promise.resolve();
    }
    setSnapshotErrors((errors) => {
      const next = { ...errors };
      delete next[commune.id];
      return next;
    });
    const request = (detail ? loadSnapshot(commune, detail) : loadSnapshot(commune)).then((snapshot) => {
      if (sequence !== refreshSequence.current || dataRef.current?.user.id !== current.user.id || revision !== (snapshotRevisions.current.get(cacheKey) ?? 0)) return;
      if (snapshot.commune.id !== commune.id) throw new ApiError("Commune response did not match the request", 502);
      // A summary never replaces the open commune's record; its full read is under way.
      if (snapshot.detail === "summary" && viewRef.current.hubId === commune.id && dataRef.current.snapshots[commune.id]) return;
      publishData({ ...dataRef.current, snapshots: { ...dataRef.current.snapshots, [commune.id]: snapshot } });
    }).catch((error: unknown) => {
      if (sequence !== refreshSequence.current || dataRef.current?.user.id !== current.user.id || revision !== (snapshotRevisions.current.get(cacheKey) ?? 0)) return;
      setSnapshotErrors((errors) => ({ ...errors, [commune.id]: error instanceof Error ? error.message : "Activity unavailable" }));
      // A permission failure is not a transient offline state: do not retain
      // cached private activity after the server has rejected access.
      if (error instanceof ApiError && [401, 403, 404].includes(error.status)) {
        const snapshots = { ...dataRef.current.snapshots };
        delete snapshots[commune.id];
        publishData({ ...dataRef.current, snapshots });
      }
    }).finally(() => snapshotReads.current.delete(key));
    snapshotReads.current.set(key, request);
    return request;
  }, [publishData]);

  const loadVisibleSnapshots = useCallback(async (sequence: number, force = false) => {
    const current = dataRef.current;
    if (!current || sequence !== refreshSequence.current) return;
    const active = current.communes.find((item) => item.id === viewRef.current.hubId)
      ?? current.communes.find((item) => item.id === readAccountPrefs(current.user.id)?.activeHubId)
      ?? current.communes[0];
    if (!active) return;
    await readSnapshot(active, sequence, force);
    // Overview cards appear immediately from verified membership metadata.
    // Fill the remaining cards progressively, from summaries, instead of
    // bursting N full commune reads into the selected page's critical path.
    for (const commune of current.communes) {
      if (sequence !== refreshSequence.current || !viewRef.current.overview) return;
      if (commune.id !== active.id) await readSnapshot(commune, sequence, force, "summary");
    }
  }, [readSnapshot]);

  // Show nothing of the account this tab was showing, and forget what this
  // browser kept for it. Used for sign-out, an expired or refused session,
  // and a sign-in as someone else in another tab.
  const forgetSession = useCallback((notice: string | null = null) => {
    const userId = dataRef.current?.user.id;
    ++refreshSequence.current;
    refreshing.current = false;
    publishData(null);
    setViewer(null);
    setSnapshotErrors({});
    snapshotRevisions.current.clear();
    setHubId("");
    // Device preferences stay; the account's go with it.
    setPrefs(DEFAULT_ACCOUNT);
    if (userId) forgetAccountPrefs(userId);
    setSessionNotice(notice);
    setAuthStatus("guest");
    loadedRef.current = true;
  }, [publishData]);

  // A full refresh (start-up, a sign-in, Try again, a membership change made
  // here) asks who is signed in and reads everything on screen again. A check
  // reads the commune list, whose change marks say which communes changed, and
  // reads only those again, with their invitations and the reminder counts.
  // Coming back to the tab, a check also asks who is signed in.
  // announce: whether a sign-in this finds may be told to the other tabs.
  // Only a load this tab started itself may tell them (see the listener).
  const load = useCallback(async (announce: boolean, check?: { session: boolean }) => {
    const sequence = ++refreshSequence.current;
    const shownBefore = currentViewer();
    refreshing.current = true;
    setApiError(null);
    // One retry budget for startup reads only, never for commands or access errors.
    let retried = false;
    async function startupRead<T>(read: () => Promise<T>): Promise<T> {
      try { return await read(); }
      catch (error) {
        if (loadedRef.current || retried || !navigator.onLine || !isConnectionFailure(error)) throw error;
        retried = true;
        await new Promise((resolve) => setTimeout(resolve, 350));
        if (sequence !== refreshSequence.current) throw error;
        return read();
      }
    }
    try {
      let user = check && !check.session ? dataRef.current?.user ?? null : null;
      if (!user) {
        const result = await startupRead(() => api<{ user: User | null }>("/auth/me"));
        if (sequence !== refreshSequence.current) return;
        const shown = currentViewer();
        if (!result.user || (shown && shown !== result.user.id)) {
          // Signed out, or signed in as someone else in another tab: never
          // switch this screen to another person's data without a sign-in.
          forgetSession(shown ? endedNotice(refusedAction.current) : null);
          refusedAction.current = false;
          setApiError(null);
          return;
        }
        refusedAction.current = false;
        setViewer(result.user.id);
        // A tab that showed no one now shows this account: a sign-in, however
        // it happened (password, code, or the return from Google), or a new
        // tab opening. Tell the other tabs.
        if (announce && !shown) announceSession(result.user.id);
        setSignOutUnconfirmed(false);
        setSessionNotice(null);
        user = result.user;
      }
      const viewer = user;
      adoptTabPrefs(viewer.id);
      const { communes } = await startupRead(() => loadCommunes(viewer));
      if (sequence !== refreshSequence.current) return;
      const previous = dataRef.current?.user.id === viewer.id ? dataRef.current : null;
      if (!previous) {
        setSnapshotErrors({});
        snapshotRevisions.current.clear();
      }
      // A commune changed if its mark moved, your role in it changed or you just joined it.
      const seen = new Map((previous?.communes ?? []).map((commune) => [commune.id, commune]));
      const changed = communes.filter((commune) => seen.get(commune.id)?.changeMark !== commune.changeMark ||
        seen.get(commune.id)?.role !== commune.role);
      const listed = (id: string) => communes.some((commune) => commune.id === id);
      const admins = communes.filter((commune) => commune.role === "admin");
      const invites = Object.fromEntries(Object.entries(previous?.invites ?? {})
        .filter(([id]) => admins.some((commune) => commune.id === id)));
      // Identity and membership are ready. Keep existing content on refresh;
      // missing snapshots render a loading state, never a false empty ledger.
      publishData({
        user: viewer, communes,
        snapshots: Object.fromEntries(communes.filter((commune) => previous?.snapshots[commune.id])
          .map((commune) => [commune.id, previous!.snapshots[commune.id]])),
        invites, reminderUsage: previous?.reminderUsage ?? null,
        older: Object.fromEntries(Object.entries(previous?.older ?? {}).filter(([id]) => listed(id))),
      });
      setAuthStatus("authenticated");
      setHubId((current) => communes.some((commune) => commune.id === current)
        ? current : communes.find((commune) => commune.id === readAccountPrefs(viewer.id)?.activeHubId)?.id ?? communes[0]?.id ?? "");
      if (!previous) {
        setPrefs(readAccountPrefs(viewer.id) ?? DEFAULT_ACCOUNT);
        setDevice((shown) => readDevicePrefs() ?? shown);
      }
      loadedRef.current = true;
      // Counts and invitations must not delay the commune itself. A check
      // reads the counts when something changed or a reminder slot has opened.
      const usage = previous?.reminderUsage;
      if (!check || changed.length || communes.length !== seen.size || !usage ||
          (usage.nextSlotAt && Date.parse(usage.nextSlotAt) <= Date.now())) {
        void (
          // A pending database rollout must not make the rest of the app unusable.
          // The send RPC still enforces limits even if this display is unavailable.
          api<ReminderUsage>("/reminders/usage").catch((error: unknown) => {
            console.warn("Reminder usage could not be loaded", error instanceof Error ? error.message : "unknown error");
            return null;
          })
        ).then((reminderUsage) => {
          if (sequence !== refreshSequence.current || !dataRef.current) return;
          publishData({ ...dataRef.current, reminderUsage });
        });
      }
      // An invitation sent, accepted or withdrawn moves its commune's mark.
      const inviteReads = admins.filter((commune) => !check || changed.includes(commune) || !invites[commune.id]);
      if (inviteReads.length) {
        void Promise.all(inviteReads.map(async (commune) => {
          const result = await api<{ invites: InviteRecord[] }>(`/communes/${encodeURIComponent(commune.id)}/invites`);
          return [commune.id, result.invites.map((invite) => ({
              id: invite.id, email: invite.email ?? null,
              role: invite.role === "admin" ? "Admin" as const : "Member" as const,
              status: inviteStatus(invite), createdAt: invite.createdAt, expiresAt: invite.expiresAt,
              acceptedAt: invite.acceptedAt, revokedAt: invite.revokedAt,
              invitedBy: invite.invitedBy ?? null, invitedByName: invite.invitedByName ?? null,
              acceptedBy: invite.acceptedBy ?? null,
            }))] as const;
        })).then((inviteEntries) => {
          if (sequence !== refreshSequence.current || !dataRef.current) return;
          publishData({ ...dataRef.current, invites: { ...dataRef.current.invites, ...Object.fromEntries(inviteEntries) } });
        }).catch((error: unknown) => {
          if (sequence === refreshSequence.current) setApiError(error instanceof Error ? error.message : "Could not refresh invitations");
        });
      }
      await loadVisibleSnapshots(sequence, !check);
      if (sequence !== refreshSequence.current) return;
      lastRefreshAt.current = Date.now();
    } catch (error) {
      if (sequence !== refreshSequence.current) return;
      if (error instanceof ApiError && error.status === 401) {
        // The server refused the session. That is being signed out, not a
        // connection problem.
        forgetSession(shownBefore ? endedNotice(refusedAction.current)
          : "Commune couldn’t confirm your sign-in. Please sign in again.");
        refusedAction.current = false;
        setApiError(null);
        return;
      }
      setApiError(error instanceof Error ? error.message : "Could not connect to Commune");
      if (!loadedRef.current) setAuthStatus("error");
    } finally {
      if (sequence === refreshSequence.current) refreshing.current = false;
    }
  }, [forgetSession, loadVisibleSnapshots, publishData]);
  const refresh = useCallback((check?: { session: boolean }) => load(true, check), [load]);

  // Another tab signed in or out. A tab showing an account that is no longer
  // the signed-in one forgets it (its screens then ask for a sign-in); a
  // signed-out tab picks up a new sign-in. Neither tells anyone: a load
  // started here never announces, so one message can never lead to another,
  // even when the session is refused and every tab goes back to signed out.
  useEffect(() => onOtherTabSession((userId) => {
    const shown = dataRef.current?.user.id ?? null;
    if (userId === shown) return;
    if (shown) forgetSession("You signed out or changed account in another tab.");
    else if (userId) void load(false);
  }), [forgetSession, load]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (authStatus === "authenticated") void loadVisibleSnapshots(refreshSequence.current);
  }, [authStatus, hubId, overview, loadVisibleSnapshots]);

  // Once a minute, while the tab is visible and someone has used it in the
  // last ten minutes, check the commune list for changes. Coming back to the
  // tab checks at once and asks who is signed in; using it again after a
  // quiet spell checks at once.
  useEffect(() => {
    if (authStatus !== "authenticated") return;
    const quiet = () => Date.now() - lastActivityAt.current >= 10 * 60_000;
    const due = (gap: number) => !refreshing.current && Date.now() - lastRefreshAt.current > gap;
    const onFocus = () => {
      if (document.visibilityState !== "visible") return;
      lastActivityAt.current = Date.now();
      if (due(15_000)) void refresh({ session: true });
    };
    const onActivity = () => {
      const returning = quiet();
      lastActivityAt.current = Date.now();
      if (returning && document.visibilityState === "visible" && due(60_000)) void refresh({ session: false });
    };
    const onMinute = () => {
      if (document.visibilityState === "visible" && !quiet() && due(15_000)) void refresh({ session: false });
    };
    const activity = ["pointerdown", "pointermove", "keydown", "touchstart", "wheel"];
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    for (const name of activity) window.addEventListener(name, onActivity, { capture: true, passive: true });
    const timer = window.setInterval(onMinute, 60_000);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
      for (const name of activity) window.removeEventListener(name, onActivity, { capture: true });
      window.clearInterval(timer);
    };
  }, [authStatus, refresh]);
  // Screens only ever ask for a full refresh, even when they pass refresh as a handler.
  const fullRefresh = useCallback(() => refresh(), [refresh]);

  const mutate = useCallback(async <T,>(action: () => Promise<T>): Promise<T> => {
    setMutationCount(count => count + 1);
    try {
      setApiError(null);
      return await action();
    } catch (error) {
      if (typeof error === "object" && error !== null) commandFailures.add(error);
      // Signed out or changed account elsewhere: check which, and clear this
      // tab if it no longer matches.
      if (error instanceof ApiError && error.status === 401 && dataRef.current) {
        refusedAction.current = true;
        void refresh();
      }
      throw error;
    } finally {
      setMutationCount(count => Math.max(0, count - 1));
    }
  }, [refresh]);
  // A failed command that no screen caught still shows, in the alert strip.
  useEffect(() => {
    const onUnhandled = (event: PromiseRejectionEvent) => {
      const reason: unknown = event.reason;
      if (typeof reason !== "object" || reason === null || !commandFailures.has(reason)) return;
      event.preventDefault();
      setApiError(reason instanceof Error ? reason.message : "The action could not be saved");
    };
    window.addEventListener("unhandledrejection", onUnhandled);
    return () => window.removeEventListener("unhandledrejection", onUnhandled);
  }, []);

  // Each change starts from what the browser keeps, which another tab may
  // have changed since. A full or blocked store keeps it for this visit only.
  const savePrefs = useCallback((patch: Partial<AccountPrefs>) => {
    // An effect or handler still holding the account can run after it signed
    // out, or after someone else signed in here: it keeps nothing.
    if (!data || dataRef.current?.user.id !== data.user.id) return;
    const next = { ...(readAccountPrefs(data.user.id) ?? prefs), ...patch };
    if (!saveAccountPrefs(data.user.id, next)) {
      console.warn("This browser could not keep a Commune preference");
    }
    setPrefs(next);
  }, [data, prefs]);
  const saveDevice = useCallback((patch: Partial<DevicePrefs>) => {
    const next = { ...(readDevicePrefs() ?? device), ...patch };
    if (!saveDevicePrefs(next)) console.warn("This browser could not keep a Commune preference");
    setDevice(next);
  }, [device]);
  // A change made in another tab shows here too.
  const viewerId = data?.user.id;
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === null || event.key === DEVICE_KEY) setDevice(readDevicePrefs() ?? DEFAULT_DEVICE);
      if (viewerId && (event.key === null || event.key === accountKey(viewerId))) setPrefs(readAccountPrefs(viewerId) ?? DEFAULT_ACCOUNT);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [viewerId]);

  // A sign-in ends in a refresh, which tells the other tabs. For Google it is
  // the one that runs when the page comes back from Google.
  const signInWithPassword = useCallback((email: string, password: string) => mutate(async () => {
    await post("/auth/login", { email, password });
    await refresh();
  }), [mutate, refresh]);
  const signInWithGoogle = useCallback(() => mutate(async () => {
    await post("/auth/google", {});
  }), [mutate]);
  const signUpWithPassword = useCallback((name: string, email: string, password: string) => mutate(async () => {
    const result = await post<{ verificationRequired?: boolean }>("/auth/signup", { name, email, password });
    if (result.verificationRequired) return "verify" as const;
    await refresh();
    return "ready" as const;
  }), [mutate, refresh]);
  const verifyEmailCode = useCallback((email: string, code: string) => mutate(async () => {
    await post("/auth/verify-email", { email, code });
    await refresh();
  }), [mutate, refresh]);
  const confirmSignOut = useCallback(async () => {
    try {
      await post("/auth/logout", {});
      setSignOutUnconfirmed(false);
      return true;
    } catch {
      setSignOutUnconfirmed(true);
      return false;
    }
  }, []);
  // This tab and the other tabs forget the account first, whatever the
  // server says. If it does not confirm, the sign-in page says so and offers
  // to try again, so no one leaves a shared device thinking they are out.
  const signOut = useCallback(async () => {
    forgetSession();
    setApiError(null);
    announceSession(null);
    navigate("/login");
    await confirmSignOut();
  }, [confirmSignOut, forgetSession, navigate]);
  const changePassword = useCallback((currentPassword: string, newPassword: string) => mutate(async () => {
    await post("/auth/change-password", { currentPassword, newPassword });
  }), [mutate]);
  const signOutOtherDevices = useCallback(() => mutate(async () => {
    await post("/auth/logout-others", {});
  }), [mutate]);

  const session: Session | null = data ? {
    userId: data.user.id,
    name: data.user.name,
    email: data.user.email,
    emailVerified: data.user.emailVerified === true,
    hasHubs: data.communes.length > 0,
    emptyLedger: data.communes.every((commune) => (data.snapshots[commune.id]?.expenses.length ?? 0) +
      (data.snapshots[commune.id]?.expenseHistory?.olderCount ?? 0) === 0),
    seed: "new",
    hubPhotos: prefs.hubPhotos,
    avatar: prefs.avatar,
  } : null;
  const places: LiveHub[] = data ? data.communes.map((commune) => {
    const snapshot = data.snapshots[commune.id];
    if (snapshot) return { ...hubFromSnapshot(snapshot, data.user, prefs.hubPhotos[commune.id]), activityState: "ready" as const };
    // Render the known identity in the switcher while its content is loading.
    return { ...emptyHub(), ...commune,
      type: commune.kind === "trip" ? "Trip" : commune.kind === "workspace" ? "Workspace" : "Household",
      photo: prefs.hubPhotos[commune.id] ?? "",
      activityState: snapshotErrors[commune.id] ? "error" : "loading",
      status: snapshotErrors[commune.id] ? "Activity unavailable · Open to retry" : "Loading shared activity…",
      switchMeta: `${commune.kind === "trip" ? "Trip" : commune.kind === "workspace" ? "Workspace" : "Household"}${commune.memberCount == null ? "" : ` · ${commune.memberCount} ${commune.memberCount === 1 ? "person" : "people"}`}`,
      youMeta: `${commune.role === "admin" ? "Admin" : "Member"} · ${commune.name}`,
    };
  }) : [];
  const hub = places.find((place) => place.id === chosenId) ?? places[0] ?? emptyHub();
  const activeId = hub.id;
  activeRef.current = activeId;
  // The open window and the record it shows come from the address.
  const windowId = unknownCommune ? null : shown.window;
  const recordId = unknownCommune ? "" : shown.record;
  const selectedExpenseId = windowId === "expense" || windowId === "expense-paid" || windowId === "pay" ? recordId : "";
  const noteKey = windowId === "note" || windowId === "note-edit" ? recordId : "";
  const operationKey = windowId === "operation" || windowId === "operation-edit" ? recordId : "";
  const fundKey = screen === "funds" ? recordId : "";
  const expenseTemplateId = windowId === "add-expense" ? shown.params.get("template") ?? "" : "";
  const askedDate = windowId === "operation-new" ? shown.params.get("date") ?? "" : "";
  const askedTime = windowId === "operation-new" ? shown.params.get("time") ?? "" : "";
  const operationDate = /^\d{4}-\d{2}-\d{2}$/.test(askedDate) ? askedDate : todayIso();
  const operationTime = /^\d{2}:\d{2}$/.test(askedTime) ? askedTime : "";
  const held = data?.snapshots[activeId];
  // The open commune's own screens never show a summary; they wait for its record.
  const snapshot = held?.detail === "summary" ? undefined : held;
  const older = data?.older[activeId];
  const expenseHistory = historyState(snapshot, older);
  const contentLoading = !!data?.communes.length && !overview && !snapshot;
  const contentError = snapshotErrors[activeId] ?? null;
  const allExpenses = snapshot && data ? expenseRows(withOlderExpenses(snapshot, older), data.user.id) : [];
  const expenses = allExpenses.filter((row) => !row.voidedAt);
  const voidedExpenses = allExpenses.filter((row) => row.voidedAt);
  const selectedExpense = selectedExpenseId ? allExpenses.find((row) => row.id === selectedExpenseId) ?? null : expenses[0] ?? null;
  const lastExpense = selectedExpense
    ? { name: selectedExpense.name, amount: selectedExpense.amount, paidBy: selectedExpense.paidBy }
    : null;
  // A commune whose only expenses are voided, or older than the snapshot
  // holds, still has a ledger to show.
  const empty = !!session?.hasHubs && allExpenses.length === 0 && !snapshot?.expenseHistory?.olderCount;
  const selectedLoaded = !selectedExpenseId || allExpenses.some((row) => row.id === selectedExpenseId);
  const recordKey = `${data?.user.id ?? ""}:${activeId}:${selectedExpenseId}`;
  const recordResult = recordResults[recordKey];
  // Until it is fetched, a linked expense older than what is loaded is on its way.
  const expenseRead = (windowId === "expense" || windowId === "expense-paid") && !selectedLoaded &&
    snapshot?.expenseHistory && recordResult !== "missing" ? recordResult ?? "loading" : null;
  const notes: Record<string, LiveNote> = Object.fromEntries(
    (snapshot?.notes ?? []).map((note) => [note.id, note]),
  );
  const operationsByHub: OperationStore = Object.fromEntries((data?.communes ?? []).map((commune) => [
    commune.id,
    (data?.snapshots[commune.id]?.operations ?? []).map((item) => operationFromApi(item, commune.id)),
  ]));
  const operations = operationsByHub[activeId] ?? [];
  const selectedOperation = operations.find((item) => item.id === operationKey) ?? null;
  const funds: Fund[] = (snapshot?.funds ?? []).map((fund) => ({
    ...fund,
    contributedMinor: fund.commitments.reduce((sum, commitment) => sum + commitment.contributedMinor, 0),
  }));
  const recurringBills = snapshot?.recurringBills ?? [];
  const splitTemplates = snapshot?.splitTemplates ?? [];
  const reminderTargets = snapshot?.reminderTargets ?? [];
  const reminderUsage = data?.reminderUsage ?? null;
  const sentReminders = snapshot?.sentReminders ?? [];
  const announcements = snapshot?.announcements ?? [];
  const notifications = snapshot?.notifications ?? [];
  // The open commune's count is the snapshot's own until the database sends
  // counts (0039); every refresh of a commune brings its count up to date.
  const noticeCounts: Record<string, number> = Object.fromEntries((data?.communes ?? []).map((commune) => [commune.id,
    commune.unreadNotices ?? (commune.id === activeId ? notifications.filter((notice) => !notice.readAt).length : 0)]));
  const you = {
    id: data?.user.id ?? "",
    name: data?.user.name ?? "",
    email: data?.user.email ?? "",
    initials: data ? initialsOf(data.user.name) : "",
    photo: prefs.avatar,
  };

  // A normal mutation does not need another sign-in/list/invitations waterfall.
  // Refresh just its commune, and keep confirmed content visible throughout.
  // Usually the open one; reading a notice from another commune refreshes that.
  const refreshCommune = useCallback(async (communeId: string) => {
    const current = dataRef.current;
    const commune = current?.communes.find(item => item.id === communeId);
    if (!current || !commune) return;
    const cacheKey = `${current.user.id}:${communeId}`;
    const revision = (snapshotRevisions.current.get(cacheKey) ?? 0) + 1;
    snapshotRevisions.current.set(cacheKey, revision);
    const sequence = refreshSequence.current;
    const stillCurrent = () => sequence === refreshSequence.current &&
      dataRef.current?.user.id === current.user.id && snapshotRevisions.current.get(cacheKey) === revision;
    try {
      const snapshot = await loadSnapshot(commune);
      const latest = dataRef.current;
      if (!stillCurrent() || !latest || !latest.communes.some(item => item.id === communeId)) return;
      if (snapshot.commune.id !== communeId) throw new ApiError("Commune response did not match the request", 502);
      publishData({ ...latest, communes: latest.communes.map(item => item.id === communeId ? { ...item, ...snapshot.commune } : item), snapshots: { ...latest.snapshots, [communeId]: snapshot } });
      setSnapshotErrors(errors => { const next = { ...errors }; delete next[communeId]; return next; });
    } catch (error) {
      const latest = dataRef.current;
      if (!stillCurrent() || !latest) return;
      setSnapshotErrors(errors => ({ ...errors, [communeId]: error instanceof Error ? error.message : "Could not refresh saved activity" }));
      if (error instanceof ApiError && [401, 403, 404].includes(error.status)) {
        const snapshots = { ...latest.snapshots };
        delete snapshots[communeId];
        publishData({ ...latest, snapshots });
      }
      // The write already committed. Do not invite a duplicate submission when
      // only the following read failed; expose Retry without losing the data.
    }
  }, [publishData]);
  const refreshRecords = useCallback(() => refreshCommune(activeId), [activeId, refreshCommune]);

  // Older expenses of one commune, a page at a time: whole months (UTC) going
  // back from where the loaded ones start, or all of them when months is left
  // out. One read per commune at a time; a second caller waits for the first.
  const readOlder = useCallback((communeId: string, months?: number): Promise<void> => {
    const current = dataRef.current;
    const held = current?.snapshots[communeId];
    const since = held?.expenseHistory?.since;
    if (!current || !held || held.detail === "summary" || !since) return Promise.resolve();
    const key = `${current.user.id}:${communeId}`;
    const pending = olderReads.current.get(key);
    if (pending) return pending;
    const state = historyState(held, current.older[communeId]);
    if (state.complete) return Promise.resolve();
    const request = loadExpensePage(communeId, state.loadedFrom, months).then((page) => {
      const latest = dataRef.current;
      const now = latest?.snapshots[communeId];
      // A new month moves the snapshot's window on; pages for the old one no longer join up.
      if (!latest || latest.user.id !== current.user.id || !now || now.expenseHistory?.since !== since) return;
      const kept = olderFor(now, latest.older[communeId]);
      publishData({ ...latest, older: { ...latest.older, [communeId]: { since, from: page.from, olderCount: page.olderCount,
        olderVoidedCount: page.olderVoidedCount,
        expenses: { ...kept?.expenses, ...Object.fromEntries(page.expenses.map((expense) => [expense.id, expense])) } } } });
    }).finally(() => olderReads.current.delete(key));
    olderReads.current.set(key, request);
    return request;
  }, [publishData]);

  const loadEarlierExpenses = useCallback(async (before: string, voided = false): Promise<string | null> => {
    const communeId = activeId;
    const limit = Date.parse(`${before}T00:00:00Z`);
    // Each page reaches back at least a month, so this ends; the bound is a backstop.
    for (let page = 0; page < 600; page += 1) {
      const current = dataRef.current;
      const held = current?.snapshots[communeId];
      if (!current || !held || held.detail === "summary") return null;
      const older = current.older[communeId];
      const state = historyState(held, older);
      // Open expenses always show, so only settled ones (or voided ones) count.
      const newest = Math.max(...withOlderExpenses(held, older).expenses
        .filter((expense) => voided ? !!expense.voidedAt
          : !expense.voidedAt && expense.shares.every((share) => share.settledMinor >= share.amountMinor))
        .map((expense) => Date.parse(expense.createdAt ?? "")).filter((time) => time < limit));
      // Everything between that month and `before` must be loaded too.
      const loadedFrom = state.loadedFrom ? Date.parse(`${state.loadedFrom}T00:00:00Z`) : -Infinity;
      if (Number.isFinite(newest) && (state.complete || newest >= loadedFrom)) {
        const month = new Date(newest);
        return new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), 1)).toISOString().slice(0, 10);
      }
      if (state.complete) return null;
      await readOlder(communeId, 1);
    }
    return null;
  }, [activeId, readOlder]);

  const loadFullHistory = useCallback(async (): Promise<Snapshot | null> => {
    const communeId = activeId;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const current = dataRef.current;
      const held = current?.snapshots[communeId];
      if (!current || !held || held.detail === "summary") return null;
      const older = current.older[communeId];
      if (historyState(held, older).complete) {
        // Every expense is in it now, so it says nothing about older ones.
        const { expenseHistory: _history, changeMark: _mark, ...ledger } = withOlderExpenses(held, older);
        return ledger;
      }
      await readOlder(communeId);
    }
    throw new Error("Earlier expenses couldn’t be loaded. Try again.");
  }, [activeId, readOlder]);

  // A link to an expense older than what is loaded (from search, a notice,
  // activity or a recurring bill's history) fetches that one expense. If it
  // is refused or gone, the window says it isn't in this commune.
  useEffect(() => {
    const current = dataRef.current;
    const key = recordKey;
    if (!current || expenseRead !== "loading" || recordReads.current.has(key)) return;
    recordReads.current.add(key);
    const finish = (result?: "missing" | "failed") => {
      recordReads.current.delete(key);
      if (result) setRecordResults((results) => ({ ...results, [key]: result }));
    };
    loadExpenseRecords(activeId, [selectedExpenseId]).then(({ expenses: found }) => {
      const latest = dataRef.current;
      const now = latest?.snapshots[activeId];
      if (!latest || latest.user.id !== current.user.id || !now?.expenseHistory) return finish();
      if (!found.length) return finish("missing");
      // The snapshot holds every expense changed since its window began, and
      // its copy wins, so an expense fetched here is never out of date.
      const kept = olderFor(now, latest.older[activeId]) ?? { since: now.expenseHistory.since, from: now.expenseHistory.since,
        olderCount: now.expenseHistory.olderCount, olderVoidedCount: now.expenseHistory.olderVoidedCount, expenses: {} };
      publishData({ ...latest, older: { ...latest.older, [activeId]: { ...kept,
        expenses: { ...kept.expenses, ...Object.fromEntries(found.map((expense) => [expense.id, expense])) } } } });
      finish();
    }, (error: unknown) => {
      // A refusal stands; a failed connection can be tried again.
      finish(error instanceof ApiError && error.status >= 400 && error.status < 500 ? "missing" : "failed");
    });
  }, [activeId, expenseRead, publishData, recordKey, selectedExpenseId]);
  const retryExpenseRead = useCallback(() => setRecordResults((results) => {
    const next = { ...results };
    delete next[recordKey];
    return next;
  }), [recordKey]);

  const workflow = useCallback(async <T,>(path: string, body: unknown, method = "POST"): Promise<T> => mutate(async () => {
    const result = await api<T>(path,{method,body:JSON.stringify(body)});
    await refreshRecords();
    return result;
  }), [mutate, refreshRecords]);

  const setHubPhoto = useCallback((id: string, dataUrl: string | null) => {
    const photos = { ...prefs.hubPhotos };
    if (dataUrl) photos[id] = dataUrl;
    else delete photos[id];
    savePrefs({ hubPhotos: photos });
  }, [prefs.hubPhotos, savePrefs]);
  const setAvatar = useCallback((dataUrl: string | null) => {
    savePrefs({ avatar: dataUrl ?? undefined });
  }, [savePrefs]);
  const savePayMethod = useCallback((method: PayMethod) => {
    if (!method.value.trim()) return false;
    savePrefs({
      payMethods: [
        { ...method, value: method.value.trim() },
        ...prefs.payMethods.filter((item) => item.provider !== method.provider),
      ],
    });
    return true;
  }, [prefs.payMethods, savePrefs]);

  const createHub = useCallback((input: CreatedHub, opts?: { openExpense?: boolean }) => mutate(async () => {
    const current = dataRef.current;
    if (!current) throw new Error("Sign in first");
    const currency = (input.currency.match(/GBP|USD|EUR/)?.[0] ?? "GBP") as CurrencyCode;
    const kind = input.type.toLowerCase();
    const result = await post<{ id: string }>("/communes", {
      name: input.name.trim(), kind, currency,
      ...locationForKind(input),
    });
    // The transaction has committed. A new commune has one member and no
    // content; publish that confirmed result without reloading every commune.
    ++refreshSequence.current;
    refreshing.current = false;
    const commune: Commune = {
      id: result.id, name: input.name.trim(), kind: kind as Commune["kind"],
      currency, role: "admin", memberCount: 1, ...locationForKind(input),
    };
    const latest = dataRef.current;
    if (!latest || latest.user.id !== current.user.id) return result.id;
    // Neither this nor its list entry has a change mark, so it is not read
    // again until the next check lists the commune with one.
    publishData({ ...latest, communes: [commune, ...latest.communes],
      snapshots: { ...latest.snapshots, [result.id]: {
        commune, members: [{ userId: current.user.id, name: current.user.name, email: current.user.email, role: "admin" }],
        expenses: [], funds: [], notes: [], operations: [], notifications: [], reminderTargets: [],
      } }, invites: { ...latest.invites, [result.id]: [] },
    });
    setHubId(result.id);
    setMoreOpen(false);
    // The form that made it is done with, so it leaves no entry to go back to.
    navigate(opts?.openExpense ? addressOf("expenses", { window: "add-expense", commune: result.id })
      : addressOf("hub", { commune: result.id }), { fallback: "replace" });
    return result.id;
  }), [mutate, navigate, publishData]);

  const updateCommune = useCallback((input: {
    name: string; type: LiveHub["type"]; currency: CurrencyCode;
    address: string; destination: string; stayName: string; stayAddress: string;
  }) => mutate(async () => {
    if (!activeId) throw new Error("Choose a commune first");
    await api(`/communes/${encodeURIComponent(activeId)}`, {
      method: "PATCH",
      body: JSON.stringify({
        name: input.name.trim(),
        kind: input.type.toLowerCase(),
        currency: input.currency,
        ...locationForKind(input),
      }),
    });
    await refreshRecords();
  }), [activeId, mutate, refreshRecords]);

  const recordExpense = useCallback((input: CreateExpenseInput) => mutate(async () => {
    if (!activeId) throw new Error("Create or join a commune first");
    if (!data) throw new Error("Sign in first");
    const shares = input.allocations ? validateExpenseAllocation(input.amountMinor, input.allocations) : allocateExpense(input.amountMinor, input.shareUserIds, "Equal");
    if (shares.length !== input.shareUserIds.length || shares.some(share => !input.shareUserIds.includes(share.userId))) throw new Error("The split must match the selected people.");
    const result = await post<{ id: string; duplicate?: boolean }>(`/communes/${encodeURIComponent(activeId)}/expenses`, {
      title: input.name.trim(),
      amountMinor: input.amountMinor,
      shares,
      dueOn: input.dueOn ?? null,
      paidByUserId: input.paidByUserId ?? data.user.id,
      ...(input.category ? { category: input.category } : {}),
      requestId: input.requestId,
    });
    await refreshRecords();
    return result.id;
  }), [activeId, data, mutate, refreshRecords]);

  const confirmExpenseShare = useCallback((shareId: string) => mutate(async () => {
    await post(`/shares/${encodeURIComponent(shareId)}/confirm`, {});
    await refreshRecords();
  }), [mutate, refreshRecords]);
  // A conflict means someone else's change landed first. Load it before the
  // error reaches the form, so the editor can show the latest version.
  const expenseChange = useCallback((path: string, body: unknown, method: string) => mutate(async () => {
    let result: ExpenseChangeResult;
    try {
      result = await api<ExpenseChangeResult>(path, { method, body: JSON.stringify(body) });
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) await refreshRecords();
      throw error;
    }
    await refreshRecords();
    return result;
  }), [mutate, refreshRecords]);
  const correctExpense = useCallback((expenseId: string, input: CorrectExpenseInput) => {
    const shares = validateExpenseAllocation(input.amountMinor, input.allocations);
    return expenseChange(`/expenses/${encodeURIComponent(expenseId)}`, {
      expectedVersion: input.expectedVersion, title: input.name.trim(), amountMinor: input.amountMinor,
      category: input.category, dueOn: input.dueOn, paidByUserId: input.paidByUserId, shares,
      reason: input.reason.trim(), requestId: input.requestId,
    }, "PUT");
  }, [expenseChange]);
  const voidExpense = useCallback((expenseId: string, input: { expectedVersion: number; reason: string; requestId: string }) =>
    expenseChange(`/expenses/${encodeURIComponent(expenseId)}/void`, { ...input, reason: input.reason.trim() }, "POST"), [expenseChange]);
  const recordShareReceipt = useCallback((shareId: string, input: { amountMinor: number; receivedOn: string; reference?: string; requestId: string }) => mutate(async () => {
    const result = await post<ReceiptResult>(`/shares/${encodeURIComponent(shareId)}/receipts`, {
      amountMinor: input.amountMinor, receivedOn: input.receivedOn,
      reference: input.reference?.trim() || null, requestId: input.requestId,
    });
    await refreshRecords();
    return result;
  }), [mutate, refreshRecords]);
  const reverseShareReceipt = useCallback((receiptId: string, reason: string) => mutate(async () => {
    const result = await post<ReceiptResult>(`/receipts/${encodeURIComponent(receiptId)}/reverse`, { reason });
    await refreshRecords();
    return result;
  }), [mutate, refreshRecords]);
  const reportSharePayment = useCallback((shareId: string, input: { amountMinor: number; sentOn: string; reference?: string; requestId: string }) => mutate(async () => {
    const result = await post<PaymentReportResult>(`/shares/${encodeURIComponent(shareId)}/payment-reports`, {
      amountMinor: input.amountMinor, sentOn: input.sentOn,
      reference: input.reference?.trim() || null, requestId: input.requestId,
    });
    await refreshRecords();
    return result;
  }), [mutate, refreshRecords]);
  const postAnnouncement = useCallback((input: { title: string; body: string; needsAcknowledgement: boolean; requestId: string }) => mutate(async () => {
    const result = await post<AnnouncementResult>(`/communes/${encodeURIComponent(activeId)}/announcements`, {
      title: input.title.trim(), body: input.body.trim(), needsAcknowledgement: input.needsAcknowledgement, requestId: input.requestId,
    });
    await refreshRecords();
    return result;
  }), [activeId, mutate, refreshRecords]);
  const acknowledgeAnnouncement = useCallback((id: string) => mutate(async () => {
    const result = await post<AnnouncementResult>(`/announcements/${encodeURIComponent(id)}/acknowledge`, {});
    await refreshRecords();
    return result;
  }), [mutate, refreshRecords]);
  const archiveAnnouncement = useCallback((id: string) => mutate(async () => {
    const result = await post<AnnouncementResult>(`/announcements/${encodeURIComponent(id)}/archive`, {});
    await refreshRecords();
    return result;
  }), [mutate, refreshRecords]);
  const withdrawPaymentReport = useCallback((reportId: string) => mutate(async () => {
    const result = await post<PaymentReportResult>(`/payment-reports/${encodeURIComponent(reportId)}/withdraw`, {});
    await refreshRecords();
    return result;
  }), [mutate, refreshRecords]);
  const resolvePaymentReport = useCallback((reportId: string, input: { decision: "confirm"; requestId: string } | { decision: "decline"; note: string }) => mutate(async () => {
    const result = await post<PaymentReportResult>(`/payment-reports/${encodeURIComponent(reportId)}/resolve`,
      input.decision === "confirm" ? input : { decision: "decline", note: input.note.trim() });
    await refreshRecords();
    return result;
  }), [mutate, refreshRecords]);
  const markExpensePaid = useCallback((expenseId: string) => mutate(async () => {
    const expense = expenses.find((row) => row.id === expenseId);
    if (!expense || expense.paidByUserId !== data?.user.id) {
      throw new Error("Only the person who paid can confirm a share");
    }
    const outstanding = expense.shares.filter((share) =>
      share.userId !== data.user.id && share.settledMinor < share.amountMinor);
    if (outstanding.length !== 1) {
      throw new Error("Choose the member’s outstanding share to confirm");
    }
    await post(`/shares/${encodeURIComponent(outstanding[0].id)}/confirm`, {});
    await refreshRecords();
  }), [data?.user.id, expenses, mutate, refreshRecords]);

  const createInvite = useCallback((email: string, role: "admin" | "member") => mutate(async () => {
    if (!activeId) throw new Error("Choose a commune first");
    const result = await post<{ token: string; url?: string }>(`/communes/${encodeURIComponent(activeId)}/invites`, { email, role });
    const url = result.url ?? new URL(`/invite?token=${encodeURIComponent(result.token)}`, window.location.origin).href;
    await refresh();
    return { token: result.token, url };
  }), [activeId, mutate, refresh]);
  const revokeInvite = useCallback((id: string) => mutate(async () => {
    await post(`/invites/${encodeURIComponent(id)}/revoke`, {});
    await refresh();
  }), [mutate, refresh]);
  const sendInviteEmail = useCallback(async (token: string) => {
    const result = await post<{ status: string }>("/invitation-email", { token });
    if (result.status !== "sent") throw new Error("Email sending could not be confirmed. Retry or copy the link.");
  }, []);
  const previewInvite = useCallback(async (token: string) => {
    const result = await api<{ invite: InvitePreview | null }>(`/invites/${encodeURIComponent(token)}`);
    return result.invite;
  }, []);
  const inviteAddressHint = useCallback(async (token: string) => {
    const result = await api<{ hint: string | null }>(`/invites/${encodeURIComponent(token)}/hint`);
    return result.hint;
  }, []);
  const acceptInvite = useCallback((token: string) => mutate(async () => {
    const result = await post<{ communeId: string }>(`/invites/${encodeURIComponent(token)}/accept`, {});
    await refresh();
    setHubId(result.communeId);
    navigate(addressOf("hub", { commune: result.communeId }), { fallback: "replace" });
    return result.communeId;
  }), [mutate, navigate, refresh]);

  // A repeat of the same requestId returns the record the first attempt made.
  const createFund = useCallback((name: string, targetMinor: number | null, requestId: string) => mutate(async () => {
    if (!activeId) throw new Error("Choose a commune first");
    const result = await post<{ id: string; duplicate?: boolean }>(`/communes/${encodeURIComponent(activeId)}/funds`, { name, targetMinor, requestId });
    await refreshRecords();
    return result.id;
  }), [activeId, mutate, refreshRecords]);
  const pledgeFund = useCallback((fundId: string, amountMinor: number, dueOn: string, requestId: string) => mutate(async () => {
    const result = await post<{ id: string; duplicate?: boolean }>(`/funds/${encodeURIComponent(fundId)}/pledges`, { amountMinor, dueOn, requestId });
    await refreshRecords();
    return result.id;
  }), [mutate, refreshRecords]);
  const recordFundContribution = useCallback((commitmentId: string, amountMinor: number, requestId: string) => mutate(async () => {
    const result = await post<{ id: string; duplicate?: boolean }>(`/commitments/${encodeURIComponent(commitmentId)}/contributions`, { amountMinor, requestId });
    await refreshRecords();
    return result.id;
  }), [mutate, refreshRecords]);
  const updateFund = async (id: string, name: string, targetMinor: number | null) => { await workflow(`/funds/${encodeURIComponent(id)}`,{name,targetMinor},"PATCH"); };
  const archiveFund = async (id: string, archived: boolean) => { await workflow(`/funds/${encodeURIComponent(id)}/archive`,{archived}); };
  // A pledge changed since the editor opened is a conflict. Load it before the
  // error reaches the form, so the editor can start again from what is saved.
  const updatePledge = (id: string, input: PledgeChange) => mutate(async () => {
    try {
      await api(`/commitments/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(input) });
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) await refreshRecords();
      throw error;
    }
    await refreshRecords();
  });
  const voidContribution = async (id: string, reason: string) => { await workflow(`/contributions/${encodeURIComponent(id)}/void`,{reason}); };
  // A conflict means the bill changed after this screen loaded it (someone
  // edited, recorded, paused or archived it). Load the latest before the
  // error reaches the screen, as an expense correction does.
  const recurringChange = useCallback(async <T,>(path: string, body: unknown): Promise<T> => mutate(async () => {
    let result: T;
    try {
      result = await api<T>(path, { method: "POST", body: JSON.stringify(body) });
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) await refreshRecords();
      throw error;
    }
    await refreshRecords();
    return result;
  }), [mutate, refreshRecords]);
  const saveRecurringBill = async (input: RecurringBillInput) => (await recurringChange<{id:string}>(`/communes/${encodeURIComponent(activeId)}/recurring`,input)).id;
  const pauseRecurringBill = (id: string, paused: boolean) =>
    recurringChange<RecurringBillState>(`/recurring/${encodeURIComponent(id)}/pause`, { paused });
  const archiveRecurringBill = (id: string, archived: boolean) =>
    recurringChange<RecurringBillState>(`/recurring/${encodeURIComponent(id)}/archive`, { archived });
  const recordRecurringBill = async (id: string, expectedDueOn: string) => (await workflow<{id:string}>(`/recurring/${encodeURIComponent(id)}/record`,{expectedDueOn})).id;
  const recordRecurringPeriod = (id: string, expectedDueOn: string, amountMinor?: number) =>
    recurringChange<RecurringPeriodResult>(`/recurring/${encodeURIComponent(id)}/periods`, { expectedDueOn, amountMinor: amountMinor ?? null });
  const skipRecurringPeriod = (id: string, expectedDueOn: string, reason: string) =>
    recurringChange<RecurringPeriodResult>(`/recurring/${encodeURIComponent(id)}/skip`, { expectedDueOn, reason: reason.trim() });
  const saveSplitTemplate = async (input: SplitTemplateInput) => (await workflow<{id:string}>(`/communes/${encodeURIComponent(activeId)}/templates`,input)).id;
  const manageMember = async (userId: string, action: "admin" | "member" | "leave" | "remove") => mutate(async () => {
    await post(`/communes/${encodeURIComponent(activeId)}/members/${encodeURIComponent(userId)}`,{action});
    // Its addresses are no longer yours: go Home before the list drops it.
    if (action === "leave") navigate(addressOf("home"));
    await refresh();
  });
  const sendReminder = useCallback((kind: "nudge" | "chase", sourceId: string, requestId: string) => mutate(async () => {
    const actorId = dataRef.current?.user.id;
    const raw = await post<Partial<ReminderResult>>("/reminders", { kind, sourceId, requestId });
    if (typeof raw?.id !== "string" || !raw.id) throw new ApiError("The reminder service returned an unexpected response", 502);
    const result: ReminderResult = {
      id: raw.id, duplicate: raw.duplicate === true,
      emailStatus: raw.emailStatus === "possible" ? "possible" : "none",
    };
    // The reminder is recorded. A failed follow-up read must not turn an
    // accepted reminder into an apparent failure; the display catches up later.
    await Promise.all([refreshRecords(), api<ReminderUsage>("/reminders/usage").then(reminderUsage => {
      const latest = dataRef.current;
      if (latest && latest.user.id === actorId) publishData({ ...latest, reminderUsage });
    }).catch((error: unknown) => {
      console.warn("Reminder usage could not be refreshed", error instanceof Error ? error.name : "unknown");
    })]);
    return result;
  }), [mutate, refreshRecords, publishData]);
  // A notice from another commune changes that commune's notices and count.
  const markNotificationRead = useCallback((id: string, communeId?: string) => mutate(async () => {
    await post(`/notifications/${encodeURIComponent(id)}/read`, {});
    await refreshCommune(communeId ?? activeId);
  }), [activeId, mutate, refreshCommune]);
  const loadUnreadNotices = useCallback(async () =>
    (await api<{ notices: UnreadNotice[] }>("/notices/unread")).notices, []);

  const addNote = useCallback((card: NoteCard & { id: string }, requestId: string) => mutate(async () => {
    if (!activeId) throw new Error("Choose a commune first");
    const { id: _draftId, ...payload } = card;
    const result = await post<{ id: string }>(`/communes/${encodeURIComponent(activeId)}/notes`, { ...payload, requestId });
    await refreshRecords();
    return result.id;
  }), [activeId, mutate, refreshRecords]);
  const updateNote = useCallback((card: NoteCard & { id: string; expectedVersion?: number }) => mutate(async () => {
    const current = data?.snapshots[activeId]?.notes?.find((note) => note.id === card.id);
    if (!current) throw new Error("Note not found in this commune");
    const { id, expectedVersion, ...payload } = card;
    try {
      await api(`/notes/${encodeURIComponent(id)}`, { method: "PUT",
        body: JSON.stringify({ ...payload, expectedVersion: expectedVersion ?? current.version ?? null }) });
    } catch (error) {
      // Someone else saved first: show their version, keep the editor's text.
      if (error instanceof ApiError && error.status === 409) await refreshRecords();
      throw error;
    }
    await refreshRecords();
    return id;
  }), [activeId, data, mutate, refreshRecords]);
  const loadNoteRevision = useCallback(async (noteId: string, revisionId: string) =>
    (await api<{ revision: NoteRevision }>(`/notes/${encodeURIComponent(noteId)}/revisions/${encodeURIComponent(revisionId)}`)).revision, []);
  const addOperation = useCallback((item: NewOperation, requestId: string) => mutate(async () => {
    if (!activeId) throw new Error("Choose a commune first");
    const result = await post<{ id: string }>(`/communes/${encodeURIComponent(activeId)}/operations`, { ...operationPayload(item), requestId });
    await refreshRecords();
    return result.id;
  }), [activeId, mutate, refreshRecords]);
  const updateOperation = useCallback((id: string, item: NewOperation, expectedVersion?: number) => mutate(async () => {
    const existing = operations.find((row) => row.id === id);
    if (!existing) throw new Error("Schedule item not found");
    try {
      await api(`/operations/${encodeURIComponent(id)}`, {
        method: "PUT",
        body: JSON.stringify({ ...operationPayload({ ...existing, ...item }), expectedVersion: expectedVersion ?? existing.version ?? null }),
      });
    } catch (error) {
      // It changed since the edit began: load what is saved now, so the form
      // can show it rather than put back an older date or person.
      if (error instanceof ApiError && error.status === 409) await refreshRecords();
      throw error;
    }
    await refreshRecords();
  }), [mutate, operations, refreshRecords]);
  // Task actions are commands: the database advances the date and rotation
  // and rejects a stale click, so two people cannot complete one occurrence.
  const occurrenceCommand = useCallback((path: string, body: unknown) => mutate(async () => {
    let raw: { id?: unknown; duplicate?: unknown; date?: unknown; assignee?: unknown; assigneeId?: unknown; turnOwnerId?: unknown; status?: unknown };
    try {
      raw = await post(path, body);
    } catch (error) {
      // Someone else acted first. Show their result rather than a stale card.
      if (error instanceof ApiError && error.status === 409) await refreshRecords();
      throw error;
    }
    await refreshRecords();
    if (typeof raw?.id !== "string" || typeof raw.date !== "string") throw new ApiError("The task service returned an unexpected response", 502);
    return {
      occurrenceId: raw.id, duplicate: raw.duplicate === true, date: raw.date,
      assignee: typeof raw.assignee === "string" ? raw.assignee : null,
      assigneeId: typeof raw.assigneeId === "string" ? raw.assigneeId : null,
      turnOwnerId: typeof raw.turnOwnerId === "string" ? raw.turnOwnerId : null, status: raw.status === "done" ? "done" : "open",
    } satisfies OperationChange;
  }), [mutate, refreshRecords]);
  const taskAction = useCallback((id: string, action: "completed" | "skipped" | "reopened", reason?: string) => {
    const item = operations.find((row) => row.id === id);
    if (!item) return Promise.reject(new Error("Schedule item not found"));
    return occurrenceCommand(`/operations/${encodeURIComponent(id)}/occurrences`, {
      action, expectedDate: item.date, today: todayIso(), requestId: newRequestId(),
      ...(reason?.trim() ? { reason: reason.trim() } : {}),
    });
  }, [occurrenceCommand, operations]);
  // The expected date and holder reject a handover made from a stale screen.
  const handOverOperation = useCallback((id: string, toMemberId: string, reason?: string) => {
    const item = operations.find((row) => row.id === id);
    if (!item) return Promise.reject(new Error("Schedule item not found"));
    return occurrenceCommand(`/operations/${encodeURIComponent(id)}/handovers`, {
      toMemberId, expectedDate: item.date, expectedAssigneeId: item.assigneeId ?? null, today: todayIso(),
      reason: reason?.trim() || null, requestId: newRequestId(),
    });
  }, [occurrenceCommand, operations]);
  const undoOperation = useCallback((occurrenceId: string) =>
    occurrenceCommand(`/occurrences/${encodeURIComponent(occurrenceId)}/undo`, {}), [occurrenceCommand]);
  const toggleOperation = useCallback((id: string) => {
    const item = operations.find((row) => row.id === id);
    if (item?.status !== "done") return taskAction(id, "completed");
    // Undo the completion when it is still the latest state; a task finished
    // before occurrences existed is reopened as a new recorded action.
    return item.undoOccurrenceId ? undoOperation(item.undoOccurrenceId) : taskAction(id, "reopened");
  }, [operations, taskAction, undoOperation]);
  const skipOperation = useCallback((id: string, reason?: string) => taskAction(id, "skipped", reason), [taskAction]);
  const removeOperation = useCallback((id: string) => mutate(async () => {
    await api(`/operations/${encodeURIComponent(id)}`, { method: "DELETE" });
    await refreshRecords();
    leaveRecord();
  }), [leaveRecord, mutate, refreshRecords]);

  // A commune named in the address is the one this tab shows, on every screen.
  useEffect(() => {
    if (urlCommune && !unknownCommune && urlCommune !== hubId) setHubId(urlCommune);
  }, [hubId, unknownCommune, urlCommune]);
  // A screen for one commune names it, so a reload or a shared link opens the same one.
  useEffect(() => {
    if (heldUrl || !data || !shown.screen || !COMMUNE_SCREENS.has(shown.screen) || shown.commune || !activeId) return;
    // Never over a newer navigation that this render has not seen.
    if (urlRef.current !== url) return;
    navigate(withCommune(path, search, activeId), { fallback: "replace" });
  }, [activeId, data, heldUrl, navigate, path, search, shown.commune, shown.screen, url]);
  // The commune this tab shows opens next time, while the account is still in it.
  const remembered = useRef("");
  useEffect(() => {
    if (!viewerId || !activeId || remembered.current === `${viewerId}:${activeId}`) return;
    remembered.current = `${viewerId}:${activeId}`;
    savePrefs({ activeHubId: activeId });
  }, [activeId, savePrefs, viewerId]);

  const go = useCallback((target: GoTarget, opts?: GoOpts) => {
    // A fund opens at its own address; other records are found on their screen.
    const fund = opts?.fund ?? (opts?.record?.kind === "fund" ? opts.record.id : undefined);
    setSearchTarget(opts?.record && opts.record.kind !== "fund" ? { ...opts.record, communeId: opts.hub ?? activeId } : null);
    setMoreOpen(false);
    if (target === "login" || target === "signup" || target === "forgot" ||
        target === "invite" || target === "onboard") {
      navigate(authPath(target));
      return;
    }
    const commune = opts?.hub && places.some((place) => place.id === opts.hub) ? opts.hub : activeId;
    // Screens that do not name a commune still show this one.
    if (commune !== hubId) setHubId(commune);
    const here = shownRef.current;
    const win = isWindowId(target) ? target : null;
    const dest: ScreenId = win ? WINDOW_PAGE[win] ?? here.screen ?? "home"
      : target === "home-empty" ? "home" : target === "hub-empty" ? "hub"
        : target === "expenses-empty" ? "expenses" : target === "settle-even" ? "settle" : target as ScreenId;
    const record = win === "expense" || win === "expense-paid" || win === "pay" ? opts?.expense
      : win === "note" || win === "note-edit" ? opts?.note
        : win === "operation" || win === "operation-edit" ? opts?.operation
          : !win && dest === "funds" ? fund : undefined;
    const to = addressOf(dest, { window: win, record, commune, params: {
      template: win === "add-expense" ? opts?.template : undefined,
      date: win === "operation-new" ? opts?.date : undefined,
      time: win === "operation-new" ? opts?.time : undefined,
    } });
    // From a window, going where it opened from is Back. A finished or
    // cancelled form is replaced, so Back never reopens it.
    navigate(to, {
      returning: Boolean(here.window || here.record),
      fallback: here.window && FORM_WINDOWS.has(here.window) ? "replace" : "push",
    });
  }, [activeId, hubId, navigate, places]);

  // Dialogs have their own heading; the page behind them remains the page.
  const isHome = screen === "home" || screen === "home-empty";
  const firstName = you.name.trim().split(/\s+/)[0];
  const pageTitle = unknownCommune ? "Commune not found" : isHome
    ? firstName ? `Your communes, ${firstName}.` : "Your communes."
    : PAGE_TITLES[screen] ?? "Home";
  const outstandingShareCount = places.reduce((sum, place) => sum + place.moves.length, 0);
  const pageLede = unknownCommune ? "" : isHome
    ? `${places.length} ${places.length === 1 ? "space" : "spaces"} · shared details that stay in sync for everyone.`
    : screen === "communes"
      ? session?.hasHubs
        ? places.some((place) => place.activityState !== "ready")
          ? `${places.length} ${places.length === 1 ? "commune" : "communes"} · ${places.some((place) => place.activityState === "error") ? "Some activity is unavailable" : "Shared activity is still loading"}`
          : `${places.length} ${places.length === 1 ? "commune" : "communes"} · ${outstandingShareCount} outstanding ${outstandingShareCount === 1 ? "share" : "shares"} involving you`
        : PAGE_LEDES["home-empty"]
      : screen === "expenses" || screen === "expenses-empty"
        ? `Everything ${hub.name} has shared.`
        : screen === "settle" || screen === "settle-even"
          ? hub.oweCopy
          : screen === "hub" || screen === "hub-empty"
            ? hub.status
            : PAGE_LEDES[screen] ?? "";

  return <Ctx.Provider value={{
    authStatus, apiError, mutationPending: mutationCount > 0, clearApiError: () => setApiError(null), refresh: fullRefresh,
    signInWithPassword, signInWithGoogle, signUpWithPassword, verifyEmailCode, session, screen, hubId: activeId,
    hub, places, snapshots: data?.snapshots ?? {}, contentLoading, contentError, emptyHub: empty, unknownCommune, window: windowId, moreOpen,
    navMode: device.navMode, noteKey, notes, operationKey, operationDate,
    operationTime, operationsByHub, operations, selectedOperation, fundKey,
    dark: device.theme === "dark" || (device.theme === "system" && prefersDark), theme: device.theme, noticesOn: device.noticesOn,
    searchQuery, searchScope, searchTarget, noteSearchQuery, invites: data?.invites[activeId] ?? [], payMethods: prefs.payMethods, native, you,
    lastExpense, expenses, selectedExpense, createdExpenses: expenses, voidedExpenses,
    expenseRead, retryExpenseRead, expenseHistory, loadEarlierExpenses, loadFullHistory,
    funds, recurringBills, splitTemplates, expenseTemplateId, reminderTargets, reminderUsage, sentReminders, notifications,
    noticeCounts, loadUnreadNotices, personName: (userId, fallback, options) => personName(data?.snapshots[activeId]?.members, userId, fallback, options),
    signOut, signOutUnconfirmed, retrySignOut: confirmSignOut, sessionNotice, go,
    changePassword, signOutOtherDevices,
    closeWindow: () => { if (!mutationCount) leaveRecord(); }, watchTypedText, leaveAsked, answerLeave, setMoreOpen,
    setNavMode: (navMode) => saveDevice({ navMode }),
    setTheme: (theme) => saveDevice({ theme }),
    setNoticesOn: (noticesOn) => saveDevice({ noticesOn }),
    setSearchQuery, setSearchScope, clearSearchTarget, setNoteSearchQuery, savePayMethod, setHubPhoto, setAvatar, addNote, updateNote, loadNoteRevision,
    addOperation, updateOperation, toggleOperation, skipOperation, handOverOperation, undoOperation,
    removeOperation, createHub, updateCommune, recordExpense, confirmExpenseShare, correctExpense, voidExpense, recordShareReceipt, reverseShareReceipt,
    reportSharePayment, withdrawPaymentReport, resolvePaymentReport,
    announcements, postAnnouncement, acknowledgeAnnouncement, archiveAnnouncement,
    markExpensePaid, createInvite, sendInviteEmail, revokeInvite, previewInvite, inviteAddressHint, acceptInvite, createFund,
    pledgeFund, recordFundContribution, sendReminder, markNotificationRead,
    updateFund, archiveFund, updatePledge, voidContribution, saveRecurringBill, pauseRecurringBill, archiveRecurringBill, recordRecurringBill, recordRecurringPeriod, skipRecurringPeriod, saveSplitTemplate, manageMember,
    pageTitle, pageLede,
  }}>{children}</Ctx.Provider>;
}

export function useApp(): AppState {
  const context = useContext(Ctx);
  if (!context) throw new Error("useApp must be used inside AppProvider");
  return context;
}

export type { CurrencyCode, LiveExpenseRow, LiveHub, ReminderTarget, ReminderResult, ReceiptResult, SentReminder, Notification, Fund };
