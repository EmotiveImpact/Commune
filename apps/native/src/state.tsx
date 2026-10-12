import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { type Backend, serverBackend } from "./lib/backend";
import { demoBackend } from "./lib/demo";
import {
  feed, needs, oweTotals, owedTotals, recorded, settle, waiting,
  type FeedItem, type Need, type Recorded, type Settle, type Totals, type Waiting,
} from "./lib/derive";
import { requestId, todayIso } from "./lib/format";
import type { PayLink, PayLinkInput, PayProvider } from "./lib/payLinks";
import type { Commune, Snapshot, User } from "./lib/types";

/**
 * Where the app gets its data. EXPO_PUBLIC_COMMUNE_API names a server that
 * speaks the local API's routes ("same-origin" for a web build served next
 * to it). Without one the app runs on Maya's demo data, on the phone only.
 */
export function chooseBackend(): Backend {
  const base = process.env.EXPO_PUBLIC_COMMUNE_API?.trim();
  return base ? serverBackend(base) : demoBackend();
}

type Status = "starting" | "signed-out" | "loading" | "ready" | "error";

type App = {
  backend: Backend;
  status: Status;
  error: string;
  user: User | null;
  today: string;
  communes: Commune[];
  snapshots: Snapshot[];
  current: Snapshot | undefined;
  setCurrent(communeId: string): void;
  snapshotOf(communeId: string): Snapshot | undefined;
  needs: Need[];
  waiting: Waiting[];
  recorded: Recorded[];
  settle: Settle;
  owe: Totals;
  owed: Totals;
  feed: FeedItem[];
  refresh(): Promise<void>;
  signIn(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  reportPayment(communeId: string, shareId: string, amountMinor: number, sentOn: string, reference: string | null): Promise<void>;
  resolveReport(communeId: string, reportId: string, decision: "confirm" | "decline", note?: string): Promise<void>;
  withdrawReport(communeId: string, reportId: string): Promise<void>;
  completeTask(communeId: string, operationId: string, expectedDate: string): Promise<void>;
  addExpense(communeId: string, input: Parameters<Backend["addExpense"]>[1]): Promise<void>;
  nudge(communeId: string, shareId: string): Promise<void>;
  /** Marks what you've now seen as read, so the bell stops showing new. */
  markAllRead(): Promise<void>;
  myPayLinks: PayLink[] | null;
  loadMyPayLinks(): Promise<void>;
  savePayLink(provider: PayProvider, input: PayLinkInput): Promise<void>;
  removePayLink(provider: PayProvider): Promise<void>;
};

const Context = createContext<App | null>(null);

export function AppProvider({ children, backend: given }: { children: ReactNode; backend?: Backend }) {
  const backend = useMemo(() => given ?? chooseBackend(), [given]);
  const [status, setStatus] = useState<Status>("starting");
  const [error, setError] = useState("");
  const [user, setUser] = useState<User | null>(null);
  const [communes, setCommunes] = useState<Commune[]>([]);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [myPayLinks, setMyPayLinks] = useState<PayLink[] | null>(null);
  const [today, setToday] = useState(todayIso());
  const userRef = useRef<User | null>(null);

  const loadAll = useCallback(async (viewer: User) => {
    setStatus((value) => (value === "ready" ? value : "loading"));
    const list = await backend.communes();
    const loaded = await Promise.all(list.map((commune) => backend.snapshot(commune)));
    setCommunes(list);
    setSnapshots(loaded);
    setToday(todayIso());
    setCurrentId((value) => (value && list.some((commune) => commune.id === value) ? value : list[0]?.id ?? null));
    userRef.current = viewer;
    setStatus("ready");
  }, [backend]);

  const refresh = useCallback(async () => {
    try {
      setError("");
      const viewer = await backend.me();
      setUser(viewer);
      if (!viewer) { setStatus("signed-out"); return; }
      await loadAll(viewer);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Something went wrong.");
      setStatus((value) => (value === "ready" ? value : "error"));
    }
  }, [backend, loadAll]);

  useEffect(() => { void refresh(); }, [refresh]);

  // A command changes one commune; reload just that one.
  const reload = useCallback(async (communeId: string) => {
    const commune = communes.find((item) => item.id === communeId);
    if (!commune) return;
    const fresh = await backend.snapshot(commune);
    setSnapshots((list) => list.map((item) => (item.commune.id === communeId ? fresh : item)));
  }, [backend, communes]);

  // Kept stable so screens can load it from an effect without looping.
  const loadMyPayLinks = useCallback(async () => { setMyPayLinks(await backend.myPayLinks()); }, [backend]);

  const value = useMemo<App>(() => {
    const viewerId = user?.id ?? "";
    const owing = needs(snapshots, viewerId, today);
    const owed = waiting(snapshots, viewerId, today);
    return {
      backend, status, error, user, today, communes, snapshots,
      current: snapshots.find((item) => item.commune.id === currentId) ?? snapshots[0],
      setCurrent: setCurrentId,
      snapshotOf: (communeId) => snapshots.find((item) => item.commune.id === communeId),
      needs: owing,
      waiting: owed,
      recorded: recorded(snapshots, viewerId),
      settle: settle(owing, owed),
      owe: oweTotals(owing),
      owed: owedTotals(owed),
      feed: feed(snapshots, viewerId),
      refresh,
      async signIn(email, password) {
        setError("");
        const viewer = await backend.signIn(email, password);
        setUser(viewer);
        await loadAll(viewer);
      },
      async signOut() {
        await backend.signOut();
        setUser(null); setCommunes([]); setSnapshots([]); setMyPayLinks(null); setCurrentId(null);
        setStatus("signed-out");
      },
      async reportPayment(communeId, shareId, amountMinor, sentOn, reference) {
        await backend.reportPayment(shareId, { amountMinor, sentOn, reference, requestId: requestId() });
        await reload(communeId);
      },
      async resolveReport(communeId, reportId, decision, note) {
        await backend.resolveReport(reportId, decision, requestId(), note);
        await reload(communeId);
      },
      async withdrawReport(communeId, reportId) {
        await backend.withdrawReport(reportId);
        await reload(communeId);
      },
      async completeTask(communeId, operationId, expectedDate) {
        await backend.completeTask(operationId, { expectedDate, today: todayIso(), requestId: requestId() });
        await reload(communeId);
      },
      async addExpense(communeId, input) {
        await backend.addExpense(communeId, input);
        await reload(communeId);
      },
      async nudge(communeId, shareId) {
        await backend.nudge(shareId, requestId());
        await reload(communeId);
      },
      async markAllRead() {
        const unread = snapshots.flatMap((item) => item.notifications.filter((note) => !note.readAt).map((note) => ({ communeId: item.commune.id, id: note.id })));
        if (!unread.length) return;
        for (const note of unread) await backend.markRead(note.id);
        await Promise.all([...new Set(unread.map((note) => note.communeId))].map((communeId) => reload(communeId)));
      },
      myPayLinks,
      loadMyPayLinks,
      async savePayLink(provider, input) {
        setMyPayLinks(await backend.savePayLink(provider, input));
        await Promise.all(snapshots.map((item) => reload(item.commune.id)));
      },
      async removePayLink(provider) {
        setMyPayLinks(await backend.removePayLink(provider));
        await Promise.all(snapshots.map((item) => reload(item.commune.id)));
      },
    };
  }, [backend, status, error, user, today, communes, snapshots, currentId, myPayLinks, refresh, loadAll, reload, loadMyPayLinks]);

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useApp(): App {
  const value = useContext(Context);
  if (!value) throw new Error("useApp needs AppProvider");
  return value;
}

/** A plain message from any failure, for showing under a button. */
export function failure(cause: unknown, fallback: string): string {
  return cause instanceof Error && cause.message ? cause.message : fallback;
}
