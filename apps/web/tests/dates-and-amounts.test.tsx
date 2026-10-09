import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { App } from "../src/App";
import { AppProvider } from "../src/state";
import { api, post, loadCommunes, loadSnapshot } from "../src/live/api";
import { formatReminderDay, formatTimestampDay } from "../src/data/reminders";
import type { Commune, Snapshot } from "../src/live/model";

vi.mock("../src/live/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/live/api")>()),
  api: vi.fn(), post: vi.fn(), loadCommunes: vi.fn(), loadSnapshot: vi.fn(),
}));

// One way of writing money and dates on every screen: "$32.10" in a US dollar
// commune, and "6 Oct" (with the year when it is not this year) for every date.
const user = { id: "user-1", name: "Test Person", email: "test@example.test", emailVerified: true };
const loft: Commune = { id: "loft-1", name: "Brooklyn loft", kind: "household", currency: "USD", role: "admin" };
const snapshot: Snapshot = {
  commune: loft,
  members: [
    { userId: user.id, name: user.name, role: "admin", active: true },
    { userId: "user-2", name: "Housemate", role: "member", active: true },
  ],
  expenses: [{
    id: "expense-1", title: "Internet", category: "Bills", amountMinor: 6420, paidByUserId: "user-2", dueOn: "2026-10-06",
    createdAt: "2026-10-01T10:00:00Z",
    shares: [
      { id: "share-1", userId: user.id, amountMinor: 3210, settledMinor: 0 },
      { id: "share-2", userId: "user-2", amountMinor: 3210, settledMinor: 3210 },
    ],
  }],
  funds: [{
    id: "fund-1", name: "New sofa", targetMinor: 50000, createdBy: user.id, archivedAt: null,
    commitments: [{
      id: "pledge-1", userId: user.id, amountMinor: 10000, dueOn: "2026-11-04", contributedMinor: 2500, cancelledAt: null,
      contributions: [{ id: "contribution-1", amountMinor: 2500, contributedAt: "2026-10-02T12:00:00Z", voidedAt: null, voidReason: null }],
    }],
  }],
  notifications: [{
    id: "notice-1", kind: "nudge", sourceId: "share-1", amountMinor: 3210, communeId: loft.id, senderUserId: "user-2",
    expenseId: "expense-1", title: "Internet", detail: null, createdAt: "2026-10-09T09:00:00Z", readAt: null,
  }],
  notes: [], operations: [], reminderTargets: [], sentReminders: [], recurringBills: [], splitTemplates: [], activityEvents: [],
};
function mount(path: string) {
  render(<Router hook={memoryLocation({ path, record: true }).hook}><AppProvider><App /></AppProvider></Router>);
}
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
    if (path === "/reminders/usage") return { totalUsed: 0, totalLimit: 60, recipientLimit: 8, recipientUsage: {}, nextSlotAt: null };
    if (path.endsWith("/invites")) return { invites: [] };
    if (path === "/notices/unread") return { notices: [] };
    return { ok: true };
  });
  vi.mocked(post).mockResolvedValue({ ok: true });
  vi.mocked(loadCommunes).mockResolvedValue({ communes: [{ ...loft, unreadNotices: 1 }] });
  vi.mocked(loadSnapshot).mockImplementation(async () => snapshot);
});
afterEach(cleanup);

describe("dates and amounts", () => {
  it("writes US dollars as $32.10, never US$", async () => {
    mount("/hub");
    await screen.findAllByText("$32.10");
    expect(document.body.textContent).not.toContain("US$");
  });

  it("says when an expense is due the way every screen does", async () => {
    mount("/expenses");
    fireEvent.click(await screen.findByRole("button", { name: /Internet/ }));
    const expense = await screen.findByRole("dialog", { name: "Internet" });
    expect(within(expense).getByText(`Due ${formatReminderDay("2026-10-06")}`)).toBeTruthy();
    expect(expense.textContent).not.toContain("2026-10-06");
    expect(expense.textContent).toContain("Housemate paid $64.20.");
  });

  it("dates a notice the same way", async () => {
    mount("/hub");
    fireEvent.click(await screen.findByRole("button", { name: "Notifications, 1 unread" }));
    const notices = await screen.findByRole("dialog", { name: "Notices" });
    expect(notices.textContent).toContain(`$32.10 · ${formatTimestampDay("2026-10-09T09:00:00Z")}`);
    expect(notices.textContent).not.toMatch(/\d{2}\/\d{2}\/\d{4}/);
  });

  it("dates pledges and contributions the same way", async () => {
    mount("/funds");
    fireEvent.click(await screen.findByRole("button", { name: "View fund New sofa" }));
    const pledge = await screen.findByText(/Pledged \$100\.00 · due/);
    expect(pledge.textContent).toBe(`Pledged $100.00 · due ${formatReminderDay("2026-11-04")}`);
    expect(document.body.textContent).toContain(`$25.00 · ${formatTimestampDay("2026-10-02T12:00:00Z")}`);
    expect(document.body.textContent).not.toMatch(/\d{2}\/\d{2}\/\d{4}|2026-11-04/);
  });
});
