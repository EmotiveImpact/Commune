import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { App } from "../src/App";
import { AppProvider, useApp, type AppState } from "../src/state";
import { api, loadCommunes, loadSnapshot } from "../src/live/api";
import { hubFromSnapshot, personName, type Commune, type Snapshot } from "../src/live/model";
import { initialsOf } from "../src/data/household";

vi.mock("../src/live/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/live/api")>()),
  api: vi.fn(), post: vi.fn(), loadCommunes: vi.fn(), loadSnapshot: vi.fn(),
}));

// Someone who has left keeps their name wherever their records appear (the
// snapshot keeps them, 0031), marked "(left)" where it matters that they are
// no longer a member. The generic words are only for someone it does not know.
const user = { id: "user-1", name: "Maya Chen", email: "maya@example.test", emailVerified: true };
const commune: Commune = { id: "home-1", name: "Our home", kind: "household", currency: "GBP", role: "admin" };
const members = [
  { userId: user.id, name: user.name, role: "admin" as const, active: true },
  { userId: "user-2", name: "Ben Baker", role: "member" as const, active: true },
  { userId: "user-3", name: "Lee Lane", role: "member" as const, active: false },
];
let current: Snapshot;
let app: AppState;
function Capture() { app = useApp(); return null; }
function mount(path: string) {
  const location = memoryLocation({ path, record: true });
  render(<Router hook={location.hook}><AppProvider><Capture /><App /></AppProvider></Router>);
  return location;
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
  for (const [name, descriptor] of [["showModal", modalDescriptor], ["close", closeDescriptor]] as const) {
    if (descriptor) Object.defineProperty(HTMLDialogElement.prototype, name, descriptor);
    else delete (HTMLDialogElement.prototype as unknown as Record<string, unknown>)[name];
  }
});
beforeEach(() => {
  vi.resetAllMocks();
  sessionStorage.clear();
  localStorage.clear();
  current = {
    commune, members, funds: [], notes: [], operations: [], reminderTargets: [], recurringBills: [], activityEvents: [],
    sentReminders: [],
    expenses: [{
      // Lee left owing Maya for the cleaner, after paying back part of it.
      id: "expense-1", title: "Cleaner", amountMinor: 3000, paidByUserId: user.id, dueOn: null, createdAt: "2026-10-01T09:00:00Z",
      shares: [
        { id: "share-1", userId: user.id, amountMinor: 1500, settledMinor: 1500 },
        { id: "share-3", userId: "user-3", amountMinor: 1500, settledMinor: 500, receipts: [{
          id: "receipt-1", amountMinor: 500, receivedOn: "2026-10-02", reference: null, recordedBy: user.id,
          recordedAt: "2026-10-02T10:00:00Z", origin: "recorded", reversedAt: null, reversedBy: null, reversalReason: null,
        }] },
      ],
    }, {
      // Lee paid for the paint before leaving; Maya still owes her share.
      id: "expense-2", title: "Paint", amountMinor: 2000, paidByUserId: "user-3", dueOn: null, createdAt: "2026-09-20T09:00:00Z",
      shares: [{ id: "share-4", userId: user.id, amountMinor: 1000, settledMinor: 0 }, { id: "share-5", userId: "user-3", amountMinor: 1000, settledMinor: 1000 }],
    }],
    splitTemplates: [{ id: "template-1", name: "Thirds", method: "Equal", createdBy: user.id, archivedAt: null,
      participants: [{ userId: user.id, value: "" }, { userId: "user-3", value: "" }] }],
    announcements: [{ id: "announcement-1", title: "Boiler service", body: "", authorId: "user-3",
      createdAt: "2026-10-06T09:00:00.000Z", needsAcknowledgement: false, acknowledgements: [] }],
    notifications: [{
      id: "notice-1", kind: "payment-reported", sourceId: "share-3", amountMinor: 500, communeId: commune.id, senderUserId: "user-3",
      expenseId: "expense-1", title: "Cleaner", detail: null, createdAt: "2026-10-02T09:00:00Z", readAt: null,
    }],
  };
  vi.mocked(loadCommunes).mockImplementation(async () => ({ communes: [commune] }));
  vi.mocked(loadSnapshot).mockImplementation(async () => current);
  vi.mocked(api).mockImplementation(async (path) => {
    if (path === "/auth/me") return { user };
    if (path === "/reminders/usage") return { totalUsed: 0, totalLimit: 60, recipientLimit: 8, recipientUsage: {}, nextSlotAt: null };
    if (path.endsWith("/invites")) return { invites: [] };
    return { ok: true };
  });
});
afterEach(cleanup);

describe("naming people", () => {
  it("names anyone the snapshot knows, marks who has left where asked, and keeps the generic words for strangers", () => {
    expect(personName(members, "user-2", "a former member", { left: true })).toBe("Ben Baker");
    expect(personName(members, "user-3", "a former member")).toBe("Lee Lane");
    expect(personName(members, "user-3", "a former member", { left: true })).toBe("Lee Lane (left)");
    expect(personName(members, "user-9", "a former member", { left: true })).toBe("a former member");
    expect(personName(members, null, "Someone")).toBe("Someone");
    expect(personName([{ userId: "user-4", name: "  ", role: "member" }], "user-4", "Someone")).toBe("Someone");
  });

  it("gives someone without a name a neutral mark, not letters from nowhere", () => {
    expect(initialsOf("Lee Lane")).toBe("LL");
    expect(initialsOf("")).toBe("?");
    expect(initialsOf("   ")).toBe("?");
    const hub = hubFromSnapshot({ ...current, members: [...members, { userId: "user-4", name: " ", role: "member", active: true }] }, user);
    expect(hub.members.find((member) => member.userId === "user-4")?.ini).toBe("?");
  });

  it("names someone who has left on Settle, in what they owe and what they paid back", async () => {
    mount("/settle");
    const owed = await screen.findByRole("region", { name: "You’re owed" });
    expect(within(owed).getByText("Lee Lane (left) owes you")).toBeTruthy();
    expect(within(owed).getByRole("button", { name: "Confirm received from Lee Lane for Cleaner" })).toBeTruthy();
    const owe = screen.getByRole("region", { name: "You owe" });
    expect(within(owe).getByText("You owe Lee Lane (left)")).toBeTruthy();
    expect(within(screen.getByRole("region", { name: "Recent repayments" })).getByText("Lee Lane (left) to you")).toBeTruthy();
    expect(screen.queryByText(/former member/i)).toBeNull();
  });

  it("names them on an expense they paid for or share in", async () => {
    mount("/expenses");
    await screen.findByRole("heading", { name: "Expenses" });
    await act(async () => app.go("expense", { expense: "expense-2" }));
    const paint = await screen.findByRole("dialog", { name: "Paint" });
    expect(within(paint).getByText(/^Lee Lane \(left\) paid £20\.00\./)).toBeTruthy();
    await act(async () => app.go("expense", { expense: "expense-1" }));
    const cleaner = await screen.findByRole("dialog", { name: "Cleaner" });
    expect(within(cleaner).getByText("Lee Lane (left)")).toBeTruthy();
  });

  it("names them on recurring bills and pledges", async () => {
    current.recurringBills = [{ id: "bill-1", title: "Window cleaner", amountMinor: 2000, paidByUserId: "user-3", createdBy: "user-3",
      version: 1, archivedAt: null, frequency: "monthly", nextDueOn: "2026-11-01", paused: true,
      allocations: [{ userId: user.id, amountMinor: 1000 }, { userId: "user-3", amountMinor: 1000 }] }];
    current.funds = [{ id: "fund-1", name: "Boiler fund", targetMinor: 50000, createdBy: user.id, archivedAt: null, commitments: [
      { id: "pledge-1", userId: "user-3", amountMinor: 5000, contributedMinor: 1000, dueOn: "2026-10-01", cancelledAt: null, contributions: [] },
    ] }];
    mount("/recurring");
    expect(await screen.findByText(/paid by Lee Lane \(left\)/)).toBeTruthy();
    await act(async () => app.go("funds"));
    fireEvent.click(await screen.findByRole("button", { name: "View fund Boiler fund" }));
    const fund = await screen.findByRole("dialog", { name: "Boiler fund" });
    expect(within(fund).getByText("Lee Lane (left)")).toBeTruthy();
  });

  it("names them in templates, announcements and notices", async () => {
    mount("/templates");
    expect(await screen.findByText(/Equal · Maya Chen, Lee Lane \(left\)/)).toBeTruthy();
    await act(async () => app.go("hub"));
    const announcements = await screen.findByRole("region", { name: "Announcements" });
    expect(within(announcements).getByText(/^Lee Lane · /)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /^Notifications/ }));
    const notices = await screen.findByRole("dialog", { name: "Notices" });
    expect(within(notices).getByText(/Lee Lane says they sent £5\.00/)).toBeTruthy();
  });
});
