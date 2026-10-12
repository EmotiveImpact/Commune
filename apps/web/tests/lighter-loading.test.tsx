import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { App } from "../src/App";
import { AppProvider, useApp, type AppState } from "../src/state";
import { api, post, loadCommunes, loadExpensePage, loadExpenseRecords, loadSnapshot, ApiError } from "../src/live/api";
import { downloadText } from "../src/data/export";
import type { Commune, Expense, ExpensePage, Snapshot } from "../src/live/model";

vi.mock("../src/live/api", async (importOriginal) => ({
  ...await importOriginal<typeof import("../src/live/api")>(),
  api: vi.fn(), post: vi.fn(), loadCommunes: vi.fn(), loadSnapshot: vi.fn(), loadExpensePage: vi.fn(), loadExpenseRecords: vi.fn(),
}));
vi.mock("../src/data/export", async (importOriginal) => ({
  ...await importOriginal<typeof import("../src/data/export")>(),
  downloadText: vi.fn(),
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
function monthLabel(back: number) {
  const start = new Date(`${monthStart(back)}T00:00:00Z`);
  return new Intl.DateTimeFormat("en-GB", { month: "long", timeZone: "UTC",
    ...(start.getUTCFullYear() === today.getUTCFullYear() ? {} : { year: "numeric" }) }).format(start);
}
/**
 * The snapshot holds every expense created from the start of last month,
 * every open one and the five newest that are not voided.
 */
const since = monthStart(1);
function expense(id: string, title: string, back: number, kind: "settled" | "open" | "voided" = "settled", day = 1): Expense {
  const at = `${monthStart(back).slice(0, 8)}${String(day).padStart(2, "0")}T12:00:00.000Z`;
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

describe("older expenses", () => {
  const groceries = expense("expense-groceries", "Groceries", 0);
  const internet = expense("expense-internet", "Internet", 1);
  const boiler = expense("expense-boiler", "Boiler repair", 5, "open");
  const garden = expense("expense-garden", "Garden tools", 3);
  const duplicate = expense("expense-duplicate", "Duplicate rent", 4, "voided");
  const sofa = expense("expense-sofa", "Sofa", 7);
  // The database would also send Garden tools and Sofa, as two of the five
  // newest; these tests leave them out to page from the window's own start.
  // The tests for a commune that has gone quiet, below, use what it sends.
  const older = [garden, duplicate, sofa];
  // Pages as commune_expense_page returns them from what the snapshot left
  // out (newest first): whole months back from `before`, reaching back to
  // the newest older expense past empty months.
  const pagesOf = (leftOut: Expense[]) => (_communeId: string, before: string | null, months?: number): Promise<ExpensePage> => {
    const end = before ?? since;
    const earlier = leftOut.filter((item) => item.createdAt! < end);
    let from: string | null = null;
    if (months && earlier.length) {
      const [year, month] = end.split("-").map(Number);
      const back = new Date(Date.UTC(year, month - 1 - months, 1)).toISOString().slice(0, 10);
      const newest = `${earlier[0].createdAt!.slice(0, 7)}-01`;
      from = back < newest ? back : newest;
    }
    const rest = earlier.filter((item) => from !== null && item.createdAt! < from);
    return Promise.resolve({ expenses: earlier.filter((item) => !rest.includes(item)), before: end, from,
      olderCount: rest.length, olderVoidedCount: rest.filter((item) => item.voidedAt).length });
  };
  const shownNames = () => within(screen.getByRole("region", { name: "Shared expenses" })).queryAllByRole("button")
    .map((button) => button.querySelector("strong")?.textContent);
  beforeEach(() => {
    records[home.id] = record(home, [groceries, internet, boiler], { olderCount: 3, olderVoidedCount: 1 });
    vi.mocked(loadExpensePage).mockImplementation(pagesOf(older));
  });

  it("shows open expenses and this month's settled ones, and earlier months on request", async () => {
    mount("/expenses");
    await screen.findByRole("button", { name: /Groceries/ });
    expect(shownNames()).toEqual(["Boiler repair", "Groceries"]);
    expect(screen.getByText(`Settled expenses before ${monthLabel(0)} aren’t shown yet.`)).toBeTruthy();

    // Last month is in the snapshot already.
    fireEvent.click(screen.getByRole("button", { name: "Show earlier" }));
    await screen.findByText(`Settled expenses before ${monthLabel(1)} aren’t shown yet.`);
    expect(shownNames()).toEqual(["Boiler repair", "Groceries", "Internet"]);
    expect(loadExpensePage).not.toHaveBeenCalled();

    // Two months back holds nothing, so the next month shown is three months back.
    fireEvent.click(screen.getByRole("button", { name: "Show earlier" }));
    await screen.findByText(`Settled expenses before ${monthLabel(3)} aren’t shown yet.`);
    expect(shownNames()).toEqual(["Boiler repair", "Groceries", "Internet", "Garden tools"]);
    expect(loadExpensePage).toHaveBeenCalledExactlyOnceWith(home.id, since, 1);

    // Voided ones page the same way, and filters apply to what is shown.
    fireEvent.click(screen.getByRole("button", { name: "Voided" }));
    expect(screen.getByText("0 voided expenses · kept for history, not counted in any balance")).toBeTruthy();
    expect(screen.getByText(`Voided expenses before ${monthLabel(3)} aren’t shown yet.`)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Show earlier" }));
    await screen.findByRole("button", { name: /Duplicate rent/ });
    expect(loadExpensePage).toHaveBeenLastCalledWith(home.id, monthStart(3), 1);
    expect(screen.queryByRole("button", { name: "Show earlier" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "All" }));
    expect(shownNames()).toEqual(["Boiler repair", "Groceries", "Internet", "Garden tools"]);
    fireEvent.click(screen.getByRole("button", { name: "Show earlier" }));
    await screen.findByRole("button", { name: /Sofa/ });
    expect(loadExpensePage).toHaveBeenCalledTimes(3);
    // Everything is loaded now.
    expect(screen.queryByRole("button", { name: "Show earlier" })).toBeNull();
    fireEvent.change(screen.getByLabelText("Filter expenses in this commune"), { target: { value: "sofa" } });
    expect(shownNames()).toEqual(["Sofa"]);
  });

  it("starts from last month while nothing has been settled this month", async () => {
    records[home.id] = record(home, [internet, boiler], { olderCount: 3, olderVoidedCount: 1 });
    mount("/expenses");
    await screen.findByRole("button", { name: /Internet/ });
    expect(shownNames()).toEqual(["Boiler repair", "Internet"]);
    expect(screen.getByText(`Settled expenses before ${monthLabel(1)} aren’t shown yet.`)).toBeTruthy();
  });

  it("pages voided expenses on their own, passing over settled ones", async () => {
    mount("/expenses");
    await screen.findByRole("button", { name: /Groceries/ });
    fireEvent.click(screen.getByRole("button", { name: "Voided" }));
    expect(screen.getByText(`Voided expenses before ${monthLabel(0)} aren’t shown yet.`)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Show earlier" }));
    await screen.findByRole("button", { name: /Duplicate rent/ });
    expect(shownNames()).toEqual(["Duplicate rent"]);
    expect(vi.mocked(loadExpensePage).mock.calls).toEqual([[home.id, since, 1], [home.id, monthStart(3), 1]]);
    expect(screen.queryByRole("button", { name: "Show earlier" })).toBeNull();
  });

  it("says when earlier expenses couldn’t be loaded, and tries again", async () => {
    vi.mocked(loadExpensePage).mockRejectedValueOnce(new TypeError("Failed to fetch"));
    mount("/expenses");
    await screen.findByRole("button", { name: /Groceries/ });
    fireEvent.click(screen.getByRole("button", { name: "Show earlier" }));
    await screen.findByRole("button", { name: /Internet/ });
    fireEvent.click(screen.getByRole("button", { name: "Show earlier" }));
    expect((await screen.findByRole("alert")).textContent).toBe("Earlier expenses couldn’t be loaded. Try again.");
    fireEvent.click(screen.getByRole("button", { name: "Show earlier" }));
    await screen.findByRole("button", { name: /Garden tools/ });
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("keeps older expenses when the snapshot is read again, and the snapshot’s copy wins", async () => {
    mount("/expenses");
    await screen.findByRole("button", { name: /Groceries/ });
    fireEvent.click(screen.getByRole("button", { name: "Show earlier" }));
    await screen.findByRole("button", { name: /Internet/ });
    fireEvent.click(screen.getByRole("button", { name: "Show earlier" }));
    await screen.findByRole("button", { name: /Garden tools/ });
    // Someone corrects the older expense, so the snapshot carries it now.
    const corrected = { ...garden, title: "Garden tools and seeds", version: 2, updatedAt: new Date().toISOString() };
    listed = [{ ...home, changeMark: "2026-10-09:4:31" }];
    records[home.id] = record(listed[0], [groceries, internet, corrected, boiler], { olderCount: 2, olderVoidedCount: 1 });
    await act(async () => app.refresh());
    await screen.findByRole("button", { name: /Garden tools and seeds/ });
    expect(shownNames()).toEqual(["Boiler repair", "Groceries", "Internet", "Garden tools and seeds"]);
    expect(loadExpensePage).toHaveBeenCalledTimes(1);
  });

  it("does not call a commune empty when its only expenses are voided ones older than the snapshot", async () => {
    records[home.id] = record(home, [], { olderCount: 1, olderVoidedCount: 1 });
    mount("/expenses");
    fireEvent.click(await screen.findByRole("button", { name: "Voided" }));
    expect(screen.getByText(`Voided expenses before ${monthLabel(0)} aren’t shown yet.`)).toBeTruthy();
    expect(screen.queryByText("No expenses yet.")).toBeNull();
    expect(app.emptyHub).toBe(false);
  });

  describe("a commune that has gone quiet", () => {
    // Nothing since the window's start: the snapshot holds the five newest
    // that are not voided (Hotel is still open too), and the rest are left out.
    const farewell = expense("expense-farewell", "Farewell dinner", 3, "settled", 20);
    const taxi = expense("expense-taxi", "Airport taxi", 3, "settled", 12);
    const museum = expense("expense-museum", "Museum tickets", 4, "settled", 18);
    const hotel = expense("expense-hotel", "Hotel", 4, "open", 10);
    const ferry = expense("expense-ferry", "Ferry", 4, "settled", 6);
    const repeated = expense("expense-repeated", "Taxi entered twice", 3, "voided", 25);
    const tram = expense("expense-tram", "Tram passes", 4, "settled", 2);
    const lunch = expense("expense-lunch", "Harbour lunch", 6, "settled", 15);
    beforeEach(() => {
      records[home.id] = record(home, [farewell, taxi, museum, hotel, ferry], { olderCount: 3, olderVoidedCount: 1 });
      vi.mocked(loadExpensePage).mockImplementation(pagesOf([repeated, tram, lunch]));
    });

    it("starts at its newest settled month and pages back past the snapshot’s start", async () => {
      mount("/expenses");
      await screen.findByRole("button", { name: /Farewell dinner/ });
      expect(shownNames()).toEqual(["Hotel", "Farewell dinner", "Airport taxi"]);
      expect(screen.getByText(`Settled expenses before ${monthLabel(3)} aren’t shown yet.`)).toBeTruthy();
      expect(loadExpensePage).not.toHaveBeenCalled();

      // Four months back is partly in the snapshot; the rest of it is fetched first.
      fireEvent.click(screen.getByRole("button", { name: "Show earlier" }));
      await screen.findByText(`Settled expenses before ${monthLabel(4)} aren’t shown yet.`);
      expect(shownNames()).toEqual(["Hotel", "Farewell dinner", "Airport taxi", "Museum tickets", "Ferry", "Tram passes"]);
      expect(vi.mocked(loadExpensePage).mock.calls).toEqual([[home.id, since, 1], [home.id, monthStart(3), 1]]);

      fireEvent.click(screen.getByRole("button", { name: "Show earlier" }));
      await screen.findByRole("button", { name: /Harbour lunch/ });
      expect(loadExpensePage).toHaveBeenLastCalledWith(home.id, monthStart(4), 1);
      expect(screen.queryByRole("button", { name: "Show earlier" })).toBeNull();
    });

    it("offers the earlier months its snapshot holds when nothing older is left", async () => {
      records[home.id] = record(home, [farewell, museum]);
      mount("/expenses");
      await screen.findByRole("button", { name: /Farewell dinner/ });
      expect(shownNames()).toEqual(["Farewell dinner"]);
      expect(screen.getByText(`Settled expenses before ${monthLabel(3)} aren’t shown yet.`)).toBeTruthy();
      fireEvent.click(screen.getByRole("button", { name: "Show earlier" }));
      await screen.findByRole("button", { name: /Museum tickets/ });
      expect(shownNames()).toEqual(["Farewell dinner", "Museum tickets"]);
      expect(screen.queryByRole("button", { name: "Show earlier" })).toBeNull();
      expect(loadExpensePage).not.toHaveBeenCalled();
    });

    it("lists its latest expenses on the hub and in its activity", async () => {
      mount("/hub");
      const recent = await screen.findByRole("region", { name: "Recent expenses" });
      expect(within(recent).getAllByRole("button").filter((button) => button.textContent !== "All expenses")
        .map((button) => button.querySelector("strong")?.textContent)).toEqual(["Farewell dinner", "Airport taxi", "Museum tickets"]);
      expect(app.hub.activity.map((row) => row.title)).toEqual(["Farewell dinner", "Airport taxi", "Museum tickets", "Hotel", "Ferry"]);
    });
  });

  it("fetches a linked expense that is older than what is loaded", async () => {
    const pending = deferred<{ expenses: Expense[] }>();
    vi.mocked(loadExpenseRecords).mockReturnValueOnce(pending.promise);
    mount("/hub");
    await screen.findByRole("heading", { name: home.name });
    act(() => app.go("expense", { expense: sofa.id }));
    const loading = await screen.findByRole("dialog", { name: "Expense" });
    expect(within(loading).getByRole("status", { name: "Loading selected record" })).toBeTruthy();
    expect(within(loading).queryByText("That expense isn’t in this hub.")).toBeNull();
    expect(loadExpenseRecords).toHaveBeenCalledExactlyOnceWith(home.id, [sofa.id]);
    await act(async () => pending.resolve({ expenses: [sofa] }));
    const shown = await screen.findByRole("dialog", { name: "Sofa" });
    expect(within(shown).getByText(/All shares are settled/)).toBeTruthy();
    // Kept with the other older expenses, so it opens again without a request.
    act(() => app.closeWindow());
    act(() => app.go("expense", { expense: sofa.id }));
    await screen.findByRole("dialog", { name: "Sofa" });
    expect(loadExpenseRecords).toHaveBeenCalledTimes(1);
  });

  it("says a linked expense isn’t in the commune when it is refused or gone, and offers to try again when the connection fails", async () => {
    mount("/hub");
    await screen.findByRole("heading", { name: home.name });
    vi.mocked(loadExpenseRecords).mockRejectedValueOnce(new ApiError("Not a commune member", 403));
    act(() => app.go("expense", { expense: "expense-elsewhere" }));
    expect(await screen.findByText("That expense isn’t in this hub.")).toBeTruthy();
    act(() => app.closeWindow());
    vi.mocked(loadExpenseRecords).mockResolvedValueOnce({ expenses: [] });
    act(() => app.go("expense", { expense: "expense-gone" }));
    expect(await screen.findByText("That expense isn’t in this hub.")).toBeTruthy();
    act(() => app.closeWindow());

    vi.mocked(loadExpenseRecords).mockRejectedValueOnce(new TypeError("Failed to fetch"));
    act(() => app.go("expense", { expense: sofa.id }));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("That expense couldn’t be loaded. Try again.");
    vi.mocked(loadExpenseRecords).mockResolvedValueOnce({ expenses: [sofa] });
    fireEvent.click(within(alert).getByRole("button", { name: "Try again" }));
    await screen.findByRole("dialog", { name: "Sofa" });
    expect(loadExpenseRecords).toHaveBeenCalledTimes(4);
  });

  it("loads every older expense before showing a statement", async () => {
    const pending = deferred<ExpensePage>();
    vi.mocked(loadExpensePage).mockReturnValueOnce(pending.promise);
    mount("/settle");
    fireEvent.click(await screen.findByRole("button", { name: "View breakdown" }));
    const dialog = await screen.findByRole("dialog", { name: "Breakdown" });
    expect(within(dialog).getByText("Loading earlier expenses for the statement…")).toBeTruthy();
    expect(within(dialog).queryByRole("region", { name: "Statement" })).toBeNull();
    expect(loadExpensePage).toHaveBeenCalledExactlyOnceWith(home.id, since, undefined);
    await act(async () => pending.resolve({ expenses: older, before: since, from: null, olderCount: 0, olderVoidedCount: 0 }));
    const statement = await within(dialog).findByRole("region", { name: "Statement" });
    for (const title of ["Sofa", "Duplicate rent", "Garden tools", "Internet"]) expect(statement.textContent).toContain(title);
    expect(within(dialog).queryByText("Loading earlier expenses for the statement…")).toBeNull();
  });

  it("says when a statement can’t be shown because earlier expenses didn’t load", async () => {
    vi.mocked(loadExpensePage).mockRejectedValueOnce(new TypeError("Failed to fetch"));
    mount("/settle");
    fireEvent.click(await screen.findByRole("button", { name: "View breakdown" }));
    const dialog = await screen.findByRole("dialog", { name: "Breakdown" });
    expect((await within(dialog).findByRole("alert")).textContent).toContain("Earlier expenses couldn’t be loaded, so the statement isn’t shown.");
    expect(within(dialog).queryByRole("region", { name: "Statement" })).toBeNull();
    fireEvent.click(within(dialog).getByRole("button", { name: "Try again" }));
    expect((await within(dialog).findByRole("region", { name: "Statement" })).textContent).toContain("Sofa");
  });

  it("loads every older expense before making an export file", async () => {
    const pending = deferred<ExpensePage>();
    vi.mocked(loadExpensePage).mockReturnValueOnce(pending.promise);
    mount("/commune-settings");
    fireEvent.click(await screen.findByRole("button", { name: /Download expenses/ }));
    expect(await screen.findByText("Loading earlier expenses for the file…")).toBeTruthy();
    expect((screen.getByRole("button", { name: /Download all records/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(downloadText).not.toHaveBeenCalled();
    await act(async () => pending.resolve({ expenses: older, before: since, from: null, olderCount: 0, olderVoidedCount: 0 }));
    await waitFor(() => expect(downloadText).toHaveBeenCalledTimes(1));
    const csv = vi.mocked(downloadText).mock.calls[0][1];
    for (const title of ["Sofa", "Duplicate rent", "Garden tools", "Groceries", "Boiler repair"]) expect(csv).toContain(title);
    expect(screen.queryByText("Loading earlier expenses for the file…")).toBeNull();

    // The next file needs nothing more, and says nothing about a window.
    fireEvent.click(screen.getByRole("button", { name: /Download all records/ }));
    await waitFor(() => expect(downloadText).toHaveBeenCalledTimes(2));
    const file = JSON.parse(vi.mocked(downloadText).mock.calls[1][1]) as Snapshot;
    expect(file.expenses.map((item) => item.title)).toEqual(["Groceries", "Internet", "Garden tools", "Duplicate rent", "Boiler repair", "Sofa"]);
    expect(file.expenseHistory).toBeUndefined();
    expect(file.changeMark).toBeUndefined();
    expect(loadExpensePage).toHaveBeenCalledTimes(1);
  });

  it("makes no file when earlier expenses couldn’t be loaded", async () => {
    vi.mocked(loadExpensePage).mockRejectedValueOnce(new TypeError("Failed to fetch"));
    mount("/commune-settings");
    fireEvent.click(await screen.findByRole("button", { name: /Download expenses/ }));
    expect((await screen.findByRole("alert")).textContent).toBe("Earlier expenses couldn’t be loaded, so no file was made. Try again.");
    expect(downloadText).not.toHaveBeenCalled();
  });
});
