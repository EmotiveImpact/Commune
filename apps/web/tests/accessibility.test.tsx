import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { App } from "../src/App";
import { AppProvider, useApp, type AppState } from "../src/state";
import { api, post, loadCommunes, loadSnapshot } from "../src/live/api";
import type { Commune, Snapshot } from "../src/live/model";

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
afterEach(cleanup);

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
