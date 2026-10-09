import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useLocation } from "wouter";
import { isConnectionFailure } from "./live/connection";
import { allocateExpense, validateExpenseAllocation, type ExpenseAllocation } from "../../../packages/core/src/expenseSplit";
import {
  PAGE_LEDES,
  PAGE_TITLES,
  PATH_SCREEN,
  SCREEN_PATH,
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
import { isStoredImage, readHubPhotos } from "./data/images";
import { newRequestId } from "./data/requestId";
import { isNativeNow, keepSearch, pathOnly } from "./nav";
import { api, post, loadCommunes, loadSnapshot, ApiError } from "./live/api";
import {
  expenseRows,
  hubFromSnapshot,
  money,
  type Commune,
  type CurrencyCode,
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
} from "./live/model";

const LOCAL_PREFIX = "commune.local.";
export type Seed = "new";
export type NavMode = "basic" | "advanced";
/** An invitation and where it is in its life. Admins see them all. */
export type PendingInvite = {
  id: string; email: string; role: "Member" | "Admin";
  status: "pending" | "expired" | "accepted" | "revoked";
  createdAt: string; expiresAt: string; acceptedAt: string | null; revokedAt: string | null;
};
type InviteRecord = { id: string; email: string; role: "member" | "admin"; createdAt: string; expiresAt: string; acceptedAt: string | null; revokedAt: string | null };
export function inviteStatus(invite: Pick<InviteRecord, "acceptedAt" | "revokedAt" | "expiresAt">, now = Date.now()): PendingInvite["status"] {
  if (invite.acceptedAt) return "accepted";
  if (invite.revokedAt) return "revoked";
  return Date.parse(invite.expiresAt) > now ? "pending" : "expired";
}
export type PayMethod = {
  provider: "Revolut" | "PayPal" | "Monzo" | "Bank transfer";
  value: string;
};
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
  window?: WindowId;
  expense?: string;
  template?: string;
  record?: { kind: "fund" | "recurring" | "member" | "template"; id: string };
};
export type SearchTarget = NonNullable<GoOpts["record"]> & { communeId: string };
type LocalPrefs = {
  activeHubId?: string;
  navMode: NavMode;
  dark: boolean;
  noticesOn: boolean;
  currency: "£ GBP" | "$ USD" | "€ EUR";
  payMethods: PayMethod[];
  hubPhotos: Partial<Record<HubId, string>>;
  avatar?: string;
};
type LiveData = {
  user: User;
  communes: Commune[];
  snapshots: Record<string, Snapshot>;
  invites: Record<string, PendingInvite[]>;
  reminderUsage: ReminderUsage | null;
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
  dark: boolean;
  noticesOn: boolean;
  currency: "£ GBP" | "$ USD" | "€ EUR";
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
  signOut: () => Promise<void>;
  go: (target: GoTarget, opts?: GoOpts) => void;
  closeWindow: () => void;
  setMoreOpen: (open: boolean) => void;
  setNavMode: (mode: NavMode) => void;
  setDark: (on: boolean) => void;
  setNoticesOn: (on: boolean) => void;
  setCurrency: (currency: "£ GBP" | "$ USD" | "€ EUR") => void;
  setSearchQuery: (query: string) => void;
  setSearchScope: (id: string | null) => void;
  clearSearchTarget: () => void;
  setNoteSearchQuery: (query: string) => void;
  savePayMethod: (method: PayMethod) => boolean;
  setHubPhoto: (id: HubId, dataUrl: string | null) => void;
  setAvatar: (dataUrl: string | null) => void;
  addNote: (card: NoteCard & { id: string }) => Promise<string>;
  /** expectedVersion: the version the edit started from. Defaults to the version on screen now. */
  updateNote: (card: NoteCard & { id: string; expectedVersion?: number }) => Promise<string>;
  loadNoteRevision: (noteId: string, revisionId: string) => Promise<NoteRevision>;
  addOperation: (item: NewOperation) => Promise<string>;
  updateOperation: (id: string, item: NewOperation) => Promise<void>;
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
  acceptInvite: (token: string) => Promise<string>;
  createFund: (name: string, targetMinor?: number | null) => Promise<string>;
  pledgeFund: (fundId: string, amountMinor: number, dueOn: string) => Promise<string>;
  recordFundContribution: (commitmentId: string, amountMinor: number) => Promise<string>;
  updateFund: (fundId: string, name: string, targetMinor: number | null) => Promise<void>;
  archiveFund: (fundId: string, archived: boolean) => Promise<void>;
  updatePledge: (commitmentId: string, input: { amountMinor?: number; dueOn?: string; cancel?: boolean }) => Promise<void>;
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
  markNotificationRead: (id: string) => Promise<void>;
  pageTitle: string;
  pageLede: string;
};

const Ctx = createContext<AppState | null>(null);

const DEFAULT_PREFS: LocalPrefs = {
  navMode: "basic",
  dark: false,
  noticesOn: true,
  currency: "£ GBP",
  payMethods: [],
  hubPhotos: {},
};

function readPrefs(userId: string): LocalPrefs {
  try {
    const raw = sessionStorage.getItem(`${LOCAL_PREFIX}${userId}`);
    if (!raw) return { ...DEFAULT_PREFS };
    const parsed = JSON.parse(raw) as Partial<LocalPrefs>;
    const photos = readHubPhotos(parsed.hubPhotos);
    return {
      activeHubId: typeof parsed.activeHubId === "string" ? parsed.activeHubId : undefined,
      navMode: parsed.navMode === "advanced" ? "advanced" : "basic",
      dark: parsed.dark === true,
      noticesOn: parsed.noticesOn !== false,
      currency: parsed.currency === "$ USD" || parsed.currency === "€ EUR" ? parsed.currency : "£ GBP",
      payMethods: Array.isArray(parsed.payMethods) ? parsed.payMethods.filter(
        (method): method is PayMethod => !!method && typeof method.value === "string" &&
          ["Revolut", "PayPal", "Monzo", "Bank transfer"].includes(method.provider),
      ) : [],
      hubPhotos: photos ?? {},
      avatar: isStoredImage(parsed.avatar) ? parsed.avatar : undefined,
    };
  } catch {
    return { ...DEFAULT_PREFS };
  }
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
    moves: [],
    members: [],
    activity: [],
    notes: [],
    jumps: [],
  };
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
    lastDone: "lastDone" in item ? item.lastDone ?? null : null,
    repeat: item.repeat,
    status: "status" in item ? item.status : "open",
    notes: item.notes,
  };
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [location, setLocation] = useLocation();
  const screen: ScreenId = PATH_SCREEN[pathOnly(location)] ?? "home";
  const [authStatus, setAuthStatus] = useState<AuthStatus>("loading");
  const [apiError, setApiError] = useState<string | null>(null);
  const [mutationCount, setMutationCount] = useState(0);
  const [data, setData] = useState<LiveData | null>(null);
  const dataRef = useRef<LiveData | null>(null);
  const publishData = useCallback((next: LiveData | null) => {
    dataRef.current = next;
    setData(next);
  }, []);
  const [prefs, setPrefs] = useState<LocalPrefs>({ ...DEFAULT_PREFS });
  const [hubId, setHubId] = useState<HubId>("");
  const [snapshotErrors, setSnapshotErrors] = useState<Record<string, string>>({});
  const [windowId, setWindowId] = useState<WindowId | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [noteKey, setNoteKey] = useState("");
  const [selectedExpenseId, setSelectedExpenseId] = useState("");
  const [expenseTemplateId, setExpenseTemplateId] = useState("");
  const [operationKey, setOperationKey] = useState("");
  const [operationDate, setOperationDate] = useState(todayIso());
  const [operationTime, setOperationTime] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchScope, setSearchScope] = useState<string | null>(null);
  const [searchTarget, setSearchTarget] = useState<SearchTarget | null>(null);
  const clearSearchTarget = useCallback(() => setSearchTarget(null), []);
  const [noteSearchQuery, setNoteSearchQuery] = useState("");
  const loadedRef = useRef(false);
  const refreshSequence = useRef(0);
  const refreshing = useRef(false);
  const lastRefreshAt = useRef(0);
  const snapshotReads = useRef(new Map<string, Promise<void>>());
  const snapshotTimes = useRef(new Map<string, number>());
  const snapshotRevisions = useRef(new Map<string, number>());
  const overview = screen === "home" || screen === "home-empty" || screen === "home-inbox" || screen === "communes" || screen === "home-activity";
  const viewRef = useRef({ hubId, overview });
  viewRef.current = { hubId, overview };
  const native = isNativeNow();

  const readSnapshot = useCallback((commune: Commune, sequence: number, force = false): Promise<void> => {
    const current = dataRef.current;
    if (!current || sequence !== refreshSequence.current) return Promise.resolve();
    const cacheKey = `${current.user.id}:${commune.id}`;
    const revision = snapshotRevisions.current.get(cacheKey) ?? 0;
    const key = `${sequence}:${commune.id}:${revision}`;
    const pending = snapshotReads.current.get(key);
    if (pending) return pending;
    if (!force && current.snapshots[commune.id] && Date.now() - (snapshotTimes.current.get(cacheKey) ?? 0) < 15_000) {
      return Promise.resolve();
    }
    setSnapshotErrors((errors) => {
      const next = { ...errors };
      delete next[commune.id];
      return next;
    });
    const request = loadSnapshot(commune).then((snapshot) => {
      if (sequence !== refreshSequence.current || dataRef.current?.user.id !== current.user.id || revision !== (snapshotRevisions.current.get(cacheKey) ?? 0)) return;
      if (snapshot.commune.id !== commune.id) throw new ApiError("Commune response did not match the request", 502);
      snapshotTimes.current.set(cacheKey, Date.now());
      publishData({ ...dataRef.current, snapshots: { ...dataRef.current.snapshots, [commune.id]: snapshot } });
    }).catch((error: unknown) => {
      if (sequence !== refreshSequence.current || dataRef.current?.user.id !== current.user.id || revision !== (snapshotRevisions.current.get(cacheKey) ?? 0)) return;
      setSnapshotErrors((errors) => ({ ...errors, [commune.id]: error instanceof Error ? error.message : "Activity unavailable" }));
      // A permission failure is not a transient offline state: do not retain
      // cached private activity after the server has rejected access.
      if (error instanceof ApiError && [401, 403, 404].includes(error.status)) {
        const snapshots = { ...dataRef.current.snapshots };
        delete snapshots[commune.id];
        snapshotTimes.current.delete(cacheKey);
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
      ?? current.communes.find((item) => item.id === readPrefs(current.user.id).activeHubId)
      ?? current.communes[0];
    if (!active) return;
    await readSnapshot(active, sequence, force);
    // Overview cards appear immediately from verified membership metadata.
    // Fill the remaining cards progressively instead of bursting N full
    // commune reads into the selected page's critical path.
    for (const commune of current.communes) {
      if (sequence !== refreshSequence.current || !viewRef.current.overview) return;
      if (commune.id !== active.id) await readSnapshot(commune, sequence, force);
    }
  }, [readSnapshot]);

  const refresh = useCallback(async () => {
    const sequence = ++refreshSequence.current;
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
      const result = await startupRead(() => api<{ user: User | null }>("/auth/me"));
      if (sequence !== refreshSequence.current) return;
      if (!result.user) {
        publishData(null);
        setSnapshotErrors({});
        snapshotTimes.current.clear();
        snapshotRevisions.current.clear();
        setHubId("");
        setAuthStatus("guest");
        setApiError(null);
        loadedRef.current = true;
        return;
      }
      const { communes } = await startupRead(() => loadCommunes(result.user!));
      if (sequence !== refreshSequence.current) return;
      const previous = dataRef.current?.user.id === result.user.id ? dataRef.current : null;
      if (!previous) {
        setSnapshotErrors({});
        snapshotTimes.current.clear();
        snapshotRevisions.current.clear();
      }
      // Identity and membership are ready. Keep existing content on refresh;
      // missing snapshots render a loading state, never a false empty ledger.
      publishData({
        user: result.user, communes,
        snapshots: Object.fromEntries(communes.filter((commune) => previous?.snapshots[commune.id])
          .map((commune) => [commune.id, previous!.snapshots[commune.id]])),
        invites: previous?.invites ?? {}, reminderUsage: previous?.reminderUsage ?? null,
      });
      setAuthStatus("authenticated");
      setHubId((current) => communes.some((commune) => commune.id === current)
        ? current : communes.find((commune) => commune.id === readPrefs(result.user!.id).activeHubId)?.id ?? communes[0]?.id ?? "");
      if (!previous) setPrefs(readPrefs(result.user.id));
      loadedRef.current = true;
      // Counts and invitations must not delay the commune itself.
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
      void Promise.all(communes.filter((commune) => commune.role === "admin")
          .map(async (commune) => {
            const result = await api<{ invites: InviteRecord[] }>(`/communes/${encodeURIComponent(commune.id)}/invites`);
            return [commune.id, result.invites.map((invite) => ({
                id: invite.id, email: invite.email,
                role: invite.role === "admin" ? "Admin" as const : "Member" as const,
                status: inviteStatus(invite), createdAt: invite.createdAt, expiresAt: invite.expiresAt,
                acceptedAt: invite.acceptedAt, revokedAt: invite.revokedAt,
              }))] as const;
          })).then((inviteEntries) => {
        if (sequence !== refreshSequence.current || !dataRef.current) return;
        publishData({ ...dataRef.current, invites: Object.fromEntries(inviteEntries) });
      }).catch((error: unknown) => {
        if (sequence === refreshSequence.current) setApiError(error instanceof Error ? error.message : "Could not refresh invitations");
      });
      await loadVisibleSnapshots(sequence, true);
      if (sequence !== refreshSequence.current) return;
      lastRefreshAt.current = Date.now();
    } catch (error) {
      if (sequence !== refreshSequence.current) return;
      setApiError(error instanceof Error ? error.message : "Could not connect to Commune");
      if (!loadedRef.current) setAuthStatus("error");
    } finally {
      if (sequence === refreshSequence.current) refreshing.current = false;
    }
  }, [loadVisibleSnapshots, publishData]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (authStatus === "authenticated") void loadVisibleSnapshots(refreshSequence.current);
  }, [authStatus, hubId, overview, loadVisibleSnapshots]);

  useEffect(() => {
    if (authStatus !== "authenticated") return;
    const onFocus = () => {
      if (document.visibilityState === "visible" && !refreshing.current && Date.now() - lastRefreshAt.current > 15_000) void refresh();
    };
    const onVisible = onFocus;
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    const timer = window.setInterval(onFocus, 60_000);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(timer);
    };
  }, [authStatus, refresh]);

  const mutate = useCallback(async <T,>(action: () => Promise<T>): Promise<T> => {
    setMutationCount(count => count + 1);
    try {
      setApiError(null);
      return await action();
    } catch (error) {
      const message = error instanceof Error ? error.message : "The action could not be saved";
      setApiError(message);
      throw error;
    } finally {
      setMutationCount(count => Math.max(0, count - 1));
    }
  }, []);

  const savePrefs = useCallback((patch: Partial<LocalPrefs>) => {
    if (!data) return;
    const next = { ...prefs, ...patch };
    sessionStorage.setItem(`${LOCAL_PREFIX}${data.user.id}`, JSON.stringify(next));
    setPrefs(next);
  }, [data, prefs]);

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
  const signOut = useCallback(() => mutate(async () => {
    await post("/auth/logout", {});
    ++refreshSequence.current;
    publishData(null);
    setSnapshotErrors({});
    snapshotTimes.current.clear();
    snapshotRevisions.current.clear();
    setHubId("");
    setWindowId(null);
    setAuthStatus("guest");
    setLocation(keepSearch("/login"));
  }), [mutate, publishData, setLocation]);

  const session: Session | null = data ? {
    userId: data.user.id,
    name: data.user.name,
    email: data.user.email,
    emailVerified: data.user.emailVerified === true,
    hasHubs: data.communes.length > 0,
    emptyLedger: data.communes.every((commune) =>
      (data.snapshots[commune.id]?.expenses.length ?? 0) === 0),
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
  const hub = places.find((place) => place.id === hubId) ?? places[0] ?? emptyHub();
  const activeId = hub.id;
  const snapshot = data?.snapshots[activeId];
  const contentLoading = !!data?.communes.length && !overview && !snapshot;
  const contentError = snapshotErrors[activeId] ?? null;
  const allExpenses = snapshot && data ? expenseRows(snapshot, data.user.id) : [];
  const expenses = allExpenses.filter((row) => !row.voidedAt);
  const voidedExpenses = allExpenses.filter((row) => row.voidedAt);
  const selectedExpense = selectedExpenseId ? allExpenses.find((row) => row.id === selectedExpenseId) ?? null : expenses[0] ?? null;
  const lastExpense = selectedExpense
    ? { name: selectedExpense.name, amount: selectedExpense.amount, paidBy: selectedExpense.paidBy }
    : null;
  // A commune whose only expenses are voided still has a ledger to show.
  const empty = !!session?.hasHubs && allExpenses.length === 0;
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
  const you = {
    id: data?.user.id ?? "",
    name: data?.user.name ?? "",
    email: data?.user.email ?? "",
    initials: data ? initialsOf(data.user.name) : "",
    photo: prefs.avatar,
  };

  // A normal mutation does not need another sign-in/list/invitations waterfall.
  // Refresh just its commune, and keep confirmed content visible throughout.
  const refreshRecords = useCallback(async () => {
    const current = dataRef.current;
    const commune = current?.communes.find(item => item.id === activeId);
    if (!current || !commune) return;
    const cacheKey = `${current.user.id}:${activeId}`;
    const revision = (snapshotRevisions.current.get(cacheKey) ?? 0) + 1;
    snapshotRevisions.current.set(cacheKey, revision);
    const sequence = refreshSequence.current;
    const stillCurrent = () => sequence === refreshSequence.current &&
      dataRef.current?.user.id === current.user.id && snapshotRevisions.current.get(cacheKey) === revision;
    try {
      const snapshot = await loadSnapshot(commune);
      const latest = dataRef.current;
      if (!stillCurrent() || !latest || !latest.communes.some(item => item.id === activeId)) return;
      if (snapshot.commune.id !== activeId) throw new ApiError("Commune response did not match the request", 502);
      snapshotTimes.current.set(cacheKey, Date.now());
      publishData({ ...latest, communes: latest.communes.map(item => item.id === activeId ? { ...item, ...snapshot.commune } : item), snapshots: { ...latest.snapshots, [activeId]: snapshot } });
      setSnapshotErrors(errors => { const next = { ...errors }; delete next[activeId]; return next; });
    } catch (error) {
      const latest = dataRef.current;
      if (!stillCurrent() || !latest) return;
      setSnapshotErrors(errors => ({ ...errors, [activeId]: error instanceof Error ? error.message : "Could not refresh saved activity" }));
      if (error instanceof ApiError && [401, 403, 404].includes(error.status)) {
        const snapshots = { ...latest.snapshots };
        delete snapshots[activeId];
        snapshotTimes.current.delete(cacheKey);
        publishData({ ...latest, snapshots });
      }
      // The write already committed. Do not invite a duplicate submission when
      // only the following read failed; expose Retry without losing the data.
    }
  }, [activeId, publishData]);

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
    snapshotTimes.current.set(`${current.user.id}:${result.id}`, Date.now());
    publishData({ ...latest, communes: [commune, ...latest.communes],
      snapshots: { ...latest.snapshots, [result.id]: {
        commune, members: [{ userId: current.user.id, name: current.user.name, email: current.user.email, role: "admin" }],
        expenses: [], funds: [], notes: [], operations: [], notifications: [], reminderTargets: [],
      } }, invites: { ...latest.invites, [result.id]: [] },
    });
    setHubId(result.id);
    savePrefs({ activeHubId: result.id });
    setMoreOpen(false);
    setLocation(keepSearch(SCREEN_PATH.hub));
    setWindowId(opts?.openExpense ? "add-expense" : null);
    return result.id;
  }), [mutate, publishData, savePrefs, setLocation]);

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
    const result = await post<{ id: string }>(`/communes/${encodeURIComponent(activeId)}/expenses`, {
      title: input.name.trim(),
      amountMinor: input.amountMinor,
      shares,
      dueOn: input.dueOn ?? null,
      paidByUserId: input.paidByUserId ?? data.user.id,
      ...(input.category ? { category: input.category } : {}),
    });
    await refreshRecords();
    setSelectedExpenseId(result.id);
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
  const acceptInvite = useCallback((token: string) => mutate(async () => {
    const result = await post<{ communeId: string }>(`/invites/${encodeURIComponent(token)}/accept`, {});
    await refresh();
    setHubId(result.communeId);
    savePrefs({ activeHubId: result.communeId });
    setLocation(keepSearch(SCREEN_PATH.hub));
    return result.communeId;
  }), [mutate, refresh, savePrefs, setLocation]);

  const createFund = useCallback((name: string, targetMinor?: number | null) => mutate(async () => {
    if (!activeId) throw new Error("Choose a commune first");
    const result = await post<{ id: string }>(`/communes/${encodeURIComponent(activeId)}/funds`, { name, targetMinor: targetMinor ?? null });
    await refreshRecords();
    return result.id;
  }), [activeId, mutate, refreshRecords]);
  const pledgeFund = useCallback((fundId: string, amountMinor: number, dueOn: string) => mutate(async () => {
    const result = await post<{ id: string }>(`/funds/${encodeURIComponent(fundId)}/pledges`, { amountMinor, dueOn });
    await refreshRecords();
    return result.id;
  }), [mutate, refreshRecords]);
  const recordFundContribution = useCallback((commitmentId: string, amountMinor: number) => mutate(async () => {
    const result = await post<{ id: string }>(`/commitments/${encodeURIComponent(commitmentId)}/contributions`, { amountMinor });
    await refreshRecords();
    return result.id;
  }), [mutate, refreshRecords]);
  const updateFund = async (id: string, name: string, targetMinor: number | null) => { await workflow(`/funds/${encodeURIComponent(id)}`,{name,targetMinor},"PATCH"); };
  const archiveFund = async (id: string, archived: boolean) => { await workflow(`/funds/${encodeURIComponent(id)}/archive`,{archived}); };
  const updatePledge = async (id: string, input: { amountMinor?: number; dueOn?: string; cancel?: boolean }) => { await workflow(`/commitments/${encodeURIComponent(id)}`,input,"PATCH"); };
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
    await refresh();
    if (action === "leave") { setWindowId(null); setLocation(keepSearch("/")); }
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
  const markNotificationRead = useCallback((id: string) => mutate(async () => {
    await post(`/notifications/${encodeURIComponent(id)}/read`, {});
    await refreshRecords();
  }), [mutate, refreshRecords]);

  const addNote = useCallback((card: NoteCard & { id: string }) => mutate(async () => {
    if (!activeId) throw new Error("Choose a commune first");
    const { id: _draftId, ...payload } = card;
    const result = await post<{ id: string }>(`/communes/${encodeURIComponent(activeId)}/notes`, payload);
    await refreshRecords();
    setNoteKey(result.id);
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
    setNoteKey(id);
    return id;
  }), [activeId, data, mutate, refreshRecords]);
  const loadNoteRevision = useCallback(async (noteId: string, revisionId: string) =>
    (await api<{ revision: NoteRevision }>(`/notes/${encodeURIComponent(noteId)}/revisions/${encodeURIComponent(revisionId)}`)).revision, []);
  const addOperation = useCallback((item: NewOperation) => mutate(async () => {
    if (!activeId) throw new Error("Choose a commune first");
    const result = await post<{ id: string }>(`/communes/${encodeURIComponent(activeId)}/operations`, operationPayload(item));
    await refreshRecords();
    setOperationKey(result.id);
    setOperationDate(item.date);
    return result.id;
  }), [activeId, mutate, refreshRecords]);
  const updateOperation = useCallback((id: string, item: NewOperation) => mutate(async () => {
    const existing = operations.find((row) => row.id === id);
    if (!existing) throw new Error("Schedule item not found");
    await api(`/operations/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: JSON.stringify(operationPayload({ ...existing, ...item })),
    });
    await refreshRecords();
    setOperationDate(item.date);
    if (item.time) setOperationTime(item.time);
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
    setWindowId(null);
  }), [mutate, refreshRecords]);

  const go = useCallback((target: GoTarget, opts?: GoOpts) => {
    setSearchTarget(opts?.record ? { ...opts.record, communeId: opts.hub ?? activeId } : null);
    if (opts?.hub && places.some((place) => place.id === opts.hub)) {
      if (opts.hub !== activeId) {
        setSelectedExpenseId("");
        setNoteKey("");
        setOperationKey("");
      }
      setHubId(opts.hub);
      savePrefs({ activeHubId: opts.hub });
    }
    if (opts?.expense) setSelectedExpenseId(opts.expense);
    if (target === "add-expense") setExpenseTemplateId(opts?.template ?? "");
    if (opts?.note) setNoteKey(opts.note);
    if (opts?.operation) setOperationKey(opts.operation);
    if (opts?.date) setOperationDate(opts.date);
    if (opts?.time) setOperationTime(opts.time);
    else if (target === "operation-new") setOperationTime("");
    setMoreOpen(false);
    if (target === "login" || target === "signup" || target === "forgot" ||
        target === "invite" || target === "onboard") {
      setWindowId(null);
      setLocation(keepSearch(authPath(target)));
      return;
    }
    if (isWindowId(target)) {
      const stay = target === "add-expense" &&
        (screen === "hub-empty" || screen === "home-empty" || screen === "expenses-empty");
      if (!stay) {
        const page = WINDOW_PAGE[target];
        if (page) {
          const dest: ScreenId = page;
          if (dest !== screen) setLocation(keepSearch(SCREEN_PATH[dest]));
        }
      }
      setWindowId(target);
      return;
    }
    let dest: ScreenId = target;
    if (target === "home-empty") dest = "home";
    if (target === "hub-empty") dest = "hub";
    if (target === "expenses-empty") dest = "expenses";
    if (target === "settle-even") dest = "settle";
    setWindowId(opts?.window ?? null);
    setLocation(keepSearch(SCREEN_PATH[dest]));
  }, [activeId, data, places, savePrefs, screen, session?.hasHubs, setLocation]);

  // Dialogs have their own heading; the page behind them remains the page.
  const isHome = screen === "home" || screen === "home-empty";
  const firstName = you.name.trim().split(/\s+/)[0];
  const pageTitle = isHome
    ? firstName ? `Your communes, ${firstName}.` : "Your communes."
    : PAGE_TITLES[screen] ?? "Home";
  const outstandingShareCount = places.reduce((sum, place) => sum + place.moves.length, 0);
  const pageLede = isHome
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
    authStatus, apiError, mutationPending: mutationCount > 0, clearApiError: () => setApiError(null), refresh,
    signInWithPassword, signInWithGoogle, signUpWithPassword, verifyEmailCode, session, screen, hubId: activeId,
    hub, places, snapshots: data?.snapshots ?? {}, contentLoading, contentError, emptyHub: empty, window: windowId, moreOpen,
    navMode: prefs.navMode, noteKey, notes, operationKey, operationDate,
    operationTime, operationsByHub, operations, selectedOperation,
    dark: prefs.dark, noticesOn: prefs.noticesOn, currency: prefs.currency,
    searchQuery, searchScope, searchTarget, noteSearchQuery, invites: data?.invites[activeId] ?? [], payMethods: prefs.payMethods, native, you,
    lastExpense, expenses, selectedExpense, createdExpenses: expenses, voidedExpenses,
    funds, recurringBills, splitTemplates, expenseTemplateId, reminderTargets, reminderUsage, sentReminders, notifications, signOut, go,
    closeWindow: () => { if (!mutationCount) setWindowId(null); }, setMoreOpen,
    setNavMode: (navMode) => savePrefs({ navMode }),
    setDark: (dark) => savePrefs({ dark }),
    setNoticesOn: (noticesOn) => savePrefs({ noticesOn }),
    setCurrency: (currency) => savePrefs({ currency }),
    setSearchQuery, setSearchScope, clearSearchTarget, setNoteSearchQuery, savePayMethod, setHubPhoto, setAvatar, addNote, updateNote, loadNoteRevision,
    addOperation, updateOperation, toggleOperation, skipOperation, handOverOperation, undoOperation,
    removeOperation, createHub, updateCommune, recordExpense, confirmExpenseShare, correctExpense, voidExpense, recordShareReceipt, reverseShareReceipt,
    reportSharePayment, withdrawPaymentReport, resolvePaymentReport,
    announcements, postAnnouncement, acknowledgeAnnouncement, archiveAnnouncement,
    markExpensePaid, createInvite, sendInviteEmail, revokeInvite, previewInvite, acceptInvite, createFund,
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
