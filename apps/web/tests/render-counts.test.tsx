import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { App } from "../src/App";
import { AppProvider } from "../src/state";
import { api, loadCommunes, loadSnapshot, post } from "../src/live/api";
import type { Commune, Expense, LiveNote, Snapshot } from "../src/live/model";

// Typing in a filter, the minute check and a notice count elsewhere
// re-render only what shows them. Each test prints what rendered, so a
// regression says where it is.
//
// Which components React rendered in each commit, read the way React
// DevTools reads it: a component rendered when it mounted or its fiber
// performed work, and a subtree whose children were reused did not render.
type Fiber = {
  tag: number; flags: number; type: { name?: string; displayName?: string; render?: { name?: string } } | null;
  child: Fiber | null; sibling: Fiber | null; alternate: Fiber | null;
};
const renders = vi.hoisted(() => {
  const counts = new Map<string, number>();
  const PERFORMED_WORK = 1;
  // Function, class, forwardRef and simple memo components.
  const COMPONENTS = new Set([0, 1, 11, 15]);
  const nameOf = (fiber: Fiber) => fiber.type?.displayName || fiber.type?.name || fiber.type?.render?.name || "(unnamed)";
  function visit(next: Fiber, previous: Fiber | null) {
    if (COMPONENTS.has(next.tag) && (!previous || (next.flags & PERFORMED_WORK))) {
      counts.set(nameOf(next), (counts.get(nameOf(next)) ?? 0) + 1);
    }
    if (previous && next.child === previous.child) return;
    for (let child = next.child; child; child = child.sibling) visit(child, child.alternate);
  }
  (globalThis as Record<string, unknown>).__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
    supportsFiber: true,
    inject: () => 1,
    checkDCE: () => undefined,
    onCommitFiberUnmount: () => undefined,
    onPostCommitFiberRoot: () => undefined,
    onCommitFiberRoot: (_renderer: number, root: { current: Fiber }) => visit(root.current, root.current.alternate),
  };
  return {
    reset: () => counts.clear(),
    of: (name: string) => counts.get(name) ?? 0,
    total: () => [...counts.values()].reduce((sum, count) => sum + count, 0),
    /** The most rendered components, for the report. */
    top: (limit = 12) => [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit)
      .map(([name, count]) => `${name} ${count}`).join(", "),
  };
});

vi.mock("../src/live/api", async (importOriginal) => ({
  ...await importOriginal<typeof import("../src/live/api")>(),
  api: vi.fn(), post: vi.fn(), loadCommunes: vi.fn(), loadSnapshot: vi.fn(),
}));

const user = { id: "user-1", name: "Test Person", email: "test@example.test", emailVerified: true };
const housemate = { userId: "user-2", name: "Housemate", role: "member" as const, active: true };
const home: Commune = { id: "home-1", name: "Our home", kind: "household", currency: "GBP", role: "admin", changeMark: "2026-10-08:3:30", unreadNotices: 0 };
const trip: Commune = { id: "trip-1", name: "Lisbon trip", kind: "trip", currency: "EUR", role: "member", changeMark: "2026-10-08:2:12", unreadNotices: 0 };

// Forty expenses this month: twelve still open, with due dates, and the rest settled.
const now = new Date();
const thisMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
function expense(index: number): Expense {
  const open = index < 12;
  const day = String(1 + (index % 7)).padStart(2, "0");
  return {
    id: `expense-${index}`, title: `Shared item ${index}`, category: index % 2 ? "Bills" : "Groceries", amountMinor: 3000 + index,
    paidByUserId: index % 3 ? user.id : housemate.userId, dueOn: open ? `${thisMonth}-${day}` : null,
    createdAt: `${thisMonth}-${day}T12:00:00.000Z`, version: 1, voidedAt: null,
    shares: [
      { id: `share-${index}-a`, userId: user.id, amountMinor: 1500, settledMinor: index % 3 ? 1500 : open ? 0 : 1500 },
      { id: `share-${index}-b`, userId: housemate.userId, amountMinor: 1500 + index, settledMinor: index % 3 && open ? 0 : 1500 + index },
    ],
  };
}
const notes: LiveNote[] = Array.from({ length: 8 }, (_, index) => ({
  id: `note-${index}`, title: `Wi-Fi note ${index}`, pill: "Other", kicker: "Everyone", lede: "", body: `Shared detail ${index}`, facts: [], version: 1,
}));
function record(commune: Commune, expenses: Expense[]): Snapshot {
  const { changeMark, unreadNotices: _count, ...identity } = commune;
  return {
    commune: identity, members: [{ userId: user.id, name: user.name, role: commune.role, active: true }, housemate],
    expenses, funds: [], notes, operations: [], notifications: [], reminderTargets: [], sentReminders: [],
    recurringBills: [], splitTemplates: [], activityEvents: [], changeMark,
  };
}

let listed: Commune[];
const records: Record<string, Snapshot> = {
  [home.id]: record(home, Array.from({ length: 40 }, (_, index) => expense(index))),
  [trip.id]: record(trip, []),
};
const settle = () => act(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));

beforeEach(() => {
  vi.resetAllMocks();
  sessionStorage.clear();
  listed = [home, trip];
  vi.mocked(api).mockImplementation(async (path) => {
    if (path === "/auth/me") return { user };
    if (path === "/reminders/usage") return { totalUsed: 0, totalLimit: 60, recipientLimit: 6, recipientUsage: {}, nextSlotAt: null };
    if (path.endsWith("/invites")) return { invites: [] };
    throw new Error(`Unexpected API request ${path}`);
  });
  vi.mocked(post).mockResolvedValue({ ok: true });
  // Each check answers with new objects, as the network does.
  vi.mocked(loadCommunes).mockImplementation(async () => ({ communes: listed.map((commune) => ({ ...commune })) }));
  vi.mocked(loadSnapshot).mockImplementation(async (commune, detail) => detail ? { ...records[commune.id], detail } : records[commune.id]);
  // Midday, so the minute that passes never crosses into another day.
  const midday = new Date();
  midday.setHours(12, 0, 0, 0);
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(midday);
  vi.spyOn(window, "setInterval");
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

async function started(path: string) {
  const location = memoryLocation({ path, record: true });
  render(<Router hook={location.hook}><AppProvider><App /></AppProvider></Router>);
  await waitFor(() => expect(vi.mocked(api).mock.calls.some(([called]) => called === "/reminders/usage")).toBe(true));
  await settle();
}
// The app's minute timer runs once, a minute later.
async function minutePasses() {
  vi.advanceTimersByTime(60_000);
  const timer = vi.mocked(window.setInterval).mock.calls.filter(([, delay]) => delay === 60_000).at(-1)?.[0];
  act(() => (timer as () => void)());
  await settle();
}
function report(scenario: string) {
  console.info(`[render counts] ${scenario}: ${renders.total()} renders (${renders.top()})`);
}

describe("what re-renders", () => {
  it("typing in the Expenses filter re-renders the Expenses screen, not its cards or the rest of the app", async () => {
    await started(`/expenses?commune=${home.id}`);
    const filter = await screen.findByRole("searchbox", { name: "Filter expenses in this commune" });
    expect(document.querySelectorAll(".c-expense-entry")).toHaveLength(40);
    renders.reset();
    // Every expense still matches, so the same cards stay on screen.
    fireEvent.change(filter, { target: { value: "s" } });
    report("typing one letter in the Expenses filter");
    expect(document.querySelectorAll(".c-expense-entry")).toHaveLength(40);
    expect(renders.of("ExpensesScreen")).toBe(1);
    expect([renders.of("ExpenseCard"), renders.of("Pill"), renders.of("CalendarDate"), renders.of("ProductShell"), renders.of("Sidebar"), renders.of("Header")])
      .toEqual([0, 0, 0, 0, 0, 0]);
    // The screen and the two icons in its toolbar (each icon is two components).
    expect(renders.total()).toBeLessThanOrEqual(5);
  });

  it("a minute check that finds nothing new re-renders nothing", async () => {
    await started(`/expenses?commune=${home.id}`);
    renders.reset();
    await minutePasses();
    expect(loadCommunes).toHaveBeenCalledTimes(2);
    report("a minute check that finds nothing new");
    expect(renders.total()).toBe(0);
  });

  it("a new notice in another commune re-renders the bell, not the screen", async () => {
    await started(`/expenses?commune=${home.id}`);
    renders.reset();
    listed = [home, { ...trip, unreadNotices: 2 }];
    await minutePasses();
    report("a notice count changing in another commune");
    expect(screen.getByRole("button", { name: "Notifications, 2 unread" })).toBeTruthy();
    expect(renders.of("Header")).toBe(1);
    expect([renders.of("ExpensesScreen"), renders.of("ProductShell"), renders.of("Sidebar")]).toEqual([0, 0, 0]);
    expect(renders.total()).toBeLessThanOrEqual(8);
  });

  it("typing in the Notes filter re-renders the Notes screen only", async () => {
    await started(`/notes?commune=${home.id}`);
    const filter = await screen.findByRole("searchbox", { name: "Search notes in this commune" });
    renders.reset();
    fireEvent.change(filter, { target: { value: "w" } });
    report("typing one letter in the Notes filter");
    expect(renders.of("NotesScreen")).toBe(1);
    expect([renders.of("NoteTile"), renders.of("NoteIcon"), renders.of("ProductShell"), renders.of("Sidebar"), renders.of("Header")])
      .toEqual([0, 0, 0, 0, 0]);
    expect(renders.total()).toBeLessThanOrEqual(5);
  });
});
