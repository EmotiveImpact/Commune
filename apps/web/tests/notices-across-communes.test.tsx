import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { App } from "../src/App";
import { AppProvider, useApp, type AppState } from "../src/state";
import { api, post, loadCommunes, loadSnapshot } from "../src/live/api";
import type { Commune, Notification, Snapshot, UnreadNotice } from "../src/live/model";

vi.mock("../src/live/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/live/api")>()),
  api: vi.fn(), post: vi.fn(), loadCommunes: vi.fn(), loadSnapshot: vi.fn(),
}));

// The bell counts unread notices in every commune (0039), and Notices lists
// the other communes' unread ones under their names.
const user = { id: "user-1", name: "Test Person", email: "test@example.test", emailVerified: true };
const home: Commune = { id: "home-1", name: "Our home", kind: "household", currency: "GBP", role: "admin" };
const trip: Commune = { id: "trip-1", name: "Lisbon trip", kind: "trip", currency: "EUR", role: "member" };
const members = [
  { userId: user.id, name: user.name, role: "admin" as const, active: true },
  { userId: "user-2", name: "Housemate Two", role: "member" as const, active: true },
];
const homeNotice: Notification = {
  id: "notice-home", kind: "payment-reported", sourceId: "expense-home", amountMinor: 1200, communeId: home.id,
  senderUserId: "user-2", expenseId: "expense-home", title: "Gas", detail: null, createdAt: "2026-10-06T09:00:00Z", readAt: null,
};
const tripNotice: UnreadNotice = {
  id: "notice-trip", kind: "expense-corrected", sourceId: "expense-trip", amountMinor: 2500, communeId: trip.id,
  senderUserId: "user-3", expenseId: "expense-trip", title: "Ferry tickets", detail: "Ann had the cabin",
  createdAt: "2026-10-07T09:00:00Z", readAt: null, senderName: "Ben Baker", fundId: null,
};
const ferryExpense = {
  id: "expense-trip", title: "Ferry tickets", amountMinor: 4000, paidByUserId: "user-2", dueOn: null,
  shares: [
    { id: "share-trip-1", userId: user.id, amountMinor: 2500, settledMinor: 0 },
    { id: "share-trip-2", userId: "user-2", amountMinor: 1500, settledMinor: 1500 },
  ],
};
function snapshotOf(commune: Commune, extra: Partial<Snapshot> = {}): Snapshot {
  return {
    commune, members, expenses: [], funds: [], notes: [], operations: [], notifications: [], reminderTargets: [],
    recurringBills: [], splitTemplates: [], activityEvents: [], announcements: [], sentReminders: [], ...extra,
  };
}
let snapshots: Record<string, Snapshot>;
let listed: Commune[];
let unread: UnreadNotice[];
let app: AppState;
function Capture() { app = useApp(); return null; }
function mount(path: string) {
  const location = memoryLocation({ path, record: true });
  render(<Router hook={location.hook}><AppProvider><Capture /><App /></AppProvider></Router>);
  return location;
}
const modalDescriptor = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "showModal");
const originalScroll = Element.prototype.scrollIntoView;
beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value: function (this: HTMLDialogElement) { this.setAttribute("open", ""); } });
});
afterAll(() => {
  Element.prototype.scrollIntoView = originalScroll;
  if (modalDescriptor) Object.defineProperty(HTMLDialogElement.prototype, "showModal", modalDescriptor);
  else delete (HTMLDialogElement.prototype as unknown as Record<string, unknown>).showModal;
});
beforeEach(() => {
  vi.resetAllMocks();
  sessionStorage.clear();
  localStorage.clear();
  snapshots = {
    [home.id]: snapshotOf({ ...home, unreadNotices: 1 }, { notifications: [homeNotice] }),
    [trip.id]: snapshotOf({ ...trip, unreadNotices: 2 }, { expenses: [ferryExpense] }),
  };
  listed = [{ ...home, unreadNotices: 1 }, { ...trip, unreadNotices: 2 }];
  unread = [tripNotice, { ...tripNotice, id: "notice-trip-2", kind: "payment-confirmed", title: "Dinner", expenseId: "expense-dinner",
    createdAt: "2026-10-05T09:00:00Z" }, { ...homeNotice, senderName: "Housemate Two", fundId: null }];
  vi.mocked(loadCommunes).mockImplementation(async () => ({ communes: listed }));
  vi.mocked(loadSnapshot).mockImplementation(async (commune) => snapshots[commune.id]);
  vi.mocked(api).mockImplementation(async (path) => {
    if (path === "/auth/me") return { user };
    if (path === "/reminders/usage") return { totalUsed: 0, totalLimit: 60, recipientLimit: 8, recipientUsage: {}, nextSlotAt: null };
    if (path.endsWith("/invites")) return { invites: [] };
    if (path === "/notices/unread") return { notices: unread };
    return { ok: true };
  });
});
afterEach(cleanup);

describe("notices across communes", () => {
  it.each(["/", "/hub", "/expenses"])("counts every commune's unread notices in the bell on %s", async (path) => {
    mount(path);
    const bell = await screen.findByRole("button", { name: "Notifications, 3 unread" });
    expect(bell.classList.contains("has-unread")).toBe(true);
  });

  it("falls back to the open commune's own notices while the database sends no counts", async () => {
    listed = [home, trip];
    snapshots[home.id] = snapshotOf(home, { notifications: [homeNotice] });
    mount("/hub");
    expect(await screen.findByRole("button", { name: "Notifications, 1 unread" })).toBeTruthy();
  });

  it("lists this commune's notices first, then other communes' unread ones under their names", async () => {
    mount("/hub");
    fireEvent.click(await screen.findByRole("button", { name: "Notifications, 3 unread" }));
    const notices = await screen.findByRole("dialog", { name: "Notices" });
    await within(notices).findByText("Ferry tickets");
    const headings = within(notices).getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent);
    expect(headings).toEqual(["Our home", "Lisbon trip"]);
    const here = within(notices).getByRole("region", { name: "Our home" });
    expect(within(here).getByText("Gas")).toBeTruthy();
    expect(within(here).getByText(/Housemate Two says they sent £12\.00/)).toBeTruthy();
    const there = within(notices).getByRole("region", { name: "Lisbon trip" });
    // Their own commune's notices are not repeated, and amounts use that commune's currency.
    expect(within(there).queryByText("Gas")).toBeNull();
    expect(within(there).getByText(/Corrected by Ben Baker · your share is now €25\.00/)).toBeTruthy();
    expect(within(there).getByText("Dinner")).toBeTruthy();
    expect(vi.mocked(api).mock.calls.filter(([path]) => path === "/notices/unread")).toHaveLength(1);
  });

  it("reads a notice from another commune there, then switches to that commune and opens it", async () => {
    vi.mocked(post).mockImplementation(async () => {
      snapshots[trip.id] = snapshotOf({ ...trip, unreadNotices: 1 }, { expenses: [ferryExpense] });
      return { ok: true };
    });
    mount("/hub");
    fireEvent.click(await screen.findByRole("button", { name: "Notifications, 3 unread" }));
    const notices = await screen.findByRole("dialog", { name: "Notices" });
    const ferry = await within(notices).findByText("Ferry tickets");
    await act(async () => { fireEvent.click(ferry.closest("button")!); });
    expect(vi.mocked(post)).toHaveBeenCalledWith("/notifications/notice-trip/read", {});
    await waitFor(() => expect(app.hub.id).toBe(trip.id));
    expect(app.window).toBe("expense");
    expect(app.selectedExpense?.id).toBe("expense-trip");
    // The trip was read again after the notice was, so its count is the new one.
    expect(vi.mocked(loadSnapshot).mock.calls.some(([commune, detail]) => commune.id === trip.id && detail === undefined)).toBe(true);
    expect(await screen.findByRole("button", { name: "Notifications, 2 unread" })).toBeTruthy();
  });

  it("does not ask for other communes' notices when none are unread", async () => {
    listed = [{ ...home, unreadNotices: 1 }, { ...trip, unreadNotices: 0 }];
    mount("/hub");
    fireEvent.click(await screen.findByRole("button", { name: "Notifications, 1 unread" }));
    const notices = await screen.findByRole("dialog", { name: "Notices" });
    expect(within(notices).getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent)).toEqual(["Our home"]);
    expect(vi.mocked(api).mock.calls.some(([path]) => path === "/notices/unread")).toBe(false);
  });

  it("keeps this commune's notices when the others cannot be read, and offers to try again", async () => {
    let fail = true;
    vi.mocked(api).mockImplementation(async (path) => {
      if (path === "/auth/me") return { user };
      if (path === "/reminders/usage") return { totalUsed: 0, totalLimit: 60, recipientLimit: 8, recipientUsage: {}, nextSlotAt: null };
      if (path.endsWith("/invites")) return { invites: [] };
      if (path === "/notices/unread") {
        if (fail) throw new Error("Notices could not be verified. Please try again.");
        return { notices: unread };
      }
      return { ok: true };
    });
    mount("/hub");
    fireEvent.click(await screen.findByRole("button", { name: "Notifications, 3 unread" }));
    const notices = await screen.findByRole("dialog", { name: "Notices" });
    const there = within(notices).getByRole("region", { name: "Lisbon trip" });
    expect((await within(there).findByRole("alert")).textContent).toContain("Notices could not be verified");
    expect(within(notices).getByText("Gas")).toBeTruthy();
    fail = false;
    fireEvent.click(within(there).getByRole("button", { name: "Try again" }));
    expect(await within(there).findByText("Ferry tickets")).toBeTruthy();
  });
});
