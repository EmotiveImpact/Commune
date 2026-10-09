import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { App } from "../src/App";
import { AppProvider, useApp, type AppState } from "../src/state";
import { api, loadCommunes, loadSnapshot } from "../src/live/api";
import type { Commune, ReminderTarget, ReminderUsage, Snapshot } from "../src/live/model";
import { ReminderAllowanceNotice } from "../src/ui/ReminderUsage";

vi.mock("../src/live/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/live/api")>()),
  api: vi.fn(), post: vi.fn(), loadCommunes: vi.fn(), loadSnapshot: vi.fn(),
}));

// The reminder allowance is not part of who you are: it is said where
// reminders are sent, once a fifth of it or less is left.
const user = { id: "user-1", name: "Test Person", email: "test@example.test", emailVerified: true };
const housemate = "user-2";
const commune: Commune = { id: "home-1", name: "Our home", kind: "household", currency: "GBP", role: "admin" };
const target = { recipientUserId: housemate, amountMinor: 1500, currency: "GBP", label: "", dueOn: "2026-10-01", lastSentAt: null } as const;
const reminderTargets: ReminderTarget[] = [{ ...target, kind: "nudge", sourceId: "share-2" }, { ...target, kind: "chase", sourceId: "pledge-1" }];
const snapshot: Snapshot = {
  commune, reminderTargets, notifications: [], notes: [], operations: [], recurringBills: [], splitTemplates: [],
  activityEvents: [], announcements: [], sentReminders: [],
  members: [{ userId: user.id, name: user.name, role: "admin" }, { userId: housemate, name: "Housemate", role: "member" }],
  // The viewer paid for the gas, and admins chase pledges to the boiler fund.
  expenses: [{ id: "expense-1", title: "Gas", amountMinor: 3000, paidByUserId: user.id, dueOn: "2026-10-01", shares: [
    { id: "share-1", userId: user.id, amountMinor: 1500, settledMinor: 1500 },
    { id: "share-2", userId: housemate, amountMinor: 1500, settledMinor: 0 },
  ] }],
  funds: [{ id: "fund-1", name: "Boiler fund", targetMinor: 50000, createdBy: user.id, archivedAt: null, commitments: [
    { id: "pledge-1", userId: housemate, amountMinor: 5000, contributedMinor: 0, dueOn: "2026-10-01", cancelledAt: null, contributions: [] },
  ] }],
};
const allowance = (totalUsed: number, nextSlotAt: string | null = null): ReminderUsage =>
  ({ totalUsed, totalLimit: 60, recipientLimit: 6, recipientUsage: {}, nextSlotAt });
const nextSlotAt = "2026-11-02T10:00:00Z";
// When the next one comes back, in the member's own time zone.
const nextLabel = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })
  .format(new Date(nextSlotAt));
const low = "12 of your 60 reminders left. Each one comes back 30 days after it was sent.";

let usage: ReminderUsage;
let app: AppState;
function Capture() { app = useApp(); return null; }
function mount(path: string) {
  const location = memoryLocation({ path, record: true });
  render(<Router hook={location.hook}><AppProvider><Capture /><App /></AppProvider></Router>);
  return location;
}
const modalDescriptor = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "showModal");
const closeDescriptor = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "close");
beforeAll(() => {
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value: function (this: HTMLDialogElement) { this.setAttribute("open", ""); } });
  Object.defineProperty(HTMLDialogElement.prototype, "close", { configurable: true, value: function (this: HTMLDialogElement) { this.removeAttribute("open"); } });
});
afterAll(() => {
  for (const [name, descriptor] of [["showModal", modalDescriptor], ["close", closeDescriptor]] as const) {
    if (descriptor) Object.defineProperty(HTMLDialogElement.prototype, name, descriptor);
    else delete (HTMLDialogElement.prototype as unknown as Record<string, unknown>)[name];
  }
});
beforeEach(() => {
  vi.resetAllMocks();
  sessionStorage.clear();
  localStorage.clear();
  usage = allowance(0);
  vi.mocked(loadCommunes).mockImplementation(async () => ({ communes: [commune] }));
  vi.mocked(loadSnapshot).mockImplementation(async () => snapshot);
  vi.mocked(api).mockImplementation(async (path) => {
    if (path === "/auth/me") return { user };
    if (path === "/reminders/usage") return usage;
    if (path.endsWith("/invites")) return { invites: [] };
    return { ok: true };
  });
});
afterEach(cleanup);

describe("the reminder allowance", () => {
  it("says nothing until a fifth or fewer are left, then how many and when they come back", () => {
    const { container, rerender } = render(<ReminderAllowanceNotice usage={allowance(47)} />);
    expect(container.textContent).toBe("");
    rerender(<ReminderAllowanceNotice usage={allowance(48)} />);
    expect(screen.getByRole("note").textContent).toBe(low);
    rerender(<ReminderAllowanceNotice usage={allowance(59)} />);
    expect(screen.getByRole("note").textContent).toBe("1 of your 60 reminders left. Each one comes back 30 days after it was sent.");
    rerender(<ReminderAllowanceNotice usage={allowance(60)} />);
    expect(screen.getByRole("note").textContent).toBe("No reminders left.");
    rerender(<ReminderAllowanceNotice usage={allowance(61, nextSlotAt)} />);
    expect(screen.getByRole("note").textContent).toBe(`No reminders left. The next one comes back on ${nextLabel}.`);
    rerender(<ReminderAllowanceNotice usage={null} />);
    expect(container.textContent).toBe("");
  });

  it.each(["/funds", "/settle"])("stays out of the sidebar's account line and the %s toolbar", async (path) => {
    mount(path);
    await waitFor(() => expect(app.reminderUsage).not.toBeNull());
    // Only the role sits under the name: a new member has nothing to count yet.
    expect(document.querySelector(".a-side-account-meta")?.textContent).toBe("Admin");
    expect(document.querySelector(".a-side-account .a-reminder-usage")).toBeNull();
    expect(document.querySelector(`${path.replace("/", "#")} .a-toolbar .a-reminder-usage`)).toBeNull();
    expect(screen.queryByText(/reminders left/)).toBeNull();
  });

  it("is said on Settle, the expense and the fund once it runs low", async () => {
    usage = allowance(47);
    mount("/settle");
    const owed = await screen.findByRole("region", { name: "You’re owed" });
    await within(owed).findByText("Housemate owes you");
    await waitFor(() => expect(app.reminderUsage?.totalUsed).toBe(47));
    // Thirteen of sixty left is more than a fifth: nothing to say yet.
    expect(screen.queryByRole("note")).toBeNull();
    usage = allowance(48);
    await act(async () => app.refresh());
    expect((await within(owed).findByRole("note")).textContent).toBe(low);
    // Only where reminders are sent: not on what you owe.
    expect(within(screen.getByRole("region", { name: "You owe" })).queryByRole("note")).toBeNull();
    await act(async () => app.go("expense", { expense: "expense-1" }));
    expect(within(await screen.findByRole("dialog", { name: "Gas" })).getByRole("note").textContent).toBe(low);
    await act(async () => app.go("funds"));
    fireEvent.click(await screen.findByRole("button", { name: "View fund Boiler fund" }));
    const fund = await screen.findByRole("dialog", { name: "Boiler fund" });
    expect(within(fund).getByRole("note").textContent).toBe(low);
    // None left: when the next one comes back.
    usage = allowance(60, nextSlotAt);
    await act(async () => app.refresh());
    await waitFor(() => expect(within(fund).getByRole("note").textContent).toBe(`No reminders left. The next one comes back on ${nextLabel}.`));
  });

  it("is not offered to someone who cannot send one", async () => {
    usage = allowance(55);
    // A member's own pledge, and an expense someone else paid for.
    vi.mocked(loadCommunes).mockImplementation(async () => ({ communes: [{ ...commune, role: "member" }] }));
    vi.mocked(loadSnapshot).mockImplementation(async () => ({ ...snapshot, commune: { ...commune, role: "member" },
      expenses: [{ ...snapshot.expenses[0], paidByUserId: housemate, shares: [
        { id: "share-1", userId: user.id, amountMinor: 1500, settledMinor: 0 },
        { id: "share-2", userId: housemate, amountMinor: 1500, settledMinor: 1500 },
      ] }] }));
    mount("/settle");
    await within(await screen.findByRole("region", { name: "You owe" })).findByText("You owe Housemate");
    await waitFor(() => expect(app.reminderUsage?.totalUsed).toBe(55));
    expect(screen.queryByRole("note")).toBeNull();
    await act(async () => app.go("expense", { expense: "expense-1" }));
    expect(within(await screen.findByRole("dialog", { name: "Gas" })).queryByRole("note")).toBeNull();
    await act(async () => app.go("funds"));
    fireEvent.click(await screen.findByRole("button", { name: "View fund Boiler fund" }));
    expect(within(await screen.findByRole("dialog", { name: "Boiler fund" })).queryByRole("note")).toBeNull();
  });
});
