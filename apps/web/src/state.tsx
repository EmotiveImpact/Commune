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
  addDays,
  nextInRotation,
  nextOccurrence,
  todayIso,
  type NewOperation,
  type OperationItem,
  type OperationStore,
} from "./data/operations";
import { isStoredImage, readHubPhotos } from "./data/images";
import { isNativeNow, keepSearch, pathOnly } from "./nav";
import { api, post } from "./live/api";
import {
  equalShares,
  expenseRows,
  hubFromSnapshot,
  money,
  type Commune,
  type CurrencyCode,
  type Fund,
  type LiveExpenseRow,
  type LiveHub,
  type Notification,
  type ReminderTarget,
  type Snapshot,
  type User,
} from "./live/model";

const LOCAL_PREFIX = "commune.local.";
export type Seed = "new";
export type NavMode = "basic" | "advanced";
export type PendingInvite = { id: string; email: string; role: "Member" | "Admin"; expiresAt: string };
type InviteRecord = { id: string; email: string; role: "member" | "admin"; expiresAt: string; acceptedAt: string | null; revokedAt: string | null };
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
};

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
};
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
};
type AuthStatus = "loading" | "guest" | "authenticated" | "error";

export type AppState = {
  authStatus: AuthStatus;
  apiError: string | null;
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
  emptyHub: boolean;
  window: WindowId | null;
  moreOpen: boolean;
  navMode: NavMode;
  noteKey: string;
  notes: Record<string, NoteCard>;
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
  invites: PendingInvite[];
  payMethods: PayMethod[];
  native: boolean;
  you: { name: string; email: string; initials: string; photo?: string };
  lastExpense: { name: string; amount: string; paidBy: string } | null;
  expenses: LiveExpenseRow[];
  selectedExpense: LiveExpenseRow | null;
  createdExpenses: LiveExpenseRow[];
  funds: Fund[];
  reminderTargets: ReminderTarget[];
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
  savePayMethod: (method: PayMethod) => boolean;
  setHubPhoto: (id: HubId, dataUrl: string | null) => void;
  setAvatar: (dataUrl: string | null) => void;
  addNote: (card: NoteCard & { id: string }) => Promise<string>;
  addOperation: (item: NewOperation) => Promise<string>;
  updateOperation: (id: string, item: NewOperation) => Promise<void>;
  toggleOperation: (id: string) => Promise<void>;
  skipOperation: (id: string) => Promise<void>;
  removeOperation: (id: string) => Promise<void>;
  createHub: (input: CreatedHub, opts?: { openExpense?: boolean }) => Promise<string>;
  updateCommune: (input: {
    name: string; type: LiveHub["type"]; currency: CurrencyCode;
    address: string; destination: string; stayName: string; stayAddress: string;
  }) => Promise<void>;
  recordExpense: (input: CreateExpenseInput) => Promise<string>;
  confirmExpenseShare: (shareId: string) => Promise<void>;
  markExpensePaid: (expenseId: string) => Promise<void>;
  createInvite: (email: string, role: "admin" | "member") => Promise<{ token: string; url: string }>;
  revokeInvite: (id: string) => Promise<void>;
  previewInvite: (token: string) => Promise<InvitePreview | null>;
  acceptInvite: (token: string) => Promise<string>;
  createFund: (name: string, targetMinor?: number | null) => Promise<string>;
  pledgeFund: (fundId: string, amountMinor: number, dueOn: string) => Promise<string>;
  recordFundContribution: (commitmentId: string, amountMinor: number) => Promise<string>;
  sendReminder: (kind: "nudge" | "chase", sourceId: string) => Promise<void>;
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
    time: item.time ?? undefined,
    assignee: item.assignee ?? undefined,
    rotation: item.rotation ?? undefined,
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
    assignee: item.assignee ?? null,
    rotation: item.rotation ?? null,
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
  const [data, setData] = useState<LiveData | null>(null);
  const [prefs, setPrefs] = useState<LocalPrefs>({ ...DEFAULT_PREFS });
  const [hubId, setHubId] = useState<HubId>("");
  const [windowId, setWindowId] = useState<WindowId | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [noteKey, setNoteKey] = useState("");
  const [selectedExpenseId, setSelectedExpenseId] = useState("");
  const [operationKey, setOperationKey] = useState("");
  const [operationDate, setOperationDate] = useState(todayIso());
  const [operationTime, setOperationTime] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const loadedRef = useRef(false);
  const refreshSequence = useRef(0);
  const native = isNativeNow();

  const refresh = useCallback(async () => {
    const sequence = ++refreshSequence.current;
    try {
      const result = await api<{ user: User | null }>("/auth/me");
      if (sequence !== refreshSequence.current) return;
      if (!result.user) {
        setData(null);
        setHubId("");
        setAuthStatus("guest");
        setApiError(null);
        loadedRef.current = true;
        return;
      }
      const { communes } = await api<{ communes: Commune[] }>("/communes");
      const [entries, inviteEntries] = await Promise.all([
        Promise.all(communes.map(async (commune) => [
          commune.id,
          await api<Snapshot>(`/communes/${encodeURIComponent(commune.id)}/snapshot`),
        ] as const)),
        Promise.all(communes.filter((commune) => commune.role === "admin")
          .map(async (commune) => {
            const result = await api<{ invites: InviteRecord[] }>(`/communes/${encodeURIComponent(commune.id)}/invites`);
            return [commune.id, result.invites.filter((invite) =>
              !invite.acceptedAt && !invite.revokedAt && Date.parse(invite.expiresAt) > Date.now())
              .map((invite) => ({
                id: invite.id, email: invite.email,
                role: invite.role === "admin" ? "Admin" as const : "Member" as const,
                expiresAt: invite.expiresAt,
              }))] as const;
          })),
      ]);
      if (sequence !== refreshSequence.current) return;
      const next: LiveData = {
        user: result.user,
        communes,
        snapshots: Object.fromEntries(entries),
        invites: Object.fromEntries(inviteEntries),
      };
      setData(next);
      setAuthStatus("authenticated");
      setApiError(null);
      setHubId((current) => {
        if (communes.some((commune) => commune.id === current)) return current;
        const saved = readPrefs(result.user!.id).activeHubId;
        return communes.find((commune) => commune.id === saved)?.id ?? communes[0]?.id ?? "";
      });
      setPrefs((current) => data?.user.id === result.user!.id
        ? current : readPrefs(result.user!.id));
      loadedRef.current = true;
    } catch (error) {
      if (sequence !== refreshSequence.current) return;
      setApiError(error instanceof Error ? error.message : "Could not connect to Commune");
      if (!loadedRef.current) setAuthStatus("error");
    }
  }, [data?.user.id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (authStatus !== "authenticated") return;
    const onFocus = () => { void refresh(); };
    const onVisible = () => { if (document.visibilityState === "visible") void refresh(); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    const timer = window.setInterval(() => { void refresh(); }, 20_000);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(timer);
    };
  }, [authStatus, refresh]);

  const mutate = useCallback(async <T,>(action: () => Promise<T>): Promise<T> => {
    try {
      setApiError(null);
      return await action();
    } catch (error) {
      const message = error instanceof Error ? error.message : "The action could not be saved";
      setApiError(message);
      throw error;
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
    setData(null);
    setHubId("");
    setWindowId(null);
    setAuthStatus("guest");
    setLocation(keepSearch("/login"));
  }), [mutate, setLocation]);

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
  const places: LiveHub[] = data ? data.communes
    .map((commune) => data.snapshots[commune.id])
    .filter((snapshot): snapshot is Snapshot => !!snapshot)
    .map((snapshot) => hubFromSnapshot(snapshot, data.user, prefs.hubPhotos[snapshot.commune.id])) : [];
  const hub = places.find((place) => place.id === hubId) ?? places[0] ?? emptyHub();
  const activeId = hub.id;
  const snapshot = data?.snapshots[activeId];
  const expenses = snapshot && data ? expenseRows(snapshot, data.user.id) : [];
  const selectedExpense = expenses.find((row) => row.id === selectedExpenseId) ?? expenses[0] ?? null;
  const lastExpense = selectedExpense
    ? { name: selectedExpense.name, amount: selectedExpense.amount, paidBy: selectedExpense.paidBy }
    : null;
  const empty = !!session?.hasHubs && expenses.length === 0;
  const notes: Record<string, NoteCard> = Object.fromEntries(
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
  const reminderTargets = snapshot?.reminderTargets ?? [];
  const notifications = snapshot?.notifications ?? [];
  const you = {
    name: data?.user.name ?? "",
    email: data?.user.email ?? "",
    initials: data ? initialsOf(data.user.name) : "",
    photo: prefs.avatar,
  };

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
    const currency = (input.currency.match(/GBP|USD|EUR/)?.[0] ?? "GBP") as CurrencyCode;
    const kind = input.type.toLowerCase();
    const result = await post<{ id: string }>("/communes", {
      name: input.name.trim(), kind, currency,
      ...locationForKind(input),
    });
    await refresh();
    setHubId(result.id);
    savePrefs({ activeHubId: result.id });
    setMoreOpen(false);
    setLocation(keepSearch(SCREEN_PATH["hub-empty"]));
    setWindowId(opts?.openExpense ? "add-expense" : null);
    return result.id;
  }), [mutate, refresh, savePrefs, setLocation]);

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
    await refresh();
  }), [activeId, mutate, refresh]);

  const recordExpense = useCallback((input: CreateExpenseInput) => mutate(async () => {
    if (!activeId) throw new Error("Create or join a commune first");
    if (!data) throw new Error("Sign in first");
    if (!input.shareUserIds.includes(data.user.id)) {
      throw new Error("Include yourself in an expense you paid.");
    }
    const shares = equalShares(input.amountMinor, input.shareUserIds);
    const result = await post<{ id: string }>(`/communes/${encodeURIComponent(activeId)}/expenses`, {
      title: input.name.trim(),
      amountMinor: input.amountMinor,
      shares,
      dueOn: input.dueOn ?? null,
      ...(input.category ? { category: input.category } : {}),
    });
    await refresh();
    setSelectedExpenseId(result.id);
    return result.id;
  }), [activeId, data, mutate, refresh]);

  const confirmExpenseShare = useCallback((shareId: string) => mutate(async () => {
    await post(`/shares/${encodeURIComponent(shareId)}/confirm`, {});
    await refresh();
  }), [mutate, refresh]);
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
    await refresh();
  }), [data?.user.id, expenses, mutate, refresh]);

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
    await refresh();
    return result.id;
  }), [activeId, mutate, refresh]);
  const pledgeFund = useCallback((fundId: string, amountMinor: number, dueOn: string) => mutate(async () => {
    const result = await post<{ id: string }>(`/funds/${encodeURIComponent(fundId)}/pledges`, { amountMinor, dueOn });
    await refresh();
    return result.id;
  }), [mutate, refresh]);
  const recordFundContribution = useCallback((commitmentId: string, amountMinor: number) => mutate(async () => {
    const result = await post<{ id: string }>(`/commitments/${encodeURIComponent(commitmentId)}/contributions`, { amountMinor });
    await refresh();
    return result.id;
  }), [mutate, refresh]);
  const sendReminder = useCallback((kind: "nudge" | "chase", sourceId: string) => mutate(async () => {
    await post("/reminders", { kind, sourceId });
    await refresh();
  }), [mutate, refresh]);
  const markNotificationRead = useCallback((id: string) => mutate(async () => {
    await post(`/notifications/${encodeURIComponent(id)}/read`, {});
    await refresh();
  }), [mutate, refresh]);

  const addNote = useCallback((card: NoteCard & { id: string }) => mutate(async () => {
    if (!activeId) throw new Error("Choose a commune first");
    const { id: _draftId, ...payload } = card;
    const result = await post<{ id: string }>(`/communes/${encodeURIComponent(activeId)}/notes`, payload);
    await refresh();
    setNoteKey(result.id);
    return result.id;
  }), [activeId, mutate, refresh]);
  const addOperation = useCallback((item: NewOperation) => mutate(async () => {
    if (!activeId) throw new Error("Choose a commune first");
    const result = await post<{ id: string }>(`/communes/${encodeURIComponent(activeId)}/operations`, operationPayload(item));
    await refresh();
    setOperationKey(result.id);
    setOperationDate(item.date);
    return result.id;
  }), [activeId, mutate, refresh]);
  const updateOperation = useCallback((id: string, item: NewOperation) => mutate(async () => {
    const existing = operations.find((row) => row.id === id);
    if (!existing) throw new Error("Schedule item not found");
    await api(`/operations/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: JSON.stringify(operationPayload({ ...existing, ...item })),
    });
    await refresh();
    setOperationDate(item.date);
    if (item.time) setOperationTime(item.time);
  }), [mutate, operations, refresh]);
  const toggleOperation = useCallback((id: string) => mutate(async () => {
    const item = operations.find((row) => row.id === id);
    if (!item) throw new Error("Schedule item not found");
    const completing = item.status === "open";
    const today = todayIso();
    const next: OperationItem = !completing
      ? { ...item, status: "open" }
      : item.repeat !== "none"
        ? {
            ...item,
            status: "open",
            date: nextOccurrence(item.date, item.repeat, today),
            assignee: item.rotation?.length ? nextInRotation(item.rotation, item.assignee) : item.assignee,
            lastDone: item.assignee ? { by: item.assignee, date: today } : item.lastDone,
          }
        : { ...item, status: "done", lastDone: { by: data?.user.name ?? "Member", date: today } };
    await api(`/operations/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(operationPayload(next)) });
    await refresh();
  }), [data?.user.name, mutate, operations, refresh]);
  const skipOperation = useCallback((id: string) => mutate(async () => {
    const item = operations.find((row) => row.id === id);
    if (!item) throw new Error("Schedule item not found");
    const from = item.date < todayIso() ? todayIso() : item.date;
    await api(`/operations/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: JSON.stringify(operationPayload({ ...item, date: addDays(from, 7) })),
    });
    await refresh();
  }), [mutate, operations, refresh]);
  const removeOperation = useCallback((id: string) => mutate(async () => {
    await api(`/operations/${encodeURIComponent(id)}`, { method: "DELETE" });
    await refresh();
    setWindowId(null);
  }), [mutate, refresh]);

  const go = useCallback((target: GoTarget, opts?: GoOpts) => {
    const nextHubId = opts?.hub ?? activeId;
    if (opts?.hub && places.some((place) => place.id === opts.hub)) {
      setHubId(opts.hub);
      savePrefs({ activeHubId: opts.hub });
    }
    if (opts?.expense) setSelectedExpenseId(opts.expense);
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
    const nextSnapshot = data?.snapshots[nextHubId];
    const nextEmpty = !nextSnapshot?.expenses.length;
    const nextHub = places.find((place) => place.id === nextHubId);
    const hasSettlement = !!nextHub?.moves.length;
    if (isWindowId(target)) {
      const stay = target === "add-expense" &&
        (screen === "hub-empty" || screen === "home-empty" || screen === "expenses-empty");
      if (!stay) {
        const page = WINDOW_PAGE[target];
        if (page) {
          let dest: ScreenId = page;
          if (page === "expenses" && nextEmpty && target === "add-expense") dest = "expenses-empty";
          if (page === "settle" && !hasSettlement) dest = "settle-even";
          if (dest !== screen) setLocation(keepSearch(SCREEN_PATH[dest]));
        }
      }
      setWindowId(target);
      return;
    }
    let dest: ScreenId = target;
    if (target === "home" && !session?.hasHubs) dest = "home-empty";
    if (target === "hub" && (nextEmpty || !session?.hasHubs)) dest = "hub-empty";
    if (target === "expenses" && (nextEmpty || !session?.hasHubs)) dest = "expenses-empty";
    if (target === "settle" && (!hasSettlement || !session?.hasHubs)) dest = "settle-even";
    setWindowId(opts?.window ?? null);
    setLocation(keepSearch(SCREEN_PATH[dest]));
  }, [activeId, data, places, savePrefs, screen, session?.hasHubs, setLocation]);

  const pageTitle = windowId
    ? windowId === "expense" || windowId === "expense-paid"
      ? selectedExpense?.name ?? "Expense"
      : windowId === "note"
        ? notes[noteKey]?.title ?? "Note"
        : windowId === "operation" || windowId === "operation-edit"
          ? selectedOperation?.title ?? "Schedule item"
          : PAGE_TITLES[windowId] ?? PAGE_TITLES[screen]
    : PAGE_TITLES[screen] ?? "Home";
  const outstandingShareCount = places.reduce((sum, place) => sum + place.moves.length, 0);
  const pageLede = windowId
    ? windowId === "expense" || windowId === "expense-paid"
      ? selectedExpense
        ? `${selectedExpense.paidBy} paid ${selectedExpense.amount}. ${selectedExpense.open ? "Some shares remain open." : "All shares are settled."}`
        : "Expense"
      : windowId === "add-expense"
        ? hub.members.length === 1
          ? "Just you for now. Add an expense to start the ledger."
          : `Split an expense among ${hub.members.length} members.`
        : PAGE_LEDES[windowId] ?? ""
    : screen === "home" || screen === "communes"
      ? session?.hasHubs
        ? `${places.length} ${places.length === 1 ? "commune" : "communes"} · ${outstandingShareCount} outstanding ${outstandingShareCount === 1 ? "share" : "shares"} involving you`
        : PAGE_LEDES["home-empty"]
      : screen === "expenses" || screen === "expenses-empty"
        ? `Everything ${hub.name} has shared.`
        : screen === "settle" || screen === "settle-even"
          ? hub.oweCopy
          : hub.status;

  return <Ctx.Provider value={{
    authStatus, apiError, clearApiError: () => setApiError(null), refresh,
    signInWithPassword, signInWithGoogle, signUpWithPassword, verifyEmailCode, session, screen, hubId: activeId,
    hub, places, emptyHub: empty, window: windowId, moreOpen,
    navMode: prefs.navMode, noteKey, notes, operationKey, operationDate,
    operationTime, operationsByHub, operations, selectedOperation,
    dark: prefs.dark, noticesOn: prefs.noticesOn, currency: prefs.currency,
    searchQuery, invites: data?.invites[activeId] ?? [], payMethods: prefs.payMethods, native, you,
    lastExpense, expenses, selectedExpense, createdExpenses: expenses,
    funds, reminderTargets, notifications, signOut, go,
    closeWindow: () => setWindowId(null), setMoreOpen,
    setNavMode: (navMode) => savePrefs({ navMode }),
    setDark: (dark) => savePrefs({ dark }),
    setNoticesOn: (noticesOn) => savePrefs({ noticesOn }),
    setCurrency: (currency) => savePrefs({ currency }),
    setSearchQuery, savePayMethod, setHubPhoto, setAvatar, addNote,
    addOperation, updateOperation, toggleOperation, skipOperation,
    removeOperation, createHub, updateCommune, recordExpense, confirmExpenseShare,
    markExpensePaid, createInvite, revokeInvite, previewInvite, acceptInvite, createFund,
    pledgeFund, recordFundContribution, sendReminder, markNotificationRead,
    pageTitle, pageLede,
  }}>{children}</Ctx.Provider>;
}

export function useApp(): AppState {
  const context = useContext(Ctx);
  if (!context) throw new Error("useApp must be used inside AppProvider");
  return context;
}

export type { CurrencyCode, LiveExpenseRow, LiveHub, ReminderTarget, Notification, Fund };
