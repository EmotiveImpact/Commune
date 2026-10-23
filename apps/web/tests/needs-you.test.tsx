import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { App } from "../src/App";
import { preloadAll } from "../src/shell/lazyComponent";
import { AppProvider } from "../src/state";
import { api, loadCommunes, loadSnapshot, post } from "../src/live/api";
import { comingUp, needsYou, type Commune, type PaymentReport, type Snapshot } from "../src/live/model";
import { toastText } from "./toast";

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

type Bill = NonNullable<Snapshot["recurringBills"]>[number];
const bill = (id: string, title: string, paidByUserId: string, nextDueOn: string, allocations: Bill["allocations"], extra: Partial<Bill> = {}): Bill => ({
  id, title, amountMinor: allocations.reduce((total, share) => total + share.amountMinor, 0), paidByUserId, allocations,
  frequency: "monthly", nextDueOn, paused: false, createdBy: paidByUserId, version: 1, archivedAt: null, ...extra,
});
const nobody = (id: string, title: string, date: string) => ({ ...task(id, title, date, ""), assigneeId: null }) as unknown as Operation;

describe("the Coming up rule", () => {
  it("lists the next fortnight's turns and regular bills, soonest first, leaving today's own task to Needs you", () => {
    const snapshot = snapshotOf(home, {
      operations: [
        task("hoover", "Hoover", today, "me"), task("mop", "Mop", "2026-10-10", "me"), task("dust", "Dust", "2026-10-12", "ben"),
        nobody("gutters", "Clear the gutters", "2026-10-14"), task("party", "Party", "2026-10-11", "me", "event"),
        task("bins", "Bins", "2026-10-07", "me"), task("windows", "Windows", "2026-10-23", "cat"),
        { ...task("oven", "Oven", "2026-10-11", "cat"), status: "done" } as unknown as Operation,
      ],
      recurringBills: [
        bill("netflix", "Netflix", "me", "2026-10-11", [{ userId: "me", amountMinor: 1000 }, { userId: "ben", amountMinor: 1000 }, { userId: "cat", amountMinor: 1000 }]),
        bill("energy", "Energy", "ben", "2026-10-22", [{ userId: "me", amountMinor: 1500 }, { userId: "ben", amountMinor: 2500 }]),
        bill("gym", "Gym", "me", "2026-10-10", [{ userId: "me", amountMinor: 3000 }], { paused: true }),
        bill("paper", "Paper", "me", "2026-10-10", [{ userId: "me", amountMinor: 500 }], { archivedAt: "2026-10-01T00:00:00Z" }),
        bill("water", "Water", "cat", "2026-10-24", [{ userId: "me", amountMinor: 900 }]),
      ],
    });
    expect(comingUp(snapshot, "me", today).map((item) => [item.dueOn, item.title, item.when, item.open ?? false])).toEqual([
      ["2026-10-10", "Mop", "your turn", false],
      ["2026-10-11", "Netflix", "£30.00, you pay · £10.00 each", false],
      ["2026-10-12", "Dust", "Ben Baker’s turn", false],
      ["2026-10-14", "Clear the gutters", "nobody yet", true],
      ["2026-10-22", "Energy", "£40.00, Ben Baker pays · your share £15.00", false],
    ]);
  });
});

function mount(path: string) {
  const location = memoryLocation({ path, record: true });
  render(<Router hook={location.hook}><AppProvider><App /></AppProvider></Router>);
  return location;
}
const modalDescriptor = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "showModal");
const closeDescriptor = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "close");
beforeAll(() => {
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value: function (this: HTMLDialogElement) { this.setAttribute("open", ""); } });
  Object.defineProperty(HTMLDialogElement.prototype, "close", { configurable: true, value: function (this: HTMLDialogElement) { this.removeAttribute("open"); } });
});
afterAll(() => {
  if (modalDescriptor) Object.defineProperty(HTMLDialogElement.prototype, "showModal", modalDescriptor);
  else delete (HTMLDialogElement.prototype as unknown as Record<string, unknown>).showModal;
  if (closeDescriptor) Object.defineProperty(HTMLDialogElement.prototype, "close", closeDescriptor);
  else delete (HTMLDialogElement.prototype as unknown as Record<string, unknown>).close;
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

const readAgain = () => vi.mocked(loadSnapshot).mock.calls.map(([commune]) => commune.id);

// A Home row: its title, commune, who and what, amount and when.
const row = (item: HTMLElement) => [item.querySelector(".c-home-row-title")?.textContent, item.querySelector(".c-home-place")?.textContent,
  item.querySelector(".c-home-row-meta > span:last-child")?.textContent, item.querySelector(".c-home-row-fig strong")?.textContent ?? null,
  item.querySelector(".c-home-state")?.textContent ?? null];

describe("Needs you on Home", () => {
  it("puts the first thing first, then every commune's actions by when, then what others owe, more quietly", async () => {
    mount("/");
    const next = await screen.findByRole("article", { name: "Electricity" });
    expect(within(next).getByText("1 of 7")).toBeTruthy();
    expect(within(next).getByText("Our home · Ben Baker says they sent it")).toBeTruthy();
    expect(within(next).getByRole("button", { name: "Confirm £20.00 received" })).toBeTruthy();
    expect(within(next).getByRole("button", { name: "Not received" })).toBeTruthy();

    // Chores due are ticked off from Home, in whichever commune they are.
    const chores = screen.getByRole("region", { name: "Today" });
    expect([...chores.querySelectorAll<HTMLElement>(".c-home-row-title")].map((title) => title.textContent)).toEqual(["Bins", "Hoover"]);
    expect(within(chores).getByRole("checkbox", { name: "Mark Bins done" })).toBeTruthy();
    expect(within(chores).getByRole("checkbox", { name: "Mark Hoover done" })).toBeTruthy();
    expect(within(chores).getByText("2 days overdue")).toBeTruthy();

    const needs = screen.getByRole("region", { name: "Still to pay" });
    const groups = [...needs.querySelectorAll<HTMLElement>(".c-home-group")].map((group) =>
      [group.querySelector("h3")?.firstChild?.textContent?.trim(), [...group.querySelectorAll<HTMLElement>(".c-home-row")].map(row)]);
    expect(groups).toEqual([
      ["Overdue", [
        ["Internet", "Our home", "You owe Ben Baker", "£15.00", "8 days overdue"],
        ["Boiler", "Our home", "Remaining on your pledge", "£60.00", "4 days overdue"],
      ]],
      ["No due date", [["Water", "Our home", "You owe Cat Cole", "£8.00", null]]],
    ]);
    // Payments act where they are; a pledge opens its record.
    expect(within(needs).getAllByRole("button").filter((button) => button.classList.contains("c-home-btn")).map((button) => button.textContent)).toEqual([
      "I’ve paid Ben Baker for Internet", "Open Boiler", "I’ve paid Cat Cole for Water",
    ]);
    // Three rows fit a phone, so nothing is folded away.
    expect(needs.querySelectorAll(".is-extra-phone")).toHaveLength(0);
    expect(within(needs).queryByRole("button", { name: /Show \d+ more/ })).toBeNull();

    // A payment someone says they sent sits with what others owe, with Confirm on the row.
    const waiting = screen.getByRole("region", { name: "Waiting on others" });
    await within(waiting).findByText("Ferry");
    expect(within(waiting).getByText("£50.00")).toBeTruthy();
    expect([...waiting.querySelectorAll<HTMLElement>(".c-home-row")].map(row)).toEqual([
      // The trip's report waits on Maya now, whenever its bill is due.
      ["Ferry", "Lisbon trip", "Ben Baker says they sent it", "€25.00", null],
      ["Electricity", "Our home", "Cat Cole owes you", "£20.00", "Due 20 Oct"],
      ["Takeaway", "Our home", "3 people owe you", "£30.00", null],
      ["Rent", "Our home", "You said you sent it · waiting for Cat Cole", "£500.00", "Due Thu"],
    ]);
    expect(within(waiting).getAllByRole("button").filter((button) => button.classList.contains("c-home-btn")).map((button) => button.textContent))
      .toEqual(["Confirm €25.00 from Ben Baker"]);
  });

  it("says where Maya stands per currency, never adding pounds to euros", async () => {
    // Maya also owes Ben for the trip's tram passes.
    vi.mocked(loadSnapshot).mockImplementation(async (commune) => commune.id === home.id ? homeSnapshot() : { ...tripSummary(),
      expenses: [...tripSummary().expenses, expense("tram", "Tram passes", "ben", "2026-10-12", [share("ben", 1200, 1200), share("me", 1200)])] });
    mount("/");
    const standing = await screen.findByRole("heading", { name: "You owe £523.00 and €12.00 across two communes." });
    expect(standing.parentElement?.querySelector(".c-home-sub")?.textContent)
      .toBe("You’re owed £70.00 and €25.00, so in pounds you owe £453.00 and in euros you’re €13.00 ahead. Three things are overdue, the oldest eight days.");
    // The bar names the page; the sentence is Home's own heading.
    expect(screen.getByRole("heading", { level: 1, name: "Home" })).toBeTruthy();
    // A phone's bar shows the wordmark beside the menu on Home; the h1 names the page.
    expect(screen.getByRole("banner").querySelector(".a-header-wordmark[aria-hidden='true']")?.textContent).toBe("commune.");
    // Home's top bar adds an expense, as drawn (a phone adds from the Hub).
    fireEvent.click(within(screen.getByRole("banner")).getByRole("button", { name: "Add expense" }));
    expect(await screen.findByRole("dialog", { name: "Add expense" })).toBeTruthy();
  });

  it("tells the bill payer from Home, then reads the share's own commune again", async () => {
    vi.mocked(post).mockResolvedValue({ duplicate: false });
    mount("/");
    await screen.findByText("Ferry");
    const needs = screen.getByRole("region", { name: "Still to pay" });
    vi.mocked(loadSnapshot).mockClear();
    fireEvent.click(within(needs).getByRole("button", { name: "I’ve paid Ben Baker for Internet" }));
    const dialog = await screen.findByRole("dialog", { name: "Tell Ben Baker you’ve paid" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Tell Ben Baker" }));
    await waitFor(() => expect(toastText()).toBe("Recorded. Ben will confirm your £15.00."));
    expect(post).toHaveBeenCalledWith("/shares/share-me-1500/payment-reports", expect.objectContaining({ amountMinor: 1500, sentOn: today }));
    expect(readAgain()).toEqual(["home-1"]);
  });

  it("confirms a payment in another commune where it sits, and reads that commune again", async () => {
    vi.mocked(post).mockResolvedValue({ outstandingMinor: 0 });
    mount("/");
    const waiting = await screen.findByRole("region", { name: "Waiting on others" });
    await within(waiting).findByText("Ferry");
    vi.mocked(loadSnapshot).mockClear();
    fireEvent.click(within(waiting).getByRole("button", { name: "Confirm €25.00 from Ben Baker" }));
    const dialog = await screen.findByRole("dialog", { name: "Confirm €25.00 received?" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Confirm Ben’s €25.00" }));
    await waitFor(() => expect(toastText()).toBe("Confirmed. Ben’s €25.00 is recorded as received."));
    expect(post).toHaveBeenCalledWith("/payment-reports/report-ben-2500/resolve", expect.objectContaining({ decision: "confirm" }));
    expect(readAgain()).toEqual(["trip-1"]);
  });
});

describe("Today on Home", () => {
  it("ticks off a chore in its own commune, checked against the date Home showed, with Undo", async () => {
    vi.mocked(post).mockResolvedValue({ id: "occurrence-bins", date: "2026-10-14", assigneeId: "me", turnOwnerId: "me", status: "open" });
    mount("/");
    const chores = await screen.findByRole("region", { name: "Today" });
    vi.mocked(loadSnapshot).mockClear();
    fireEvent.click(within(chores).getByRole("checkbox", { name: "Mark Bins done" }));
    await waitFor(() => expect(toastText()).toBe("Bins is done."));
    expect(post).toHaveBeenCalledWith("/operations/bins/occurrences", expect.objectContaining({ action: "completed", expectedDate: "2026-10-07", today }));
    expect(readAgain()).toEqual(["home-1"]);
  });

  it("says how the bill payer takes money on the next step, and sums nothing across currencies", async () => {
    vi.mocked(loadSnapshot).mockImplementation(async (commune) => commune.id === home.id
      ? { ...homeSnapshot(), reports: undefined, expenses: homeSnapshot().expenses.filter((item) => item.title !== "Electricity"),
        payLinks: { ben: [{ provider: "monzo", handle: "benbaker" }, { provider: "bank", accountName: "Ben Baker", sortCode: "204577", accountNumber: "41029388" }] } }
      : { ...tripSummary(), expenses: [] });
    mount("/");
    const next = await screen.findByRole("article", { name: "Internet" });
    expect(next.querySelector(".c-home-pays")?.textContent).toBe("Ben takes MonzoBank transfer");
  });
});

describe("Coming up on Home", () => {
  // Nothing needs Maya: Ben owes her for the bins bags, and the trip's gutters need someone.
  const calm = () => snapshotOf(home, {
    expenses: [expense("bags", "Bin bags", "me", "2026-10-20", [share("me", 400, 400), share("ben", 400)])],
    operations: [task("dust", "Dust", "2026-10-12", "ben")],
    recurringBills: [bill("netflix", "Netflix", "me", "2026-10-11", [{ userId: "me", amountMinor: 1000 }, { userId: "ben", amountMinor: 1000 }])],
  });
  const tripWithGutters = () => ({ ...tripSummary(), expenses: [], operations: [nobody("gutters", "Clear the gutters", "2026-10-14")] });

  it("shows turns and bills ahead in every commune, and takes a task nobody holds, reading its own commune again", async () => {
    vi.mocked(loadSnapshot).mockImplementation(async (commune) => commune.id === home.id ? calm() : tripWithGutters());
    vi.mocked(post).mockResolvedValue({ id: "occurrence-1", date: "2026-10-14", assigneeId: "me", turnOwnerId: "me", status: "open" });
    mount("/");
    const coming = await screen.findByRole("region", { name: "Coming up" });
    await within(coming).findByRole("button", { name: "Clear the gutters" });
    expect([...coming.querySelectorAll<HTMLElement>(".c-home-row")].map(row)).toEqual([
      ["Netflix", "Our home", "£20.00, you pay · £10.00 each", null, null],
      ["Dust", "Our home", "Ben Baker’s turn", null, null],
      ["Clear the gutters", "Lisbon trip", "nobody yet", null, null],
    ]);
    expect(within(coming).getByRole("button", { name: "Operations" })).toBeTruthy();
    // Only the task nobody holds can be taken from here.
    expect(within(coming).getAllByRole("button", { name: /I’ll do it/ })).toHaveLength(1);
    vi.mocked(loadSnapshot).mockClear();
    fireEvent.click(within(coming).getByRole("button", { name: "I’ll do it Clear the gutters" }));
    expect(await screen.findByText("Clear the gutters is yours now. Open the task to undo this.")).toBeTruthy();
    // A handover to Maya, checked against the task as Home saw it.
    expect(post).toHaveBeenCalledWith("/operations/gutters/handovers", expect.objectContaining({
      toMemberId: "me", expectedDate: "2026-10-14", expectedAssigneeId: null, today,
    }));
    expect(readAgain()).toEqual(["trip-1"]);
  });
});

describe("Your part on This Hub", () => {
  it("leads with the first payment to act on, in Home's order, and keeps what others owe apart", async () => {
    mount("/hub");
    const part = await screen.findByRole("region", { name: "Your part" });
    await within(part).findByText("Electricity");
    // A payment someone says they sent comes first, with the answer on the button.
    expect(within(part).getByText("Ben Baker says they sent it")).toBeTruthy();
    expect(within(part).getByRole("button", { name: "Confirm £20.00 received" })).toBeTruthy();
    expect(within(part).getByRole("button", { name: "Not received" })).toBeTruthy();
    expect(within(part).getByRole("button", { name: "2 more to settle" })).toBeTruthy();
    // Pledges stay with the viewer's part; tasks live in the week.
    const pledge = within(part).getByRole("button", { name: /Boiler/ });
    expect(pledge.querySelector("small")?.textContent).toBe("Remaining on your pledge · overdue · £60.00");
    expect(within(part).getByText("3 waiting on others")).toBeTruthy();
    const week = screen.getByRole("region", { name: "This week" });
    expect(within(week).getByRole("checkbox", { name: "Mark Bins done" })).toBeTruthy();
    expect(within(week).getByRole("checkbox", { name: "Mark Hoover done" })).toBeTruthy();
  });
});

