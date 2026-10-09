import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { App } from "../src/App";
import { AppProvider, useApp, type AppState } from "../src/state";
import { api, loadCommunes, loadSnapshot, post } from "../src/live/api";
import type { Commune, Expense, Snapshot } from "../src/live/model";
import { todayIso, type OperationItem } from "../src/data/operations";
import { WINDOW_IDS, WINDOW_PAGE } from "../src/data/household";
import { addressOf, readAddress, safeReturnPath } from "../src/nav";
import { setViewer } from "../src/live/session";

vi.mock("../src/live/api", async (importOriginal) => ({
  ...await importOriginal<typeof import("../src/live/api")>(),
  api: vi.fn(), post: vi.fn(), loadCommunes: vi.fn(), loadSnapshot: vi.fn(),
}));

const user = { id: "user-1", name: "Test Person", email: "test@example.test", emailVerified: true };
const housemate = { userId: "user-2", name: "Housemate", role: "member" as const };
const home: Commune = { id: "home-1", name: "Our home", kind: "household", currency: "GBP", role: "admin" };
const flat: Commune = { id: "flat-4", name: "Flat 4", kind: "household", currency: "GBP", role: "member" };
const rent: Expense = { id: "expense-1", title: "Rent", amountMinor: 120000, paidByUserId: user.id, dueOn: null,
  shares: [{ id: "share-1", userId: user.id, amountMinor: 60000, settledMinor: 60000 }, { id: "share-2", userId: housemate.userId, amountMinor: 60000, settledMinor: 0 }] };
const rules = { id: "note-1", title: "House rules", pill: "House rules", kicker: "Everyone", lede: "", body: "Quiet after 11", facts: [] as Array<[string, string]> };
const bins: OperationItem = { id: "task-1", hubId: home.id, kind: "task", category: "chore", title: "Bins", date: todayIso(), allDay: true,
  assignee: user.name, repeat: "none", status: "open", notes: "" };
const fund = { id: "fund-1", name: "House fund", targetMinor: 20000, commitments: [] };
function snapshotOf(item: Commune): Snapshot {
  const members = [{ userId: user.id, name: user.name, role: item.role }, housemate];
  return item.id === home.id
    ? { commune: home, members, expenses: [rent], notes: [rules], operations: [bins], funds: [fund], notifications: [], reminderTargets: [] }
    : { commune: flat, members, expenses: [], funds: [], notifications: [], reminderTargets: [] };
}

let signedIn: typeof user | null = user;
let app: AppState;
function Capture() { app = useApp(); return null; }
function mount(path: string) {
  const location = memoryLocation({ path, record: true });
  render(<Router hook={location.hook}><AppProvider><Capture /><App /></AppProvider></Router>);
  return location;
}

// jsdom does not implement the browser's native modal top layer.
const modalDescriptor = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "showModal");
const closeDescriptor = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "close");
const originalScroll = Element.prototype.scrollIntoView;
beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
    configurable: true, value: function (this: HTMLDialogElement) { this.setAttribute("open", ""); },
  });
  Object.defineProperty(HTMLDialogElement.prototype, "close", {
    configurable: true, value: function (this: HTMLDialogElement) { this.removeAttribute("open"); },
  });
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
  // A new tab, which has shown no one yet.
  setViewer(null);
  signedIn = user;
  document.title = "Commune";
  vi.mocked(api).mockImplementation(async (path) => {
    if (path === "/auth/me") return { user: signedIn };
    if (path === "/reminders/usage") return { totalUsed: 0, totalLimit: 60, recipientLimit: 6, recipientUsage: {}, nextSlotAt: null };
    if (path.endsWith("/invites")) return { invites: [] };
    if (path === "/preferences") return { emailReminders: true };
    throw new Error(`Unexpected API request ${path}`);
  });
  vi.mocked(post).mockImplementation(async (path) => {
    if (path === "/auth/login") signedIn = user;
    return { ok: true };
  });
  vi.mocked(loadCommunes).mockResolvedValue({ communes: [home, flat] });
  vi.mocked(loadSnapshot).mockImplementation(async (item) => snapshotOf(item));
});
afterEach(cleanup);

describe("an address for every window", () => {
  it("reads back what it was made from", () => {
    const shows = ["expense", "expense-paid", "pay", "note", "note-edit", "operation", "operation-edit"];
    for (const window of WINDOW_IDS) {
      const record = shows.includes(window) ? "record-1" : "";
      const made = addressOf(WINDOW_PAGE[window] ?? "hub", { window, record, commune: "home-1" });
      const [path, search] = made.split("?");
      const read = readAddress(path, search);
      expect(read.window, made).toBe(window);
      expect(read.record, made).toBe(record);
    }
    expect(addressOf("expenses", { window: "expense", record: "expense-1", commune: "home-1" })).toBe("/expenses/expense-1?commune=home-1");
    expect(addressOf("notes", { window: "note-edit", record: "note-1", commune: "home-1" })).toBe("/notes/note-1/edit?commune=home-1");
    expect(addressOf("settle", { window: "breakdown", commune: "home-1" })).toBe("/settle/breakdown?commune=home-1");
    expect(addressOf("funds", { record: "fund-1", commune: "home-1" })).toBe("/funds/fund-1?commune=home-1");
    expect(addressOf("settings", { window: "notices", commune: "home-1" })).toBe("/settings?window=notices");
    expect(addressOf("operations", { window: "operation-new", commune: "home-1", params: { date: "2026-10-12" } }))
      .toBe("/operations/new?commune=home-1&date=2026-10-12");
  });

  it("knows the addresses it does not have", () => {
    for (const path of ["/nonsense", "/expenses/expense-1/extra", "/notes/new/edit", "/expenses/<script>", "/funds/a/b"]) {
      expect(readAddress(path).screen, path).toBeNull();
    }
    expect(readAddress("/expenses/").screen).toBe("expenses");
  });

  it("opens an expense at its own address, and that address opens it again", async () => {
    const location = mount("/expenses");
    fireEvent.click(await screen.findByRole("button", { name: /^Rent/ }));
    await screen.findByRole("dialog", { name: "Rent" });
    expect(location.history?.at(-1)).toBe("/expenses/expense-1?commune=home-1");
    cleanup();
    mount("/expenses/expense-1?commune=home-1");
    const dialog = await screen.findByRole("dialog", { name: "Rent" });
    expect(within(dialog).getByText(/Test Person paid £1,200.00/)).toBeTruthy();
  });

  it.each([
    ["/notes/note-1?commune=home-1", "complementary", "House rules"],
    ["/operations/task-1?commune=home-1", "dialog", "Bins"],
    ["/operations/task-1/edit?commune=home-1", "dialog", "Bins"],
    ["/settle/breakdown?commune=home-1", "dialog", "Breakdown"],
    ["/funds/fund-1?commune=home-1", "dialog", "House fund"],
    ["/notes/new?commune=home-1", "dialog", "Add note"],
    ["/expenses/new?commune=home-1", "dialog", "Add expense"],
    ["/places/new", "dialog", "New commune"],
    ["/settings/profile", "dialog", "Profile"],
    ["/hub?commune=home-1&window=notices", "dialog", "Notices"],
  ])("a link to %s opens it", async (path, role, name) => {
    mount(path);
    expect(await screen.findByRole(role, { name })).toBeTruthy();
  });

  it("names the commune, so a reload or a link opens the same one", async () => {
    let location = mount("/expenses");
    await screen.findByRole("button", { name: /^Rent/ });
    // The address now says which commune it shows, in place of the one without.
    expect(location.history).toEqual(["/expenses?commune=home-1"]);
    cleanup();
    location = mount("/expenses?commune=flat-4");
    await screen.findByRole("heading", { name: "No expenses yet." });
    expect(app.hub.id).toBe(flat.id);
    act(() => app.go("hub", { hub: home.id }));
    expect(location.history?.at(-1)).toBe("/hub?commune=home-1");
    await screen.findByRole("heading", { name: home.name });
  });

  it("never shows another commune's records for a commune this account is not in", async () => {
    mount("/expenses/expense-1?commune=someone-elses");
    await screen.findByRole("heading", { name: "This commune isn’t available to you." });
    expect(screen.queryByRole("dialog", { name: "Rent" })).toBeNull();
    expect(screen.queryByText("Rent")).toBeNull();
    expect(app.window).toBeNull();
    await waitFor(() => expect(document.title).toBe("Commune not found · Commune"));
    fireEvent.click(screen.getByRole("button", { name: "Go to Home" }));
    await screen.findByRole("heading", { name: "Your communes, Test." });
  });

  it("shows the window's own not-found state for a record outside the commune", async () => {
    mount("/expenses/expense-9?commune=home-1");
    expect(await screen.findByText("That expense isn’t in this hub.")).toBeTruthy();
    cleanup();
    mount("/notes/note-9?commune=home-1");
    expect(await screen.findByText("That note isn’t here.")).toBeTruthy();
  });

  it("shows a not-found page for an address Commune does not have, signed in or not", async () => {
    let location = mount("/somewhere/else");
    await screen.findByRole("heading", { name: "This page isn’t here." });
    await waitFor(() => expect(document.title).toBe("Page not found · Commune"));
    cleanup();
    signedIn = null;
    location = mount("/billing/old");
    await screen.findByRole("heading", { name: "This page isn’t here." });
    expect(location.history).toEqual(["/billing/old"]);
    expect(sessionStorage.getItem("commune.return-to")).toBeNull();
  });

  it("titles each page, most specific first", async () => {
    mount("/expenses?commune=flat-4");
    await waitFor(() => expect(document.title).toBe("Expenses · Flat 4 · Commune"));
    act(() => app.go("hub", { hub: home.id }));
    await waitFor(() => expect(document.title).toBe("This Hub · Our home · Commune"));
    act(() => app.go("expense", { expense: rent.id }));
    await waitFor(() => expect(document.title).toBe("Expense · Our home · Commune"));
    act(() => app.go("settings"));
    await waitFor(() => expect(document.title).toBe("Settings · Commune"));
    act(() => app.go("home"));
    await waitFor(() => expect(document.title).toBe("Home · Commune"));
    cleanup();
    signedIn = null;
    mount("/login");
    await waitFor(() => expect(document.title).toBe("Sign in · Commune"));
  });

  it("closes a fund to Funds and keeps the fund's address while it is open", async () => {
    const location = mount("/funds?commune=home-1");
    fireEvent.click(await screen.findByRole("button", { name: "View fund House fund" }));
    const dialog = await screen.findByRole("dialog", { name: "House fund" });
    expect(location.history?.at(-1)).toBe("/funds/fund-1?commune=home-1");
    fireEvent.click(within(dialog).getByRole("button", { name: "Close dialog" }));
    await waitFor(() => expect(location.history?.at(-1)).toBe("/funds?commune=home-1"));
    expect(screen.queryByRole("dialog", { name: "House fund" })).toBeNull();
  });

  it("says when a linked fund is not in the commune", async () => {
    mount("/funds/fund-9?commune=home-1");
    expect(await screen.findByText("That fund isn’t in this commune. It may have been removed.")).toBeTruthy();
    expect(screen.queryByRole("dialog", { name: "House fund" })).toBeNull();
  });
});

describe("the page asked for before signing in", () => {
  async function signIn() {
    await screen.findByRole("heading", { name: "Welcome back" });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: user.email } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "a long enough password" } });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Sign in" })); });
  }

  it("opens after signing in, as a reminder email's link to Settings does", async () => {
    signedIn = null;
    const location = mount("/settings");
    await screen.findByRole("heading", { name: "Welcome back" });
    // In place of the page, so Back does not bounce between the two.
    expect(location.history).toEqual(["/login"]);
    expect(sessionStorage.getItem("commune.return-to")).toBe("/settings");
    await signIn();
    await screen.findByRole("heading", { name: "Settings", level: 1 });
    expect(location.history?.at(-1)).toBe("/settings");
    expect(sessionStorage.getItem("commune.return-to")).toBeNull();
  });

  it("keeps a record's address, commune and all", async () => {
    signedIn = null;
    const location = mount("/expenses/expense-1?commune=home-1");
    await signIn();
    await screen.findByRole("dialog", { name: "Rent" });
    expect(location.history?.at(-1)).toBe("/expenses/expense-1?commune=home-1");
  });

  it("survives creating an account from an invitation", async () => {
    signedIn = null;
    vi.mocked(loadCommunes).mockResolvedValue({ communes: [] });
    vi.mocked(post).mockImplementation(async (path) => {
      if (path === "/auth/signup") { signedIn = user; return { verificationRequired: false }; }
      return { ok: true };
    });
    const token = "c".repeat(64);
    sessionStorage.setItem("commune.return-to", `/invite?token=${token}`);
    const location = mount("/signup");
    await screen.findByRole("heading", { name: "Create your account" });
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: user.name } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: user.email } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "a long enough password" } });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Create account" })); });
    await waitFor(() => expect(location.history?.at(-1)).toBe(`/invite?token=${token}`));
  });

  it("goes only to a page on this site", async () => {
    signedIn = null;
    sessionStorage.setItem("commune.return-to", "https://evil.example/steal");
    const location = mount("/login");
    await signIn();
    await screen.findByRole("heading", { name: "Your communes, Test." });
    expect(location.history?.at(-1)).toBe("/");
  });

  it("accepts paths and refuses anything a browser could read as another site", () => {
    expect(safeReturnPath("/settings")).toBe("/settings");
    expect(safeReturnPath("/expenses/expense-1?commune=home-1")).toBe("/expenses/expense-1?commune=home-1");
    expect(safeReturnPath(`/invite?token=${"a".repeat(64)}`)).toBe(`/invite?token=${"a".repeat(64)}`);
    for (const unsafe of ["https://evil.example/", "//evil.example/x", "/\\evil.example", "\\\\evil.example", "/\t/evil.example",
      "javascript:alert(1)", " /settings", "settings", "", null, "/login", "/", `/${"a".repeat(3000)}`]) {
      expect(safeReturnPath(unsafe), String(unsafe)).toBeNull();
    }
  });

  it("is not kept by signing out, or by a session that ended", async () => {
    mount("/settings");
    await screen.findByRole("heading", { name: "Settings", level: 1 });
    await act(async () => { await app.signOut(); });
    await screen.findByRole("heading", { name: "Welcome back" });
    expect(sessionStorage.getItem("commune.return-to")).toBeNull();
    cleanup();
    mount("/expenses?commune=home-1");
    await screen.findByRole("button", { name: /^Rent/ });
    signedIn = null;
    await act(async () => { await app.refresh(); });
    await screen.findByRole("heading", { name: "Welcome back" });
    expect(sessionStorage.getItem("commune.return-to")).toBeNull();
  });
});

describe("Back, in the browser's own history", () => {
  // Each test starts on a fresh entry and only goes back over its own.
  function start(path: string) {
    window.history.pushState(null, "", path);
    render(<AppProvider><Capture /><App /></AppProvider>);
  }
  async function back() {
    await act(async () => {
      const moved = new Promise((resolve) => window.addEventListener("popstate", resolve, { once: true }));
      window.history.back();
      await moved;
    });
  }
  const here = () => `${window.location.pathname}${window.location.search}`;
  afterEach(() => window.history.pushState(null, "", "/"));

  it("closes a window, and Forward opens it again", async () => {
    start("/expenses?commune=home-1");
    fireEvent.click(await screen.findByRole("button", { name: /^Rent/ }));
    await screen.findByRole("dialog", { name: "Rent" });
    expect(here()).toBe("/expenses/expense-1?commune=home-1");
    await back();
    expect(screen.queryByRole("dialog", { name: "Rent" })).toBeNull();
    expect(here()).toBe("/expenses?commune=home-1");
    await act(async () => {
      const moved = new Promise((resolve) => window.addEventListener("popstate", resolve, { once: true }));
      window.history.forward();
      await moved;
    });
    expect(await screen.findByRole("dialog", { name: "Rent" })).toBeTruthy();
  });

  it("closes with Close to the entry it opened from, so Back never reopens it", async () => {
    start("/hub?commune=home-1");
    await screen.findByRole("heading", { name: home.name });
    act(() => app.go("expenses"));
    fireEvent.click(await screen.findByRole("button", { name: /^Rent/ }));
    const dialog = await screen.findByRole("dialog", { name: "Rent" });
    await act(async () => {
      const moved = new Promise((resolve) => window.addEventListener("popstate", resolve, { once: true }));
      fireEvent.click(within(dialog).getAllByRole("button", { name: "Close" }).at(-1)!);
      await moved;
    });
    expect(here()).toBe("/expenses?commune=home-1");
    await back();
    expect(here()).toBe("/hub?commune=home-1");
    await screen.findByRole("heading", { name: home.name });
  });

  it("returns from an editor to the note it edits, and a saved note replaces the form", async () => {
    vi.mocked(api).mockImplementation(async (path, options) => {
      if (path === "/auth/me") return { user: signedIn };
      if (path === "/notes/note-1" && options?.method === "PUT") return { ok: true, version: 2 };
      if (path === "/reminders/usage") return { totalUsed: 0, totalLimit: 60, recipientLimit: 6, recipientUsage: {}, nextSlotAt: null };
      return { invites: [] };
    });
    vi.mocked(post).mockImplementation(async (path) => path.endsWith("/notes") ? { id: "note-2" } : { ok: true });
    start("/notes?commune=home-1");
    fireEvent.click(await screen.findByRole("button", { name: /^House rules/ }));
    await screen.findByRole("complementary", { name: "House rules" });
    fireEvent.click(screen.getByRole("button", { name: "Edit note" }));
    const editor = await screen.findByRole("dialog", { name: "Edit note" });
    expect(here()).toBe("/notes/note-1/edit?commune=home-1");
    await act(async () => {
      const moved = new Promise((resolve) => window.addEventListener("popstate", resolve, { once: true }));
      fireEvent.click(within(editor).getByRole("button", { name: "Cancel" }));
      await moved;
    });
    expect(here()).toBe("/notes/note-1?commune=home-1");
    await back();
    expect(here()).toBe("/notes?commune=home-1");

    act(() => app.go("note-new"));
    const form = await screen.findByRole("dialog", { name: "Add note" });
    fireEvent.change(within(form).getByLabelText(/^Title/), { target: { value: "Bins" } });
    fireEvent.change(within(form).getByLabelText(/^Note/), { target: { value: "Tuesday" } });
    await act(async () => { fireEvent.click(within(form).getByRole("button", { name: "Save" })); });
    await waitFor(() => expect(here()).toBe("/notes/note-2?commune=home-1"));
    await back();
    expect(here()).toBe("/notes?commune=home-1");
    expect(screen.queryByRole("dialog", { name: "Add note" })).toBeNull();
  });

  it("asks before Back discards typed text, and goes on when told to", async () => {
    start("/expenses?commune=home-1");
    await screen.findByRole("button", { name: /^Rent/ });
    act(() => app.go("add-expense"));
    const dialog = await screen.findByRole("dialog", { name: "Add expense" });
    const name = within(dialog).getByLabelText("What was it for?") as HTMLInputElement;
    fireEvent.input(name, { target: { value: "Window cleaner" } });
    await back();
    const question = await screen.findByRole("dialog", { name: "Discard your changes?" });
    expect(screen.getByRole("dialog", { name: "Add expense" })).toBe(dialog);
    expect(name.value).toBe("Window cleaner");
    expect(here()).toBe("/expenses/new?commune=home-1");
    fireEvent.click(within(question).getByRole("button", { name: "Keep editing" }));
    expect(screen.queryByRole("dialog", { name: "Discard your changes?" })).toBeNull();
    expect(name.value).toBe("Window cleaner");

    await back();
    const again = await screen.findByRole("dialog", { name: "Discard your changes?" });
    await act(async () => {
      const moved = new Promise((resolve) => window.addEventListener("popstate", resolve, { once: true }));
      fireEvent.click(within(again).getByRole("button", { name: "Discard" }));
      await moved;
    });
    expect(screen.queryByRole("dialog", { name: "Add expense" })).toBeNull();
    expect(here()).toBe("/expenses?commune=home-1");
  });
});
