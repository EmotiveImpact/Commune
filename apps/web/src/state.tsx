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
  isWindowId,
  type Hub,
  type HubId,
  type NoteCard,
  type ScreenId,
  type WindowId,
} from "./data/household";

const SESSION_KEY = "commune.session";
const NAV_KEY = "commune.nav-mode";

export type Session = {
  name: string;
  email: string;
};

export type NavMode = "basic" | "advanced";

export type GoTarget = ScreenId | WindowId | "login" | "signup" | "forgot" | "invite" | "onboard";

type AppState = {
  session: Session | null;
  screen: ScreenId;
  hubId: HubId;
  hub: Hub;
  window: WindowId | null;
  moreOpen: boolean;
  navMode: NavMode;
  noteKey: string;
  notes: Record<string, NoteCard>;
  dark: boolean;
  noticesOn: boolean;
  native: boolean;
  signIn: (session: Session) => void;
  signOut: () => void;
  go: (target: GoTarget, opts?: { hub?: HubId; note?: string }) => void;
  closeWindow: () => void;
  setMoreOpen: (open: boolean) => void;
  setNavMode: (mode: NavMode) => void;
  setDark: (on: boolean) => void;
  setNoticesOn: (on: boolean) => void;
  addNote: (card: NoteCard & { id: string }) => void;
  pageTitle: string;
  pageLede: string;
};

const Ctx = createContext<AppState | null>(null);

function readSession(): Session | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Session;
    if (!parsed.email || !parsed.name) return null;
    return parsed;
  } catch {
    return null;
  }
}

function authPath(target: string): string {
  if (target === "login") return "/login";
  if (target === "signup") return "/signup";
  if (target === "forgot") return "/forgot-password";
  if (target === "invite") return "/invite";
  if (target === "onboard") return "/onboard";
  return "/";
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [location, setLocation] = useLocation();
  const screen: ScreenId = PATH_SCREEN[location] ?? "home";
  const [session, setSession] = useState<Session | null>(() =>
    typeof window === "undefined" ? null : readSession(),
  );
  const [hubId, setHubId] = useState<HubId>("park");
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
  const [native, setNative] = useState(() => {
    if (typeof window === "undefined") return false;
    const params = new URLSearchParams(window.location.search);
    return params.get("native") === "1" || window.matchMedia("(max-width: 560px)").matches;
  });

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 560px)");
    const onChange = () => {
      const params = new URLSearchParams(window.location.search);
      setNative(params.get("native") === "1" || mq.matches);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const hub = HUBS[hubId];

  const signIn = useCallback((next: Session) => {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(next));
    setSession(next);
  }, []);

  const signOut = useCallback(() => {
    sessionStorage.removeItem(SESSION_KEY);
    setSession(null);
    setLocation("/login");
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

  const go = useCallback(
    (target: GoTarget, opts?: { hub?: HubId; note?: string }) => {
      if (opts?.hub) setHubId(opts.hub);
      if (opts?.note) setNoteKey(opts.note);
      setMoreOpen(false);

      if (target === "login" || target === "signup" || target === "forgot" || target === "invite" || target === "onboard") {
        setWindowId(null);
        setLocation(authPath(target));
        return;
      }

      if (isWindowId(target)) {
        const page = WINDOW_PAGE[target];
        if (page && page !== screen) setLocation(SCREEN_PATH[page]);
        setWindowId(target);
        return;
      }

      let next: ScreenId = target;
      if (target === "settle" && (opts?.hub ?? hubId) === "studio") {
        next = "settle-even";
      }
      setWindowId(null);
      setLocation(SCREEN_PATH[next]);
    },
    [hubId, screen, setLocation],
  );

  const pageTitle = windowId
    ? windowId === "note"
      ? notes[noteKey]?.title ?? "Note"
      : PAGE_TITLES[windowId] ?? PAGE_TITLES[screen]
    : PAGE_TITLES[screen] ?? "Home";

  const pageLede = windowId
    ? PAGE_LEDES[windowId] ?? ""
    : PAGE_LEDES[screen] ?? (screen === "home" || screen === "communes" ? HOME_STATUS : hub.status);

  const value = useMemo<AppState>(
    () => ({
      session,
      screen,
      hubId,
      hub,
      window: windowId,
      moreOpen,
      navMode,
      noteKey,
      notes,
      dark,
      noticesOn,
      native,
      signIn,
      signOut,
      go,
      closeWindow,
      setMoreOpen,
      setNavMode,
      setDark,
      setNoticesOn,
      addNote,
      pageTitle,
      pageLede,
    }),
    [
      session,
      screen,
      hubId,
      hub,
      windowId,
      moreOpen,
      navMode,
      noteKey,
      notes,
      dark,
      noticesOn,
      native,
      signIn,
      signOut,
      go,
      closeWindow,
      setNavMode,
      addNote,
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
