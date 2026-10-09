import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { App } from "../src/App";
import { preloadAll } from "../src/shell/lazyComponent";
import { AppProvider } from "../src/state";
import { api, loadCommunes, loadSnapshot } from "../src/live/api";
import { needsYou, type Commune, type PaymentReport, type Snapshot } from "../src/live/model";

vi.mock("../src/live/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/live/api")>()),
  api: vi.fn(), post: vi.fn(), loadCommunes: vi.fn(), loadSnapshot: vi.fn(),
}));

// "Needs you" is one rule on Home and This Hub: payments someone says they
// have sent (only the bill payer can confirm them), your unpaid shares, your
// late jobs, then your pledges due. What others owe you waits separately.
// It is Friday 9 October 2026.
const today = "2026-10-09";
const user = { id: "me", name: "Maya Chen", email: "maya@example.test", emailVerified: true };
const home: Commune = { id: "home-1", name: "Our home", kind: "household", currency: "GBP", role: "admin" };
const trip: Commune = { id: "trip-1", name: "Lisbon trip", kind: "trip", currency: "EUR", role: "member" };
const members = [
  { userId: "me", name: "Maya Chen", role: "admin" as const, active: true },
  { userId: "ben", name: "Ben Baker", role: "member" as const, active: true },
  { userId: "cat", name: "Cat Cole", role: "member" as const, active: true },
  { userId: "lee", name: "Lee Lane", role: "member" as const, active: false },
];
const pending = (reportedBy: string, amountMinor: number): PaymentReport => ({
  id: `report-${reportedBy}-${amountMinor}`, reportedBy, amountMinor, sentOn: "2026-10-08", reference: null, reportedAt: "2026-10-08T10:00:00Z",
  status: "pending", resolvedAt: null, resolvedBy: null, note: null, receiptId: null,
});
type Expense = Snapshot["expenses"][number];
const expense = (id: string, title: string, paidByUserId: string, dueOn: string | null, shares: Expense["shares"], extra: Partial<Expense> = {}): Expense =>
  ({ id, title, amountMinor: shares.reduce((total, share) => total + share.amountMinor, 0), paidByUserId, dueOn, shares, ...extra });
const share = (userId: string, amountMinor: number, settledMinor = 0, paymentReports: PaymentReport[] = []) =>
  ({ id: `share-${userId}-${amountMinor}`, userId, amountMinor, settledMinor, paymentReports });
type Operation = NonNullable<Snapshot["operations"]>[number];
const task = (id: string, title: string, date: string, assigneeId: string, kind: Operation["kind"] = "task") => ({
  id, kind, category: kind === "task" ? "chore" : "visit", title, date, time: "", allDay: true, assignee: "", assigneeId,
  rotation: [], rotationIds: [], repeat: "none", status: "open", notes: "", version: 1,
}) as unknown as Operation;
function snapshotOf(commune: Commune, extra: Partial<Snapshot> = {}): Snapshot {
  return {
    commune, members, expenses: [], funds: [], notes: [], operations: [], notifications: [], reminderTargets: [],
    recurringBills: [], splitTemplates: [], activityEvents: [], announcements: [], sentReminders: [], ...extra,
  };
}
const homeSnapshot = () => snapshotOf(home, {
  expenses: [
    expense("electricity", "Electricity", "me", "2026-10-20", [share("me", 2000, 2000), share("ben", 2000, 0, [pending("ben", 2000)]), share("cat", 2000)]),
    expense("internet", "Internet", "ben", "2026-10-01", [share("ben", 1500, 1500), share("me", 1500)]),
    expense("rent", "Rent", "cat", "2026-10-15", [share("cat", 50000, 50000), share("me", 50000, 0, [pending("me", 50000)])]),
    expense("takeaway", "Takeaway", "me", null, [share("ben", 1000), share("cat", 1000), share("lee", 1000)]),
    expense("voided", "Voided bill", "ben", "2026-10-02", [share("me", 700)], { voidedAt: "2026-10-03T09:00:00Z" }),
    expense("groceries", "Groceries", "ben", "2026-10-02", [share("me", 900, 900)]),
    expense("water", "Water", "cat", null, [share("me", 800)]),
  ],
  operations: [
    task("bins", "Bins", "2026-10-07", "me"), task("hoover", "Hoover", today, "me"), task("mop", "Mop", "2026-10-10", "me"),
    task("party", "Party", today, "me", "event"), task("dust", "Dust", "2026-10-01", "ben"),
  ],
  funds: [
    { id: "boiler", name: "Boiler", targetMinor: 50000, createdBy: "me", archivedAt: null, commitments: [
      { id: "pledge-1", userId: "me", amountMinor: 10000, contributedMinor: 4000, dueOn: "2026-10-05", cancelledAt: null, contributions: [] },
      { id: "pledge-2", userId: "ben", amountMinor: 10000, contributedMinor: 0, dueOn: "2026-10-05", cancelledAt: null, contributions: [] },
    ] },
    { id: "old", name: "Old sofa", targetMinor: null, createdBy: "me", archivedAt: "2026-09-01T00:00:00Z", commitments: [
      { id: "pledge-3", userId: "me", amountMinor: 5000, contributedMinor: 0, dueOn: "2026-09-01", cancelledAt: null, contributions: [] },
    ] },
  ] as unknown as Snapshot["funds"],
});
// Another commune, seen on Home through its summary: Ben says he has sent Maya his share of the ferry.
const tripSummary = () => ({ ...snapshotOf(trip, {
  expenses: [expense("ferry", "Ferry", "me", "2026-10-30", [share("me", 2500, 2500), share("ben", 2500, 0, [pending("ben", 2500)])])],
}), detail: "summary" as const });

const rows = (need: { title: string; kind: string; when: string; amount?: string }[]) => need.map((item) => [item.kind, item.title, item.when, item.amount]);

// The screens and windows a browser loads on first use are loaded up front,
// so each test sees them drawn at once.
beforeAll(preloadAll);
describe("the Needs you rule", () => {
  it("puts payments to confirm first, then shares to pay, late and today's tasks, then pledges due", () => {
    const { actions } = needsYou(homeSnapshot(), "me", today);
    expect(rows(actions)).toEqual([
      ["confirm", "Electricity", "Ben Baker says they sent it", "£20.00"],
      ["pay", "Internet", "You owe Ben Baker · overdue", "£15.00"],
      ["pay", "Water", "You owe Cat Cole", "£8.00"],
      ["task", "Bins", "Overdue · your turn", undefined],
      ["task", "Hoover", "Your turn today", undefined],
      ["pledge", "Boiler", "Remaining on your pledge · overdue", "£60.00"],
    ]);
    expect(actions.map((item) => item.late)).toEqual([false, true, false, true, false, true]);
  });

  it("keeps what others owe you, and what you said you sent, waiting on them", () => {
    const { waiting } = needsYou(homeSnapshot(), "me", today);
    expect(rows(waiting)).toEqual([
      // Ben's report is to confirm; Cat's share is still owed.
      ["owed", "Electricity", "Cat Cole owes you", "£20.00"],
      ["owed", "Takeaway", "3 people owe you", "£30.00"],
      ["reported", "Rent", "You said you sent it · waiting for Cat Cole", "£500.00"],
    ]);
  });
});

function mount(path: string) {
  const location = memoryLocation({ path, record: true });
  render(<Router hook={location.hook}><AppProvider><App /></AppProvider></Router>);
  return location;
}
const modalDescriptor = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "showModal");
beforeAll(() => {
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value: function (this: HTMLDialogElement) { this.setAttribute("open", ""); } });
});
afterAll(() => {
  if (modalDescriptor) Object.defineProperty(HTMLDialogElement.prototype, "showModal", modalDescriptor);
  else delete (HTMLDialogElement.prototype as unknown as Record<string, unknown>).showModal;
});
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 9, 9, 12, 0));
  vi.resetAllMocks();
  sessionStorage.clear();
  localStorage.clear();
  vi.mocked(loadCommunes).mockImplementation(async () => ({ communes: [home, trip] }));
  vi.mocked(loadSnapshot).mockImplementation(async (commune) => commune.id === home.id ? homeSnapshot() : tripSummary());
  vi.mocked(api).mockImplementation(async (path) => {
    if (path === "/auth/me") return { user };
    if (path === "/reminders/usage") return { totalUsed: 0, totalLimit: 60, recipientLimit: 8, recipientUsage: {}, nextSlotAt: null };
    if (path.endsWith("/invites")) return { invites: [] };
    return { ok: true };
  });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const feed = (row: HTMLElement) => [row.querySelector(".pill")?.className, row.querySelector(":scope > div > strong")?.textContent,
  row.querySelector(".when")?.textContent];

describe("Needs you on Home", () => {
  it("lists every commune's actions in the same order, then what others owe, more quietly", async () => {
    mount("/");
    const card = (await screen.findByRole("heading", { name: "Needs you" })).closest(".a-card") as HTMLElement;
    await within(card).findByText("Ferry");
    const waiting = within(card).getByRole("region", { name: "Waiting on others" });
    const actions = [...card.querySelectorAll<HTMLElement>(".hub-feed-row")].filter((row) => !waiting.contains(row));
    expect(actions.map(feed)).toEqual([
      // Both reports, the trip's too, come before a share that was due earlier.
      ["pill open", "Electricity", "Ben Baker says they sent it · £20.00"],
      ["pill open", "Ferry", "Ben Baker says they sent it · €25.00"],
      ["pill warn", "Internet", "You owe Ben Baker · overdue · £15.00"],
      ["pill open", "Water", "You owe Cat Cole · £8.00"],
      ["pill warn", "Bins", "Overdue · your turn"],
      ["pill open", "Hoover", "Your turn today"],
    ]);
    expect(within(card).getByText("And 1 more.")).toBeTruthy();
    expect([...waiting.querySelectorAll<HTMLElement>(".hub-feed-row")].map(feed)).toEqual([
      ["pill", "Electricity", "Cat Cole owes you · £20.00"],
      ["pill", "Takeaway", "3 people owe you · £30.00"],
      ["pill", "Rent", "You said you sent it · waiting for Cat Cole · £500.00"],
    ]);
  });
});

describe("Needs you on This Hub", () => {
  it("counts only what needs the viewer, in the same order, and keeps what others owe apart", async () => {
    mount("/hub");
    const needs = await screen.findByRole("region", { name: "Needs you" });
    await within(needs).findAllByText("Electricity");
    expect(within(needs).getByText("6 items")).toBeTruthy();
    const waiting = within(needs).getByRole("region", { name: "Waiting on others" });
    const money = [...needs.querySelectorAll<HTMLElement>(".c-hub-attention-row")].map((row) =>
      [row.querySelector("strong")?.textContent, row.querySelector("small")?.textContent, row.querySelector(".c-hub-attention-end strong")?.textContent]);
    expect(money).toEqual([
      ["Electricity", "Ben Baker says they sent it", "£20.00"],
      ["Internet", "You owe Ben Baker · overdue", "£15.00"],
      ["Water", "You owe Cat Cole", "£8.00"],
    ]);
    const others = [...needs.querySelectorAll<HTMLElement>(".c-hub-note-row")].filter((row) => !waiting.contains(row))
      .map((row) => [row.querySelector("strong")?.textContent, row.querySelector("small")?.textContent]);
    expect(others).toEqual([
      ["Bins", "Overdue · your turn"],
      ["Hoover", "Your turn today"],
      ["Boiler", "Remaining on your pledge · overdue · £60.00"],
    ]);
    expect([...waiting.querySelectorAll<HTMLElement>(".c-hub-note-row")].map((row) => row.querySelector("small")?.textContent)).toEqual([
      "Cat Cole owes you · £20.00", "3 people owe you · £30.00", "You said you sent it · waiting for Cat Cole · £500.00",
    ]);
  });
});
