import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { App } from "../src/App";
import { AppProvider, useApp, type AppState } from "../src/state";
import { api, loadCommunes, loadSnapshot, post } from "../src/live/api";
import type { Commune, Expense, Snapshot } from "../src/live/model";
import type { SearchResult } from "../src/live/search";

vi.mock("../src/live/api", async (importOriginal) => ({
  ...await importOriginal<typeof import("../src/live/api")>(),
  api: vi.fn(), post: vi.fn(), loadCommunes: vi.fn(), loadSnapshot: vi.fn(),
}));

// Each screen keeps its own filter or search text. What people rely on stays:
// the text is still there under a window opened over the screen, and Back to
// Search finds the same search.
const user = { id: "user-1", name: "Test Person", email: "test@example.test", emailVerified: true };
const home: Commune = { id: "home-1", name: "Our home", kind: "household", currency: "GBP", role: "admin" };
const expense = (id: string, title: string): Expense => ({
  id, title, amountMinor: 3000, paidByUserId: user.id, dueOn: null, createdAt: new Date().toISOString(), version: 1,
  shares: [{ id: `${id}-a`, userId: user.id, amountMinor: 1500, settledMinor: 1500 }, { id: `${id}-b`, userId: "user-2", amountMinor: 1500, settledMinor: 0 }],
});
const note = (id: string, title: string) => ({ id, title, pill: "Other", kicker: "Everyone", lede: "", body: `About ${title}`, facts: [] as Array<[string, string]>, version: 1 });
const snapshot: Snapshot = {
  commune: home,
  members: [{ userId: user.id, name: user.name, role: "admin", active: true }, { userId: "user-2", name: "Housemate", role: "member", active: true }],
  expenses: [expense("expense-1", "Garden hose"), expense("expense-2", "Kitchen roll"), expense("expense-3", "Garden chairs")],
  notes: [note("note-1", "Garden tools"), note("note-2", "Kitchen rota")],
  funds: [], operations: [], notifications: [], reminderTargets: [], sentReminders: [], recurringBills: [], splitTemplates: [], activityEvents: [],
};
const found = (query: string): SearchResult[] => [{
  kind: "expense", id: "expense-1", communeId: home.id, communeName: home.name, title: "Garden hose", subtitle: "Shared expense",
  meta: "Open", label: "Open", date: null, amountMinor: 3000, currency: "GBP",
}].filter((item) => item.title.toLowerCase().includes(query.toLowerCase()));

let app: AppState;
function Capture() { app = useApp(); return null; }
function mount(path: string) {
  render(<Router hook={memoryLocation({ path, record: true }).hook}><AppProvider><Capture /><App /></AppProvider></Router>);
}
const shownExpenses = () => [...document.querySelectorAll(".c-expense-copy strong")].map((name) => name.textContent);
const shownNotes = () => [...document.querySelectorAll(".note-tile strong")].map((name) => name.textContent);

const modalDescriptor = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "showModal");
const closeDescriptor = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "close");
const originalScroll = Element.prototype.scrollIntoView;
beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value: function (this: HTMLDialogElement) { this.setAttribute("open", ""); } });
  Object.defineProperty(HTMLDialogElement.prototype, "close", { configurable: true, value: function (this: HTMLDialogElement) { this.removeAttribute("open"); } });
});
afterAll(() => {
  Element.prototype.scrollIntoView = originalScroll;
  if (modalDescriptor) Object.defineProperty(HTMLDialogElement.prototype, "showModal", modalDescriptor);
  else delete (HTMLDialogElement.prototype as unknown as Record<string, unknown>).showModal;
  if (closeDescriptor) Object.defineProperty(HTMLDialogElement.prototype, "close", closeDescriptor);
  else delete (HTMLDialogElement.prototype as unknown as Record<string, unknown>).close;
});
beforeEach(() => {
  vi.resetAllMocks();
  sessionStorage.clear();
  vi.mocked(api).mockImplementation(async (path) => {
    if (path === "/auth/me") return { user };
    if (path === "/reminders/usage") return { totalUsed: 0, totalLimit: 60, recipientLimit: 6, recipientUsage: {}, nextSlotAt: null };
    if (path.endsWith("/invites")) return { invites: [] };
    if (path.startsWith("/search?")) {
      const query = new URLSearchParams(path.slice("/search?".length)).get("q") ?? "";
      const items = found(query);
      return { query, items, total: items.length, hasMore: false };
    }
    throw new Error(`Unexpected API request ${path}`);
  });
  vi.mocked(post).mockResolvedValue({ ok: true });
  vi.mocked(loadCommunes).mockResolvedValue({ communes: [home] });
  vi.mocked(loadSnapshot).mockImplementation(async () => snapshot);
});
afterEach(cleanup);

describe("the text each screen keeps", () => {
  it("keeps the Expenses filter while an expense is open over the screen, and after it closes", async () => {
    mount(`/expenses?commune=${home.id}`);
    const filter = await screen.findByRole("searchbox", { name: "Filter expenses in this commune" });
    fireEvent.change(filter, { target: { value: "garden" } });
    expect(shownExpenses()).toEqual(["Garden hose", "Garden chairs"]);
    fireEvent.click(screen.getByRole("button", { name: /^Garden hose/ }));
    await screen.findByRole("dialog", { name: "Garden hose" });
    expect((screen.getByLabelText("Filter expenses in this commune") as HTMLInputElement).value).toBe("garden");
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Garden hose" })).toBeNull());
    expect((screen.getByLabelText("Filter expenses in this commune") as HTMLInputElement).value).toBe("garden");
    expect(shownExpenses()).toEqual(["Garden hose", "Garden chairs"]);
  });

  it("keeps the Notes search while a note is open, and while a note window is over the screen", async () => {
    mount(`/notes?commune=${home.id}`);
    const search = await screen.findByRole("searchbox", { name: "Search notes in this commune" });
    fireEvent.change(search, { target: { value: "garden" } });
    expect(shownNotes()).toEqual(["Garden tools"]);
    // The reader opens beside the board.
    fireEvent.click(screen.getByRole("button", { name: /^Garden tools/ }));
    const reader = await screen.findByRole("complementary", { name: "Garden tools" });
    fireEvent.keyDown(reader, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("complementary", { name: "Garden tools" })).toBeNull());
    expect(shownNotes()).toEqual(["Garden tools"]);
    // A window over the board.
    fireEvent.click(screen.getByRole("button", { name: "Add note" }));
    const window = await screen.findByRole("dialog", { name: "Add note" });
    fireEvent.click(within(window).getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Add note" })).toBeNull());
    expect((screen.getByLabelText("Search notes in this commune") as HTMLInputElement).value).toBe("garden");
    expect(shownNotes()).toEqual(["Garden tools"]);
  });

  it("starts Search from the finder's words, also when Search is already open", async () => {
    mount("/search");
    const words = await screen.findByRole("searchbox", { name: "Search Commune" });
    fireEvent.change(words, { target: { value: "kitchen" } });
    fireEvent.click(screen.getByRole("button", { name: "Search Commune" }));
    const finder = await screen.findByRole("dialog", { name: "Search Commune" });
    fireEvent.change(within(finder).getByRole("combobox", { name: "Search Commune" }), { target: { value: "garden" } });
    fireEvent.click(await within(finder).findByRole("button", { name: "Open full search" }));
    await waitFor(() => expect((screen.getByRole("searchbox", { name: "Search Commune" }) as HTMLInputElement).value).toBe("garden"));
    expect(await screen.findByRole("button", { name: /Garden hose/ })).toBeTruthy();
  });

  it("forgets Search's words when the account signs out", async () => {
    mount("/search");
    fireEvent.change(await screen.findByRole("searchbox", { name: "Search Commune" }), { target: { value: "garden" } });
    expect(app.recallSearch()).toEqual({ query: "garden", scope: null });
    await act(async () => { await app.signOut(); });
    expect(app.recallSearch()).toEqual({ query: "", scope: null });
  });
});

describe("Back to Search, in the browser's own history", () => {
  afterEach(() => window.history.pushState(null, "", "/"));

  it("finds the same search after opening a result", async () => {
    window.history.pushState(null, "", "/search");
    render(<AppProvider><Capture /><App /></AppProvider>);
    fireEvent.change(await screen.findByRole("searchbox", { name: "Search Commune" }), { target: { value: "garden" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Search in" }), { target: { value: home.id } });
    fireEvent.click(await screen.findByRole("button", { name: /Garden hose/ }));
    await screen.findByRole("dialog", { name: "Garden hose" });
    expect(window.location.pathname).toBe("/expenses/expense-1");
    await act(async () => {
      const moved = new Promise((resolve) => window.addEventListener("popstate", resolve, { once: true }));
      window.history.back();
      await moved;
    });
    const words = await screen.findByRole("searchbox", { name: "Search Commune" });
    expect((words as HTMLInputElement).value).toBe("garden");
    expect((screen.getByRole("combobox", { name: "Search in" }) as HTMLSelectElement).value).toBe(home.id);
    expect(await screen.findByRole("button", { name: /Garden hose/ })).toBeTruthy();
  });
});
