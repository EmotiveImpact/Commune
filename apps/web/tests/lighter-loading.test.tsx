import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { App } from "../src/App";
import { AppProvider, useApp, type AppState } from "../src/state";
import { api, post, loadCommunes, loadSnapshot, ApiError } from "../src/live/api";
import type { Commune, Expense, Snapshot } from "../src/live/model";

vi.mock("../src/live/api", async (importOriginal) => ({
  ...await importOriginal<typeof import("../src/live/api")>(),
  api: vi.fn(), post: vi.fn(), loadCommunes: vi.fn(), loadSnapshot: vi.fn(),
}));

const user = { id: "user-1", name: "Test Person", email: "test@example.test", emailVerified: true };
const housemate = { userId: "user-2", name: "Housemate", role: "member" as const, active: true };
const home: Commune = { id: "home-1", name: "Our home", kind: "household", currency: "GBP", role: "admin", changeMark: "2026-10-08:3:30" };
const trip: Commune = { id: "trip-1", name: "Lisbon trip", kind: "trip", currency: "EUR", role: "member", changeMark: "2026-10-08:2:12" };

// Months are counted in UTC, as the shared records count them.
const today = new Date();
function monthStart(back: number) {
  return new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - back, 1)).toISOString().slice(0, 10);
}
/** The snapshot holds every expense created from the start of last month, and every open one. */
const since = monthStart(1);
function expense(id: string, title: string, back: number, kind: "settled" | "open" | "voided" = "settled"): Expense {
  const at = `${monthStart(back)}T12:00:00.000Z`;
  return {
    id, title, category: "Other", amountMinor: 2000, paidByUserId: user.id, dueOn: null, createdAt: at, version: 1,
    voidedAt: kind === "voided" ? at : null, voidReason: kind === "voided" ? "Entered twice" : null,
    shares: [
      { id: `${id}-own`, userId: user.id, amountMinor: 1000, settledMinor: 1000 },
      { id: `${id}-share`, userId: housemate.userId, amountMinor: 1000, settledMinor: kind === "open" ? 0 : 1000 },
    ],
  };
}
function record(commune: Commune, expenses: Expense[] = [], history = { olderCount: 0, olderVoidedCount: 0 }): Snapshot {
  const { changeMark, ...identity } = commune;
  return {
    commune: identity, members: [{ userId: user.id, name: user.name, role: commune.role, active: true }, housemate],
    expenses, funds: [], notes: [], operations: [], notifications: [], reminderTargets: [], sentReminders: [],
    recurringBills: [], splitTemplates: [], activityEvents: [], expenseHistory: { since, ...history }, changeMark,
  };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((yes) => { resolve = yes; });
  return { promise, resolve };
}

let listed: Commune[];
let records: Record<string, Snapshot>;
let app: AppState;
function Capture() { app = useApp(); return null; }
function mount(path: string) {
  const location = memoryLocation({ path, record: true });
  render(<Router hook={location.hook}><AppProvider><Capture /><App /></AppProvider></Router>);
  return location;
}
const calls = (path: string) => vi.mocked(api).mock.calls.filter(([called]) => called === path).length;
const reads = (id: string, detail?: "summary") =>
  vi.mocked(loadSnapshot).mock.calls.filter(([commune, asked]) => commune.id === id && asked === detail).length;
// Lets every request the app has started finish: the mocks answer at once.
const settle = () => act(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));

beforeEach(() => {
  vi.resetAllMocks();
  sessionStorage.clear();
  listed = [home];
  records = { [home.id]: record(home) };
  vi.mocked(api).mockImplementation(async (path) => {
    if (path === "/auth/me") return { user };
    if (path === "/reminders/usage") return { totalUsed: 0, totalLimit: 60, recipientLimit: 6, recipientUsage: {}, nextSlotAt: null };
    if (path.endsWith("/invites")) return { invites: [] };
    throw new Error(`Unexpected API request ${path}`);
  });
  vi.mocked(post).mockResolvedValue({ ok: true });
  vi.mocked(loadCommunes).mockImplementation(async () => ({ communes: listed.map((commune) => ({ ...commune })) }));
  vi.mocked(loadSnapshot).mockImplementation(async (commune, detail) =>
    detail ? { ...records[commune.id], detail } : records[commune.id]);
});
afterEach(cleanup);

describe("checking for changes", () => {
  let visibility: DocumentVisibilityState;
  beforeEach(() => {
    const now = Date.now();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(now);
    visibility = "visible";
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => visibility });
    vi.spyOn(window, "setInterval");
  });
  afterEach(() => {
    vi.useRealTimers();
    delete (document as unknown as Record<string, unknown>).visibilityState;
  });
  // Minutes pass: the clock moves on and the app's minute timer runs each time.
  async function minutesPass(count = 1) {
    for (let minute = 0; minute < count; minute += 1) {
      vi.advanceTimersByTime(60_000);
      const timer = vi.mocked(window.setInterval).mock.calls.filter(([, delay]) => delay === 60_000).at(-1)?.[0];
      act(() => (timer as () => void)());
      await settle();
    }
  }
  async function started(path = "/hub") {
    mount(path);
    await waitFor(() => expect(calls("/reminders/usage")).toBe(1));
    await settle();
  }

  it("reads only the commune list while nothing has changed", async () => {
    await started();
    expect([calls("/auth/me"), calls(`/communes/${home.id}/invites`), reads(home.id)]).toEqual([1, 1, 1]);
    await minutesPass(3);
    expect(loadCommunes).toHaveBeenCalledTimes(4);
    expect([calls("/auth/me"), calls("/reminders/usage"), calls(`/communes/${home.id}/invites`), reads(home.id)])
      .toEqual([1, 1, 1, 1]);
  });

  it("reads the open commune again when its mark moves, with its invitations and the reminder counts", async () => {
    await started();
    listed = [{ ...home, changeMark: "2026-10-09:4:31" }];
    records[home.id] = record(listed[0], [expense("expense-new", "Window cleaner", 0)]);
    await minutesPass();
    expect(await screen.findByText("Window cleaner")).toBeTruthy();
    expect([reads(home.id), calls("/reminders/usage"), calls(`/communes/${home.id}/invites`), calls("/auth/me")])
      .toEqual([2, 2, 2, 1]);
    await minutesPass();
    expect([reads(home.id), calls("/reminders/usage"), calls(`/communes/${home.id}/invites`)]).toEqual([2, 2, 2]);
  });

  it("reads other communes as summaries on overview screens, and in full once one is opened", async () => {
    listed = [home, trip];
    records[trip.id] = record(trip);
    await started("/places");
    await waitFor(() => expect(reads(trip.id, "summary")).toBe(1));
    expect([reads(home.id), reads(home.id, "summary"), reads(trip.id)]).toEqual([1, 0, 0]);
    // A trip member does not manage its invitations.
    expect(calls(`/communes/${trip.id}/invites`)).toBe(0);

    listed = [home, { ...trip, changeMark: "2026-10-09:3:44" }];
    records[trip.id] = record(listed[1]);
    await minutesPass();
    expect([reads(home.id), reads(trip.id, "summary"), reads(trip.id)]).toEqual([1, 2, 0]);

    // Its own screens never show the summary: they wait for the whole record.
    const full = deferred<Snapshot>();
    vi.mocked(loadSnapshot).mockImplementationOnce(() => full.promise);
    act(() => app.go("hub", { hub: trip.id }));
    expect(await screen.findByRole("status", { name: "Loading shared records" })).toBeTruthy();
    expect(reads(trip.id)).toBe(1);
    await act(async () => full.resolve(records[trip.id]));
    await waitFor(() => expect(screen.queryByRole("status", { name: "Loading shared records" })).toBeNull());
    expect(app.snapshots[trip.id].detail).toBeUndefined();
  });

  it("follows a commune joined or left from the list alone", async () => {
    await started();
    listed = [home, trip];
    records[trip.id] = record(trip);
    await minutesPass();
    expect(app.places.map((place) => place.id)).toEqual([home.id, trip.id]);
    // Not on screen, so not read until it is opened.
    expect([reads(trip.id), reads(trip.id, "summary"), calls("/reminders/usage")]).toEqual([0, 0, 2]);

    listed = [trip];
    await minutesPass();
    await waitFor(() => expect(app.hubId).toBe(trip.id));
    expect(reads(trip.id)).toBe(1);
    expect(screen.queryByText(home.name)).toBeNull();
  });

  it("stops checking in a tab nobody has used for ten minutes, and checks again once it is used", async () => {
    await started();
    await minutesPass(60);
    // Nine checks while the start counts as recent use, then none.
    expect(loadCommunes).toHaveBeenCalledTimes(10);
    expect([calls("/auth/me"), reads(home.id)]).toEqual([1, 1]);
    fireEvent.pointerMove(document.body);
    await settle();
    expect(loadCommunes).toHaveBeenCalledTimes(11);
    await minutesPass();
    expect(loadCommunes).toHaveBeenCalledTimes(12);
    expect(calls("/auth/me")).toBe(1);
  });

  it("does not check while the tab is hidden, and asks who is signed in when it is shown again", async () => {
    await started();
    visibility = "hidden";
    act(() => { document.dispatchEvent(new Event("visibilitychange")); });
    await minutesPass(5);
    expect(loadCommunes).toHaveBeenCalledTimes(1);
    visibility = "visible";
    act(() => { document.dispatchEvent(new Event("visibilitychange")); });
    await settle();
    expect([calls("/auth/me"), vi.mocked(loadCommunes).mock.calls.length, reads(home.id)]).toEqual([2, 2, 1]);
    // Focus straight after does not ask again.
    fireEvent.focus(window);
    await settle();
    expect(calls("/auth/me")).toBe(2);
  });

  it("signs the tab out when a check finds the session has ended", async () => {
    await started();
    vi.mocked(loadCommunes).mockRejectedValue(new ApiError("Sign in required", 401));
    await minutesPass();
    await screen.findByRole("heading", { name: "Welcome back" });
    expect(screen.getByRole("status").textContent).toBe("You were signed out. Sign in to carry on.");
    expect(screen.queryByText(home.name)).toBeNull();
  });

  it("ignores a check that answers after a newer refresh", async () => {
    await started();
    const late = deferred<{ communes: Commune[] }>();
    vi.mocked(loadCommunes).mockImplementationOnce(() => late.promise);
    await minutesPass();
    listed = [{ ...home, changeMark: "2026-10-09:4:31" }];
    records[home.id] = record(listed[0], [expense("expense-new", "Window cleaner", 0)]);
    await act(async () => app.refresh());
    expect(await screen.findByText("Window cleaner")).toBeTruthy();
    // The older answer would have taken the commune away.
    await act(async () => late.resolve({ communes: [] }));
    await settle();
    expect(screen.getByRole("heading", { name: home.name })).toBeTruthy();
    expect(screen.getByText("Window cleaner")).toBeTruthy();
  });
});

