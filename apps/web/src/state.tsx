import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useLocation } from "wouter";
import {
  HUBS,
  HOME_STATUS,
  NOTE_CARDS,
  PAGE_LEDES,
  PAGE_TITLES,
  PATH_SCREEN,
  SCREEN_PATH,
  WINDOW_PAGE,
  buildCreatedHub,
  initialsOf,
  isWindowId,
  type CreatedHub,
  type ExpenseRow,
  type Hub,
  type HubId,
  type NoteCard,
  type SampleHubId,
  type ScreenId,
  type WindowId,
} from "./data/household";
import { isNativeNow, keepSearch, pathOnly } from "./nav";

const SESSION_KEY = "commune.session";
const NAV_KEY = "commune.nav-mode";

export type Seed = "maya" | "new";

export type Session = {
  name: string;
  email: string;
  seed: Seed;
  hasHubs: boolean;
  emptyLedger: boolean;
  createdHub?: CreatedHub;
};

export type LastExpense = {
  name: string;
  amount: string;
  paidBy: string;
};

export type NavMode = "basic" | "advanced";

export type GoTarget = ScreenId | WindowId | "login" | "signup" | "forgot" | "invite" | "onboard";

type GoOpts = { hub?: HubId; note?: string; window?: WindowId };

type AppState = {
  session: Session | null;
  screen: ScreenId;
  hubId: HubId;
  hub: Hub;
  places: Hub[];
  emptyHub: boolean;
  window: WindowId | null;
  moreOpen: boolean;
  navMode: NavMode;
  noteKey: string;
  notes: Record<string, NoteCard>;
  dark: boolean;
  noticesOn: boolean;
  native: boolean;
  you: { name: string; email: string; initials: string };
  lastExpense: LastExpense | null;
  createdExpenses: ExpenseRow[];
  signIn: (session: Partial<Session> & Pick<Session, "name" | "email">) => void;
  signOut: () => void;
  go: (target: GoTarget, opts?: GoOpts) => void;
  closeWindow: () => void;
  setMoreOpen: (open: boolean) => void;
  setNavMode: (mode: NavMode) => void;
  setDark: (on: boolean) => void;
  setNoticesOn: (on: boolean) => void;
  addNote: (card: NoteCard & { id: string }) => void;
  createHub: (input: CreatedHub, opts?: { openExpense?: boolean }) => void;
  recordExpense: (row: LastExpense) => void;
  pageTitle: string;
  pageLede: string;
};

const Ctx = createContext<AppState | null>(null);

function isCreatedHub(value: unknown): value is CreatedHub {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.name === "string" &&
    (v.type === "Household" || v.type === "Workspace" || v.type === "Trip") &&
    typeof v.currency === "string"
  );
}

export function normalizeSession(raw: unknown): Session | null {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as Record<string, unknown>;
  if (typeof p.email !== "string" || typeof p.name !== "string") return null;
  const seed: Seed = p.seed === "new" ? "new" : "maya";
  return {
    name: p.name,
    email: p.email,
    seed,
    hasHubs: seed === "new" ? Boolean(p.hasHubs) : p.hasHubs !== false,
    emptyLedger: Boolean(p.emptyLedger),
    createdHub: isCreatedHub(p.createdHub) ? p.createdHub : undefined,
  };
}

function readSession(): Session | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return normalizeSession(JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}

function writeSession(next: Session) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(next));
}

function authPath(target: string): string {
  if (target === "login") return "/login";
  if (target === "signup") return "/signup";
  if (target === "forgot") return "/forgot-password";
  if (target === "invite") return "/invite";
  if (target === "onboard") return "/onboard";
  return "/";
}

function resolveHub(id: HubId, session: Session | null): Hub {
  if (id === "created") {
    return buildCreatedHub({
      name: session?.createdHub?.name ?? "New commune",
      type: session?.createdHub?.type ?? "Household",
      ownerName: session?.name ?? "Maya Chen",
    });
  }
  return HUBS[id];
}

function placesFor(session: Session | null): Hub[] {
  if (!session?.hasHubs) return [];
  const created = session.createdHub
    ? buildCreatedHub({
        name: session.createdHub.name,
        type: session.createdHub.type,
        ownerName: session.name,
      })
    : null;
  if (session.seed === "new") return created ? [created] : [];
  const list: Hub[] = [HUBS.park, HUBS.studio, HUBS.lisbon];
  if (created) list.push(created);
  return list;
}

function isEmptyHub(id: HubId, session: Session | null): boolean {
  return id === "created" && Boolean(session?.emptyLedger);
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [location, setLocation] = useLocation();
  const screen: ScreenId = PATH_SCREEN[pathOnly(location)] ?? "home";
  const [session, setSession] = useState<Session | null>(() =>
    typeof window === "undefined" ? null : readSession(),
  );
  const [hubId, setHubId] = useState<HubId>(() => {
    if (typeof window === "undefined") return "park";
    const existing = readSession();
    return existing?.seed === "new" ? "created" : "park";
  });
  const [windowId, setWindowId] = useState<WindowId | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [navMode, setNavModeState] = useState<NavMode>(() => {
    if (typeof window === "undefined") return "basic";
    return sessionStorage.getItem(NAV_KEY) === "advanced" ? "advanced" : "basic";
  });
  const [noteKey, setNoteKey] = useState("wifi");
  const [notes, setNotes] = useState<Record<string, NoteCard>>(NOTE_CARDS);
  const [dark, setDark] = useState(false);
  const [noticesOn, setNoticesOn] = useState(true);
  const [native, setNative] = useState(() => isNativeNow());
  const [lastExpense, setLastExpense] = useState<LastExpense | null>(null);
  const [createdExpenses, setCreatedExpenses] = useState<ExpenseRow[]>([]);

  const persist = useCallback((next: Session) => {
    writeSession(next);
    setSession(next);
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 560px)");
    const onChange = () => setNative(isNativeNow());
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    setNative(isNativeNow());
  }, [location]);

  const hub = resolveHub(hubId, session);
  const places = placesFor(session);
  const emptyHub = isEmptyHub(hubId, session);
  const you = {
    name: session?.name ?? "Maya Chen",
    email: session?.email ?? "maya@14park.st",
    initials: initialsOf(session?.name ?? "Maya Chen"),
  };

  const signIn = useCallback(
    (next: Partial<Session> & Pick<Session, "name" | "email">) => {
      const full: Session = {
        seed: "maya",
        hasHubs: true,
        emptyLedger: false,
        ...next,
        name: next.name,
        email: next.email,
      };
      persist(full);
      setHubId(full.seed === "new" ? "created" : "park");
      if (full.seed === "maya") {
        setCreatedExpenses([]);
        setLastExpense(null);
      }
    },
    [persist],
  );

  const signOut = useCallback(() => {
    sessionStorage.removeItem(SESSION_KEY);
    setSession(null);
    setWindowId(null);
    setHubId("park");
    setCreatedExpenses([]);
    setLastExpense(null);
    setLocation(keepSearch("/login"));
  }, [setLocation]);

  const closeWindow = useCallback(() => setWindowId(null), []);

  const setNavMode = useCallback((mode: NavMode) => {
    sessionStorage.setItem(NAV_KEY, mode);
    setNavModeState(mode);
  }, []);

  const addNote = useCallback((card: NoteCard & { id: string }) => {
    setNotes((prev) => ({ ...prev, [card.id]: card }));
    setNoteKey(card.id);
  }, []);

  const createHub = useCallback(
    (input: CreatedHub, opts?: { openExpense?: boolean }) => {
      const base: Session = session ?? {
        name: "Maya Chen",
        email: "maya@14park.st",
        seed: "new",
        hasHubs: false,
        emptyLedger: true,
      };
      const next: Session = { ...base, hasHubs: true, emptyLedger: true, createdHub: input };
      persist(next);
      setHubId("created");
      setMoreOpen(false);
      setLocation(keepSearch(SCREEN_PATH["hub-empty"]));
      setWindowId(opts?.openExpense ? "add-expense" : null);
    },
    [persist, session, setLocation],
  );

  const recordExpense = useCallback(
    (row: LastExpense) => {
      if (session) persist({ ...session, emptyLedger: false });
      setLastExpense(row);
      setCreatedExpenses((prev) => [
        {
          name: row.name,
          category: "Other",
          paidBy: row.paidBy,
          due: "Today",
          status: "open",
          statusLabel: "Open",
          amount: row.amount,
          action: "choose",
          open: true,
        },
        ...prev.filter((item) => item.name !== row.name),
      ]);
    },
    [persist, session],
  );

  const go = useCallback(
    (target: GoTarget, opts?: GoOpts) => {
      const nextHub = opts?.hub ?? hubId;
      if (opts?.hub) setHubId(opts.hub);
      if (opts?.note) setNoteKey(opts.note);
      setMoreOpen(false);

      if (target === "login" || target === "signup" || target === "forgot" || target === "invite" || target === "onboard") {
        setWindowId(null);
        setLocation(keepSearch(authPath(target)));
        return;
      }

      const empty = isEmptyHub(nextHub, session);

      if (isWindowId(target)) {
        const stay =
          target === "add-expense" &&
          (screen === "hub-empty" || screen === "home-empty" || screen === "expenses-empty");
        if (!stay) {
          const page = WINDOW_PAGE[target];
          if (page) {
            let dest: ScreenId = page;
            if (page === "expenses" && empty && target === "add-expense") dest = "expenses-empty";
            if (page === "settle" && (nextHub === "studio" || nextHub === "created")) dest = "settle-even";
            if (dest !== screen) setLocation(keepSearch(SCREEN_PATH[dest]));
          }
        }
        setWindowId(target);
        return;
      }

      let next: ScreenId = target;
      if (target === "home" && !session?.hasHubs) next = "home-empty";
      if (target === "hub" && (empty || !session?.hasHubs)) next = "hub-empty";
      if (target === "expenses" && (empty || !session?.hasHubs)) next = "expenses-empty";
      if (target === "settle" && (nextHub === "studio" || nextHub === "created" || !session?.hasHubs)) {
        next = "settle-even";
      }
      setWindowId(opts?.window ?? null);
      setLocation(keepSearch(SCREEN_PATH[next]));
      if (opts?.window) setWindowId(opts.window);
    },
    [hubId, screen, session, setLocation],
  );

  const pageTitle = windowId
    ? windowId === "note"
      ? notes[noteKey]?.title ?? "Note"
      : PAGE_TITLES[windowId] ?? PAGE_TITLES[screen]
    : PAGE_TITLES[screen] ?? "Home";

  const pageLede = windowId
    ? PAGE_LEDES[windowId] ?? ""
    : screen === "home" || screen === "communes"
      ? session?.seed === "new"
        ? session.hasHubs
          ? "1 space · nothing shared yet"
          : PAGE_LEDES["home-empty"]
        : HOME_STATUS
      : PAGE_LEDES[screen] ?? hub.status;

  const value = useMemo<AppState>(
    () => ({
      session,
      screen,
      hubId,
      hub,
      places,
      emptyHub,
      window: windowId,
      moreOpen,
      navMode,
      noteKey,
      notes,
      dark,
      noticesOn,
      native,
      you,
      lastExpense,
      createdExpenses,
      signIn,
      signOut,
      go,
      closeWindow,
      setMoreOpen,
      setNavMode,
      setDark,
      setNoticesOn,
      addNote,
      createHub,
      recordExpense,
      pageTitle,
      pageLede,
    }),
    [
      session,
      screen,
      hubId,
      hub,
      places,
      emptyHub,
      windowId,
      moreOpen,
      navMode,
      noteKey,
      notes,
      dark,
      noticesOn,
      native,
      you,
      lastExpense,
      createdExpenses,
      signIn,
      signOut,
      go,
      closeWindow,
      setNavMode,
      addNote,
      createHub,
      recordExpense,
      pageTitle,
      pageLede,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useApp must be used inside AppProvider");
  return ctx;
}

export type { SampleHubId };
