import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { App } from "../src/App";
import { AppProvider, useApp, type AppState } from "../src/state";
import { api, post, loadCommunes, loadSnapshot, ApiError } from "../src/live/api";
import type { Commune, Notification, Snapshot } from "../src/live/model";
import { addDays, dateFromIso, todayIso, type OperationItem } from "../src/data/operations";
import { Dialog } from "../src/ui/components";

vi.mock("../src/live/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/live/api")>()),
  api: vi.fn(),
  post: vi.fn(),
  loadCommunes: vi.fn(),
  loadSnapshot: vi.fn(),
}));

const user = { id: "user-1", name: "Test Person", email: "test@example.test", emailVerified: true };
const commune: Commune = { id: "home-1", name: "Our home", kind: "household", currency: "GBP", role: "admin" };
const otherCommune: Commune = { id: "home-2", name: "Studio", kind: "workspace", currency: "GBP", role: "member" };
const initial: Snapshot = {
  commune,
  members: [
    { userId: user.id, name: user.name, role: "admin", active: true },
    { userId: "user-2", name: "Housemate", role: "member", active: true },
  ],
  expenses: [],
  funds: [],
  notes: [],
  operations: [],
  notifications: [],
  reminderTargets: [],
  recurringBills: [],
  splitTemplates: [],
  activityEvents: [],
};
let current: Snapshot;
let app: AppState;

function Capture() {
  app = useApp();
  return null;
}

function mount(path: string) {
  const location = memoryLocation({ path, record: true });
  render(
    <Router hook={location.hook}>
      <AppProvider>
        <Capture />
        <App />
      </AppProvider>
    </Router>,
  );
  return location;
}

// jsdom does not implement the browser's native modal top layer.
const modalDescriptor = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "showModal");
const closeDescriptor = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "close");
const originalScroll = Element.prototype.scrollIntoView;
beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
    configurable: true,
    value: function (this: HTMLDialogElement) { this.setAttribute("open", ""); },
  });
  Object.defineProperty(HTMLDialogElement.prototype, "close", {
    configurable: true,
    value: function (this: HTMLDialogElement) { this.removeAttribute("open"); },
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
  localStorage.clear();
  current = structuredClone(initial);
  vi.mocked(api).mockImplementation(async (path) => {
    if (path === "/auth/me") return { user };
    if (path === "/reminders/usage") return { totalUsed: 0, totalLimit: 60, recipientLimit: 8, recipientUsage: {}, nextSlotAt: null };
    if (path.endsWith("/invites")) return { invites: [] };
    return { id: "new-id", ok: true };
  });
  vi.mocked(post).mockResolvedValue({ id: "new-id", ok: true });
  vi.mocked(loadCommunes).mockResolvedValue({ communes: [commune] });
  vi.mocked(loadSnapshot).mockImplementation(async () => current);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("page structure and focus after moving", () => {
  it("starts every page with a skip link to the main landmark", async () => {
    mount("/hub");
    await screen.findByRole("heading", { name: "This Hub", level: 1 });
    const skip = screen.getByRole("link", { name: "Skip to content" });
    const main = screen.getByRole("main");
    expect(main.id).toBe("main-content");
    expect(skip.getAttribute("href")).toBe("#main-content");
    // It is the first thing Tab reaches, before the sidebar.
    const focusable = document.querySelectorAll(".a-app a[href], .a-app button");
    expect(focusable[0]).toBe(skip);
    expect(main.contains(document.getElementById("hub"))).toBe(true);

    fireEvent.click(skip);
    expect(document.activeElement).toBe(main);
    expect(main.getAttribute("tabindex")).toBe("-1");
    fireEvent.blur(main);
    expect(main.hasAttribute("tabindex")).toBe(false);
  });

  it("leaves focus alone on first load, then moves it to the new page's heading", async () => {
    mount("/hub");
    await screen.findByRole("heading", { name: "This Hub", level: 1 });
    expect(document.activeElement).toBe(document.body);

    const nav = screen.getByRole("navigation", { name: "Primary" });
    // The basic and advanced lists each hold an Expenses link; CSS shows one.
    const expenses = within(nav).getAllByRole("button", { name: "Expenses" })[0];
    expenses.focus();
    fireEvent.click(expenses);
    const heading = await screen.findByRole("heading", { name: "Expenses", level: 1 });
    await waitFor(() => expect(document.activeElement).toBe(heading));
    expect(expenses.getAttribute("aria-current")).toBe("page");
  });

  it("moves focus to the heading after switching commune", async () => {
    vi.mocked(loadCommunes).mockResolvedValue({ communes: [commune, otherCommune] });
    vi.mocked(loadSnapshot).mockImplementation(async (row) => (row.id === otherCommune.id ? { ...current, commune: otherCommune } : current));
    mount("/hub");
    await screen.findByRole("heading", { name: "This Hub", level: 1 });
    act(() => app.go("hub", { hub: otherCommune.id }));
    await waitFor(() => expect(app.hub.id).toBe(otherCommune.id));
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("heading", { level: 1 })));
  });

  it("lets a window opened on another page keep focus, and only takes focus back if it would be lost", async () => {
    mount("/hub");
    await screen.findByRole("heading", { name: "This Hub", level: 1 });
    act(() => app.go("add-expense"));
    const dialog = await screen.findByRole("dialog", { name: "Add expense" });
    expect(screen.getByRole("heading", { name: "Expenses", level: 1 })).toBeTruthy();
    expect(dialog.contains(document.activeElement)).toBe(true);

    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Add expense" })).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("heading", { name: "Expenses", level: 1 })));
  });

  it("marks the current phone tab as the current page", async () => {
    mount("/settle");
    await screen.findByRole("heading", { name: "Settle", level: 1 });
    const tabs = screen.getByRole("navigation", { name: "Phone" });
    expect(within(tabs).getByRole("button", { name: "Settle" }).getAttribute("aria-current")).toBe("page");
    for (const name of ["Home", "Hub", "Expenses"]) {
      expect(within(tabs).getByRole("button", { name }).hasAttribute("aria-current")).toBe(false);
    }
  });
});

describe("commune switcher", () => {
  it("is a plain show-and-hide list: Escape closes it and returns focus to its button", async () => {
    vi.mocked(loadCommunes).mockResolvedValue({ communes: [commune, otherCommune] });
    vi.mocked(loadSnapshot).mockImplementation(async (row) => (row.id === otherCommune.id ? { ...current, commune: otherCommune } : current));
    mount("/hub");
    await screen.findByRole("heading", { name: "This Hub", level: 1 });
    const toggle = await screen.findByRole("button", { name: /^Our home.*Switch commune$/ });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(toggle.hasAttribute("aria-haspopup")).toBe(false);

    toggle.focus();
    fireEvent.click(toggle);
    const list = screen.getByRole("group", { name: "Communes" });
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(toggle.getAttribute("aria-controls")).toBe(list.id);
    expect(within(list).queryAllByRole("menuitem")).toHaveLength(0);
    expect(within(list).getByRole("button", { name: /^Our home/ }).getAttribute("aria-current")).toBe("true");
    const studio = within(list).getByRole("button", { name: /^Studio/ });
    expect(studio.hasAttribute("aria-current")).toBe(false);
    expect(within(list).getByRole("button", { name: "Create a commune" })).toBeTruthy();

    studio.focus();
    fireEvent.keyDown(studio, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("group", { name: "Communes" })).toBeNull());
    expect(document.activeElement).toBe(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("false");

    // Moving focus out of the list closes it as well.
    fireEvent.click(toggle);
    expect(screen.getByRole("group", { name: "Communes" })).toBeTruthy();
    act(() => screen.getByRole("link", { name: "Skip to content" }).focus());
    await waitFor(() => expect(screen.queryByRole("group", { name: "Communes" })).toBeNull());
  });
});

describe("states and names", () => {
  const notice = (id: string, readAt: string | null): Notification => ({
    id, kind: "nudge", sourceId: "share-1", amountMinor: 1200, communeId: commune.id, senderUserId: "user-2",
    expenseId: "expense-1", title: "House supplies", detail: null, createdAt: "2026-01-06T09:00:00Z", readAt,
  });

  it("says how many notices are unread in the bell's name", async () => {
    current.notifications = [notice("n-1", null), notice("n-2", null), notice("n-3", "2026-01-07T09:00:00Z")];
    mount("/hub");
    const bell = await screen.findByRole("button", { name: "Notifications, 2 unread" });
    expect(bell.classList.contains("has-unread")).toBe(true);
    cleanup();
    current.notifications = [notice("n-3", "2026-01-07T09:00:00Z")];
    mount("/hub");
    expect(await screen.findByRole("button", { name: "Notifications" })).toBeTruthy();
  });

  it("names header buttons from what they show", async () => {
    mount("/hub");
    const search = await screen.findByRole("button", { name: "Search Commune" });
    expect(search.textContent).toContain("Search Commune");
    expect(search.querySelector("kbd")?.getAttribute("aria-hidden")).toBe("true");
    const you = screen.getByRole("button", { name: "You" });
    expect(you.querySelector(".avatar")?.getAttribute("aria-hidden")).toBe("true");
    expect(screen.getByRole("button", { name: "2 people in this commune, view members" })).toBeTruthy();
  });

  it("marks today and the selected day in the month view and says what each item is", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 9, 15, 12));
    const today = todayIso();
    const base = { hubId: commune.id, allDay: true, repeat: "none", status: "open", notes: "" } as const;
    current.operations = [
      { ...base, id: "task-late", kind: "task", category: "chore", title: "Bins", date: addDays(today, -2), assignee: user.name, assigneeId: user.id },
      { ...base, id: "task-today", kind: "task", category: "chore", title: "Hoover", date: today, assignee: user.name, assigneeId: user.id },
      { ...base, id: "event-today", kind: "event", category: "visit", title: "Plumber", date: today, assignee: "" },
    ];
    mount("/operations");
    fireEvent.click(await screen.findByText("Month"));
    const dayName = (date: string) => new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long" }).format(dateFromIso(date));
    const todayButton = screen.getByRole("button", { name: dayName(today) });
    expect(todayButton.getAttribute("aria-current")).toBe("date");
    expect(todayButton.getAttribute("aria-pressed")).toBe("true");
    expect(document.querySelectorAll('.ops-tile-num[aria-current="date"]')).toHaveLength(1);

    const later = screen.getByRole("button", { name: dayName(addDays(today, 5)) });
    expect(later.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(later);
    expect(later.getAttribute("aria-pressed")).toBe("true");
    expect(todayButton.getAttribute("aria-pressed")).toBe("false");
    expect(todayButton.getAttribute("aria-current")).toBe("date");

    // Each item says whether it is a task, an event or a late task, not only by tint.
    expect(screen.getByRole("button", { name: "Bins (late task)" }).classList.contains("is-warn")).toBe(true);
    expect(screen.getByRole("button", { name: "Hoover (task)" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Plumber (event)" })).toBeTruthy();
  });

  it("gives repeated actions the person and expense they are for", async () => {
    current.members = [...initial.members, { userId: "user-3", name: "Lodger", role: "member", active: true }];
    current.expenses = [{
      id: "expense-1", title: "Cleaner", amountMinor: 3000, paidByUserId: user.id, dueOn: null,
      shares: [
        { id: "share-1", userId: user.id, amountMinor: 1000, settledMinor: 1000 },
        { id: "share-2", userId: "user-2", amountMinor: 1000, settledMinor: 0 },
        { id: "share-3", userId: "user-3", amountMinor: 1000, settledMinor: 0 },
      ],
    }];
    mount("/settle");
    const owed = await screen.findByRole("region", { name: "You’re owed" });
    expect(within(owed).getAllByRole("button", { name: /^Nudge / }).map((button) => button.textContent))
      .toEqual(["Nudge Housemate about Cleaner", "Nudge Lodger about Cleaner"]);
    expect(within(owed).getByRole("button", { name: "Confirm received from Lodger for Cleaner" })).toBeTruthy();
    // The added words are for screen readers; the button still shows "Nudge".
    const hidden = within(owed).getAllByRole("button", { name: /^Nudge / })[0].querySelector(".c-visually-hidden");
    expect(hidden?.textContent).toBe("Housemate about Cleaner");
  });

  it("names note tiles from their content rather than a shorter label", async () => {
    current.notes = [{ id: "note-1", title: "Bins", pill: "Bins", kicker: "Everyone", lede: "", body: "Black bags on Tuesday", facts: [] }];
    mount("/notes");
    const tile = await screen.findByRole("button", { name: /^Bins/ });
    expect(tile.classList.contains("note-tile")).toBe(true);
    expect(tile.hasAttribute("aria-label")).toBe(false);
    expect(tile.textContent).toContain("Black bags on Tuesday");
  });
});

describe("Operations view switch and its Undo message", () => {
  const late = (): OperationItem => ({
    id: "task-1", hubId: commune.id, kind: "task", category: "chore", title: "Put the bins out", date: addDays(todayIso(), -2), allDay: true,
    assignee: user.name, assigneeId: user.id, rotation: [user.name, "Housemate"], repeat: "weekly", status: "open", notes: "",
    undoOccurrenceId: null, history: [], version: 1,
  });

  it("switches views with pressed buttons, not tabs", async () => {
    mount("/operations");
    const views = await screen.findByRole("group", { name: "Operations view" });
    const pressed = () => within(views).getAllByRole("button").map((button) => [button.textContent, button.getAttribute("aria-pressed")]);
    expect(pressed()).toEqual([["Week", "true"], ["People", "false"], ["Month", "false"]]);
    expect(screen.queryByRole("tablist")).toBeNull();
    expect(screen.queryAllByRole("tab")).toHaveLength(0);
    fireEvent.click(within(views).getByRole("button", { name: "People" }));
    expect(pressed()).toEqual([["Week", "false"], ["People", "true"], ["Month", "false"]]);
  });

  it("moves focus to Undo when a late card goes, keeps the message while focus is on it, and Undo returns focus", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"], shouldAdvanceTime: true });
    current.operations = [late()];
    const moved = addDays(todayIso(), 5);
    vi.mocked(post).mockImplementation(async (path) => {
      if (path === "/occurrences/occurrence-1/undo") {
        current.operations = [late()];
        return { id: "occurrence-1", duplicate: false, date: late().date, assignee: user.name, status: "open" };
      }
      current.operations = [{ ...late(), date: moved, assignee: "Housemate", assigneeId: "user-2", undoOccurrenceId: "occurrence-1" }];
      return { id: "occurrence-1", duplicate: false, date: moved, assignee: "Housemate", status: "open" };
    });
    mount("/operations");
    const done = await screen.findByRole("button", { name: "Done · Housemate (Put the bins out)" });
    done.focus();
    await act(async () => { fireEvent.click(done); });
    expect(screen.queryByRole("button", { name: /^Done · / })).toBeNull();
    const undo = within(screen.getByRole("status")).getByRole("button", { name: "Undo" });
    expect(document.activeElement).toBe(undo);

    // Well past the nine seconds: the message stays while focus is on it.
    act(() => { vi.advanceTimersByTime(15_000); });
    expect(screen.getByRole("status").contains(undo)).toBe(true);

    await act(async () => { fireEvent.click(undo); });
    expect(screen.getByRole("status").textContent).toContain("Undone · back with Test");
    const restored = screen.getByRole("button", { name: "Done · Housemate (Put the bins out)" });
    expect(document.activeElement).toBe(restored);
  });

  it("closes the message after nine seconds once focus has moved on", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"], shouldAdvanceTime: true });
    current.operations = [late()];
    vi.mocked(post).mockImplementation(async () => {
      current.operations = [{ ...late(), date: addDays(todayIso(), 5), undoOccurrenceId: "occurrence-1" }];
      return { id: "occurrence-1", duplicate: false, date: addDays(todayIso(), 5), assignee: "Housemate", status: "open" };
    });
    mount("/operations");
    const done = await screen.findByRole("button", { name: "Done · Housemate (Put the bins out)" });
    await act(async () => { fireEvent.click(done); });
    const undo = within(screen.getByRole("status")).getByRole("button", { name: "Undo" });
    expect(document.activeElement).toBe(undo);
    act(() => { fireEvent.blur(undo); screen.getByRole("button", { name: "Add item" }).focus(); });
    act(() => { vi.advanceTimersByTime(9_500); });
    expect(screen.getByRole("status").textContent).toBe("");
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Add item" }));
  });
});

describe("error display", () => {
  const changed = "This commune changed while you were editing. Reload and try again.";

  it("shows a refused commune settings save once, in the form", async () => {
    vi.mocked(api).mockImplementation(async (path, init) => {
      if (path === "/auth/me") return { user };
      if (path === "/reminders/usage") return { totalUsed: 0, totalLimit: 60, recipientLimit: 8, recipientUsage: {}, nextSlotAt: null };
      if (path.endsWith("/invites")) return { invites: [] };
      if (path === `/communes/${commune.id}` && init?.method === "PATCH") throw new ApiError(changed, 409);
      return { ok: true };
    });
    mount("/commune-settings");
    const name = await screen.findByLabelText("Commune name");
    fireEvent.change(name, { target: { value: "Park Road house" } });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Save changes" })); });
    const shown = await screen.findAllByText(changed);
    expect(shown).toHaveLength(1);
    expect(shown[0].classList.contains("a-form-error")).toBe(true);
    expect(shown[0].closest("form")).toBe(name.closest("form"));
    expect(screen.getAllByRole("alert")).toEqual([shown[0]]);
    expect(document.querySelector(".a-api-error")).toBeNull();
  });

  it("still raises the alert strip for a failed command that nothing on screen caught", async () => {
    mount("/hub");
    await screen.findByRole("heading", { name: "This Hub", level: 1 });
    vi.mocked(post).mockRejectedValueOnce(new ApiError("You can no longer change this.", 403));
    let failure: unknown;
    await act(async () => { await app.markNotificationRead("n-1").catch((error: unknown) => { failure = error; }); });
    expect(document.querySelector(".a-api-error")).toBeNull();

    // A rejection that is not a failed command is left to the browser.
    const other = Object.assign(new Event("unhandledrejection", { cancelable: true }), { reason: new Error("Something else") });
    act(() => { window.dispatchEvent(other); });
    expect(other.defaultPrevented).toBe(false);
    expect(document.querySelector(".a-api-error")).toBeNull();

    // What the browser sends when no handler caught the failed command.
    const unhandled = Object.assign(new Event("unhandledrejection", { cancelable: true }), { reason: failure });
    act(() => { window.dispatchEvent(unhandled); });
    expect(unhandled.defaultPrevented).toBe(true);
    const strip = screen.getByRole("alert");
    expect(strip.classList.contains("a-api-error")).toBe(true);
    expect(strip.textContent).toContain("You can no longer change this.");
  });
});

describe("form errors", () => {
  function signedOut() {
    vi.mocked(api).mockImplementation(async (path) => (path === "/auth/me" ? { user: null } : { ok: true }));
  }

  it("marks the field an error is about, points it at the message and moves focus to it", async () => {
    mount("/expenses");
    await screen.findByRole("heading", { name: "Expenses", level: 1 });
    act(() => app.go("add-expense"));
    const dialog = await screen.findByRole("dialog", { name: "Add expense" });
    const name = within(dialog).getByLabelText("What was it for?");
    const amount = within(dialog).getByLabelText(/^Amount/);

    fireEvent.click(within(dialog).getByRole("button", { name: "Save expense" }));
    const message = await within(dialog).findByRole("alert");
    expect(message.textContent).toBe("Name the expense before saving it.");
    await waitFor(() => expect(document.activeElement).toBe(name));
    expect(name.getAttribute("aria-invalid")).toBe("true");
    expect(name.getAttribute("aria-describedby")).toBe(message.id);
    // Shown under the field it is about.
    expect(name.closest(".a-field")?.contains(message)).toBe(true);
    expect(amount.hasAttribute("aria-invalid")).toBe(false);

    fireEvent.change(name, { target: { value: "Groceries" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save expense" }));
    await waitFor(() => expect(document.activeElement).toBe(amount));
    expect(amount.getAttribute("aria-invalid")).toBe("true");
    expect(amount.getAttribute("aria-describedby")).toBe(within(dialog).getByRole("alert").id);
    expect(name.hasAttribute("aria-invalid")).toBe(false);
    expect(name.hasAttribute("aria-describedby")).toBe(false);

    // The split has no single field, so its message takes focus.
    fireEvent.change(amount, { target: { value: "12.00" } });
    for (const box of within(dialog).getAllByRole("checkbox", { name: /^Include / })) fireEvent.click(box);
    fireEvent.click(within(dialog).getByRole("button", { name: "Save expense" }));
    const split = within(dialog).getByRole("alert");
    expect(split.textContent).toBe("Choose at least one person in the split.");
    expect(split.previousElementSibling?.matches("fieldset.c-split-editor")).toBe(true);
    await waitFor(() => expect(document.activeElement).toBe(split));
    expect(vi.mocked(post)).not.toHaveBeenCalled();
  });

  it("links the task form's missing title and date and focuses the first one", async () => {
    mount("/operations");
    await screen.findByRole("group", { name: "Operations view" });
    act(() => app.go("operation-new"));
    const dialog = await screen.findByRole("dialog", { name: "Add to calendar" });
    const date = within(dialog).getByLabelText(/^Date/);
    fireEvent.change(date, { target: { value: "" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Add to calendar" }));
    const title = within(dialog).getByLabelText(/^Title/);
    expect(document.activeElement).toBe(title);
    expect(title.getAttribute("aria-invalid")).toBe("true");
    expect(document.getElementById(title.getAttribute("aria-describedby")!)?.textContent).toBe("Add a title.");
    expect(document.getElementById(date.getAttribute("aria-describedby")!)?.textContent).toBe("Choose a date.");

    fireEvent.change(title, { target: { value: "Descale the kettle" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Add to calendar" }));
    expect(document.activeElement).toBe(date);
    expect(vi.mocked(post)).not.toHaveBeenCalled();
  });

  it("shows the password rule under the field and names the first field to fix", async () => {
    signedOut();
    mount("/signup");
    const password = await screen.findByLabelText("Password");
    const rule = screen.getByText("At least 12 characters.");
    expect(password.getAttribute("aria-describedby")).toBe(rule.id);

    const form = password.closest("form")!;
    fireEvent.submit(form);
    expect((await screen.findByRole("alert")).textContent).toBe("Enter your name.");
    await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText("Name")));

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Sam" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "sam@example.test" } });
    fireEvent.change(password, { target: { value: "too short" } });
    fireEvent.submit(form);
    const message = screen.getByRole("alert");
    expect(message.textContent).toBe("Use at least 12 characters for your password.");
    await waitFor(() => expect(document.activeElement).toBe(password));
    expect(password.getAttribute("aria-invalid")).toBe("true");
    expect(password.getAttribute("aria-describedby")).toBe(`${rule.id} ${message.id}`);
    expect(screen.getByLabelText("Name").hasAttribute("aria-invalid")).toBe(false);
    expect(vi.mocked(post)).not.toHaveBeenCalled();
  });

  it("moves focus to a refused sign-in's message rather than losing it", async () => {
    signedOut();
    vi.mocked(post).mockRejectedValue(new ApiError("Invalid email or password", 401));
    mount("/login");
    fireEvent.change(await screen.findByLabelText("Email"), { target: { value: "sam@example.test" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "not the password" } });
    expect(document.activeElement).toBe(document.body);
    await act(async () => { fireEvent.submit(screen.getByLabelText("Password").closest("form")!); });
    const message = screen.getByRole("alert");
    expect(message.textContent).toBe("Invalid email or password");
    await waitFor(() => expect(document.activeElement).toBe(message));
    // A sign-in page keeps one h1 at every width, and its main landmark.
    expect(screen.getAllByRole("heading", { level: 1 }).length).toBeGreaterThan(0);
    expect(screen.getByRole("main").contains(message)).toBe(true);
  });
});

describe("asking before typed text is thrown away", () => {
  async function openAddExpense() {
    mount("/expenses");
    await screen.findByRole("heading", { name: "Expenses", level: 1 });
    act(() => app.go("add-expense"));
    return screen.findByRole("dialog", { name: "Add expense" });
  }

  it("asks before Escape closes a window over typed text, and Keep editing goes back to it", async () => {
    const dialog = await openAddExpense();
    const name = within(dialog).getByLabelText("What was it for?");
    name.focus();
    fireEvent.input(name, { target: { value: "Window cleaner" } });
    fireEvent.keyDown(name, { key: "Escape" });
    const question = screen.getByRole("dialog", { name: "Discard your changes?" });
    expect(within(question).getByText("What you typed here hasn’t been saved.")).toBeTruthy();
    expect(document.activeElement).toBe(within(question).getByRole("button", { name: "Keep editing" }));
    expect(screen.getByRole("dialog", { name: "Add expense" })).toBe(dialog);

    fireEvent.click(within(question).getByRole("button", { name: "Keep editing" }));
    expect(screen.queryByRole("dialog", { name: "Discard your changes?" })).toBeNull();
    expect(document.activeElement).toBe(name);
    expect((name as HTMLInputElement).value).toBe("Window cleaner");

    // The close button asks too; Discard closes the window.
    fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));
    fireEvent.click(within(screen.getByRole("dialog", { name: "Discard your changes?" })).getByRole("button", { name: "Discard" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Add expense" })).toBeNull());
    expect(screen.queryByRole("dialog", { name: "Discard your changes?" })).toBeNull();
  });

  it("closes at once when nothing was typed, or the text was cleared again", async () => {
    let dialog = await openAddExpense();
    fireEvent.keyDown(document.body, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Add expense" })).toBeNull());
    expect(screen.queryByRole("dialog", { name: "Discard your changes?" })).toBeNull();

    act(() => app.go("add-expense"));
    dialog = await screen.findByRole("dialog", { name: "Add expense" });
    const name = within(dialog).getByLabelText("What was it for?");
    fireEvent.input(name, { target: { value: "Bins" } });
    fireEvent.input(name, { target: { value: "" } });
    fireEvent.keyDown(name, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Add expense" })).toBeNull());
    expect(screen.queryByRole("dialog", { name: "Discard your changes?" })).toBeNull();
  });

  it("asks before a dialog closes over typed text", () => {
    const onClose = vi.fn();
    render(<Dialog title="Record a repayment" onClose={onClose}><label>Note<input /></label><label>Search<input type="search" /></label></Dialog>);
    const dialog = screen.getByRole("dialog", { name: "Record a repayment" });
    // A search field is not work to lose.
    fireEvent.input(screen.getByLabelText("Search"), { target: { value: "rent" } });
    fireEvent(dialog, new Event("cancel", { cancelable: true }));
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.input(screen.getByLabelText("Note"), { target: { value: "Paid by bank transfer" } });
    fireEvent(dialog, new Event("cancel", { cancelable: true }));
    const question = screen.getByRole("dialog", { name: "Discard your changes?" });
    expect(onClose).toHaveBeenCalledTimes(1);
    // Escape on the question keeps editing and does not reach the dialog behind.
    fireEvent(question, new Event("cancel", { cancelable: true }));
    expect(screen.queryByRole("dialog", { name: "Discard your changes?" })).toBeNull();
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Close dialog" }));
    fireEvent.click(screen.getByRole("button", { name: "Discard" }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});

describe("structure and smaller fixes", () => {
  it("keeps the Hub's task box in a label, so the larger touch area works", async () => {
    current.operations = [{ id: "task-1", hubId: commune.id, kind: "task", category: "chore", title: "Bins", date: todayIso(), allDay: true, assignee: user.name, assigneeId: user.id, repeat: "none", status: "open", notes: "" }];
    mount("/hub");
    const box = await screen.findByRole("checkbox", { name: "Mark Bins done" });
    expect(box.parentElement?.tagName).toBe("LABEL");
    expect((box.parentElement as HTMLLabelElement).control).toBe(box);
  });
});
