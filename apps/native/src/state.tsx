import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Linking, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import { type Backend, serverBackend } from "./lib/backend";
import { demoBackend } from "./lib/demo";
import {
  feed, needs, oweTotals, owedTotals, recorded, settle, waiting,
  type FeedItem, type Need, type Recorded, type Settle, type Totals, type Waiting,
} from "./lib/derive";
import { requestId, todayIso } from "./lib/format";
import { OUTBOX_STORE, enqueue, flush, isNetworkError, parseOutbox, type Queued } from "./lib/outbox";
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
  /** "queued" when there is no signal: it is saved on the phone and sends when back online. */
  reportPayment(communeId: string, shareId: string, amountMinor: number, sentOn: string, reference: string | null, label?: string): Promise<"sent" | "queued">;
  resolveReport(communeId: string, reportId: string, decision: "confirm" | "decline", note?: string): Promise<void>;
  withdrawReport(communeId: string, reportId: string): Promise<void>;
  /** Returns the completion's id, for Undo. */
  completeTask(communeId: string, operationId: string, expectedDate: string, doneBy?: "me" | "assignee"): Promise<string | null>;
  undoCompletion(communeId: string, occurrenceId: string): Promise<void>;
  /** "I'll do it" on a chore nobody has yet. */
  claimTask(communeId: string, operationId: string, expectedDate: string): Promise<void>;
  addExpense(communeId: string, input: Parameters<Backend["addExpense"]>[1]): Promise<"sent" | "queued">;
  /** False with no signal. */
  online: boolean;
  /** Records made offline, waiting to send. */
  outbox: Queued[];
  /** True while the outbox is sending. */
  sending: boolean;
  nudge(communeId: string, shareId: string): Promise<void>;
  /** Marks what you've now seen as read, so the bell stops showing new. */
  markAllRead(): Promise<void>;
  myPayLinks: PayLink[] | null;
  loadMyPayLinks(): Promise<void>;
  savePayLink(provider: PayProvider, input: PayLinkInput): Promise<void>;
  removePayLink(provider: PayProvider): Promise<void>;
  setPreferredPayLink(provider: PayProvider | null): Promise<void>;
  /**
   * Opens one of their apps to pay a share, remembering it, so that coming
   * back to Commune asks whether the payment went (see PayReturn).
   */
  openPayLink(shareId: string, provider: string, href: string): void;
  /** The share whose payee's app was opened last, until it is asked about. */
  payingAway: { shareId: string; provider: string } | null;
  clearPayingAway(): void;
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
  const [payingAway, setPayingAway] = useState<{ shareId: string; provider: string } | null>(null);
  const [myPayLinks, setMyPayLinks] = useState<PayLink[] | null>(null);
  const [today, setToday] = useState(todayIso());
  const userRef = useRef<User | null>(null);
  const [online, setOnline] = useState(true);
  const [outbox, setOutbox] = useState<Queued[]>([]);
  const [sending, setSending] = useState(false);
  const outboxRef = useRef<Queued[]>([]);
  const keepOutbox = useCallback((next: Queued[]) => {
    outboxRef.current = next;
    setOutbox(next);
    AsyncStorage.setItem(OUTBOX_STORE, JSON.stringify(next)).catch(() => undefined);
  }, []);

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

  // Records saved with no signal survive the app closing.
  useEffect(() => {
    AsyncStorage.getItem(OUTBOX_STORE).then((raw) => {
      const saved = parseOutbox(raw);
      if (saved.length) { outboxRef.current = saved; setOutbox(saved); }
    }).catch(() => undefined);
  }, []);

  useEffect(() => {
    const stop = NetInfo.addEventListener((state) => {
      setOnline(state.isConnected !== false && state.isInternetReachable !== false);
    });
    // In a browser NetInfo only hears connection-type changes, so also listen for going on and off line.
    if (Platform.OS !== "web" || typeof window === "undefined") return stop;
    const change = () => setOnline(navigator.onLine);
    window.addEventListener("online", change);
    window.addEventListener("offline", change);
    return () => { stop(); window.removeEventListener("online", change); window.removeEventListener("offline", change); };
  }, []);

  // Back online: send what waited, oldest first, each once.
  const flushing = useRef(false);
  useEffect(() => {
    if (!online || !outbox.length || !user || flushing.current) return;
    flushing.current = true;
    setSending(true);
    void flush(outboxRef.current, (item) => item.kind === "report"
      ? backend.reportPayment(item.shareId, item.input)
      : backend.addExpense(item.communeId, item.input)).then(async (result) => {
      const done = new Set([...result.sent, ...result.failed.map((entry) => entry.item)].map((item) => item.id));
      keepOutbox(outboxRef.current.filter((item) => !done.has(item.id)));
      if (result.sent.length || result.failed.length) await refresh();
    }).finally(() => { flushing.current = false; setSending(false); });
  }, [online, outbox, user, backend, keepOutbox, refresh]);

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
      async reportPayment(communeId, shareId, amountMinor, sentOn, reference, label = "") {
        const input = { amountMinor, sentOn, reference, requestId: requestId() };
        const save = () => { keepOutbox(enqueue(outboxRef.current, { id: input.requestId, kind: "report", communeId, shareId, input, label })); return "queued" as const; };
        if (!online) return save();
        try { await backend.reportPayment(shareId, input); } catch (cause) { if (isNetworkError(cause)) return save(); throw cause; }
        await reload(communeId);
        return "sent";
      },
      async resolveReport(communeId, reportId, decision, note) {
        await backend.resolveReport(reportId, decision, requestId(), note);
        await reload(communeId);
      },
      async withdrawReport(communeId, reportId) {
        await backend.withdrawReport(reportId);
        await reload(communeId);
      },
      async completeTask(communeId, operationId, expectedDate, doneBy) {
        const occurrenceId = await backend.completeTask(operationId, { expectedDate, today: todayIso(), requestId: requestId(), ...(doneBy ? { doneBy } : {}) });
        await reload(communeId);
        return occurrenceId;
      },
      async claimTask(communeId, operationId, expectedDate) {
        await backend.claimTask(operationId, { toMemberId: user!.id, expectedDate, today: todayIso(), requestId: requestId() });
        await reload(communeId);
      },
      async undoCompletion(communeId, occurrenceId) {
        await backend.undoCompletion(occurrenceId);
        await reload(communeId);
      },
      async addExpense(communeId, given) {
        const input = { ...given, requestId: given.requestId ?? requestId() };
        const save = () => { keepOutbox(enqueue(outboxRef.current, { id: input.requestId, kind: "expense", communeId, input, label: input.title })); return "queued" as const; };
        if (!online) return save();
        try { await backend.addExpense(communeId, input); } catch (cause) { if (isNetworkError(cause)) return save(); throw cause; }
        await reload(communeId);
        return "sent";
      },
      online,
      outbox,
      sending,
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
      async setPreferredPayLink(provider) {
        setMyPayLinks(await backend.setPreferredPayLink(provider));
        await Promise.all(snapshots.map((item) => reload(item.commune.id)));
      },
      openPayLink(shareId, provider, href) {
        setPayingAway({ shareId, provider });
        void Linking.openURL(href).catch(() => setPayingAway(null));
      },
      payingAway,
      clearPayingAway() { setPayingAway(null); },
    };
  }, [backend, status, error, user, today, communes, snapshots, currentId, myPayLinks, payingAway, refresh, loadAll, reload, loadMyPayLinks, online, outbox, sending, keepOutbox]);

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
