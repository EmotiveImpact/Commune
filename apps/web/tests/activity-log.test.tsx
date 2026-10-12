import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { App } from "../src/App";
import { AppProvider } from "../src/state";
import { api, loadCommunes, loadSnapshot } from "../src/live/api";
import { hubFromSnapshot, type Commune, type Snapshot } from "../src/live/model";
import { activityDayHeading, activityStamp, groupByDay } from "../src/ui/ActivityLog";

vi.mock("../src/live/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/live/api")>()),
  api: vi.fn(), post: vi.fn(), loadCommunes: vi.fn(), loadSnapshot: vi.fn(),
}));

// Activity names the kind of record each row is about, in an icon and a word,
// shows the time of day, and groups the rows under the day they were recorded.
// It is Friday 9 October 2026, 4pm in London.
const zone = process.env.TZ;
const user = { id: "user-1", name: "Test Person", email: "test@example.test", emailVerified: true };
const home: Commune = { id: "home-1", name: "Our home", kind: "household", currency: "GBP", role: "admin" };
const trip: Commune = { id: "trip-1", name: "Lisbon trip", kind: "trip", currency: "EUR", role: "member" };
const members = [
  { userId: user.id, name: user.name, role: "admin" as const, active: true },
  { userId: "user-2", name: "Housemate Two", role: "member" as const, active: true },
];
type Event = NonNullable<Snapshot["activityEvents"]>[number];
const event = (id: string, kind: Event["kind"], title: string, description: string, createdAt: string, recordType?: Event["recordType"]): Event =>
  ({ id, actorId: "user-2", kind, entityId: `${id}-record`, title, description, createdAt, ...(recordType ? { recordType } : {}) });
function snapshotOf(commune: Commune, extra: Partial<Snapshot> = {}): Snapshot {
  return {
    commune, members, expenses: [], funds: [], notes: [], operations: [], notifications: [], reminderTargets: [],
    recurringBills: [], splitTemplates: [], activityEvents: [], announcements: [], sentReminders: [], ...extra,
  };
}
const gas = {
  id: "expense-gas", title: "Gas", amountMinor: 3000, paidByUserId: "user-2", dueOn: null, createdAt: "2026-10-05T18:45:00Z",
  shares: [{ id: "share-gas", userId: user.id, amountMinor: 1500, settledMinor: 1500 }],
};
const homeSnapshot = () => snapshotOf(home, {
  expenses: [gas],
  activityEvents: [
    event("a1", "operations", "Inspection", "Created", "2026-10-09T13:05:00Z", "event"),
    event("a2", "notes", "Router", "Created", "2026-10-08T08:30:00Z", "note"),
    // Written before the database named record types: the area says what it is.
    event("a3", "funds", "Boiler", "Created", "2025-12-30T10:00:00Z"),
  ],
});
const tripSnapshot = () => snapshotOf(trip, {
  activityEvents: [event("b1", "expenses", "Ferry", "Repayment of €20.00 recorded", "2026-10-09T09:10:00Z", "repayment")],
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
  process.env.TZ = "Europe/London";
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-09T15:00:00Z"));
  vi.resetAllMocks();
  sessionStorage.clear();
  localStorage.clear();
  const snapshots: Record<string, Snapshot> = { [home.id]: homeSnapshot(), [trip.id]: tripSnapshot() };
  vi.mocked(loadCommunes).mockImplementation(async () => ({ communes: [home, trip] }));
  vi.mocked(loadSnapshot).mockImplementation(async (commune) => snapshots[commune.id]);
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
  if (zone === undefined) delete process.env.TZ;
  else process.env.TZ = zone;
});

const rowText = (row: HTMLElement) => [row.querySelector("strong")?.textContent, row.querySelector("small")?.textContent,
  row.querySelector("time")?.textContent];

describe("activity rows", () => {
  it("name the record type the database gives, or the one its area suggests", () => {
    const hub = hubFromSnapshot(homeSnapshot(), user);
    expect(hub.activity.map((item) => [item.title, item.type])).toEqual([
      ["Inspection", "event"], ["Router", "note"], ["Gas", "expense"], ["Boiler", "fund"],
    ]);
  });

  it("group by the member's own day and say when in words", () => {
    expect(activityDayHeading("2026-10-09", "2026-10-09")).toBe("Today");
    expect(activityDayHeading("2026-10-08", "2026-10-09")).toBe("Yesterday");
    expect(activityDayHeading("2026-10-05", "2026-10-09")).toBe("Monday 5 October");
    expect(activityDayHeading("2025-12-30", "2026-10-09")).toBe("Tuesday, 30 December 2025");
    expect(activityDayHeading("", "2026-10-09")).toBe("Earlier");
    // In London, 23:30 UTC on the 8th is already half past midnight on the 9th.
    const rows = ["2026-10-09T09:00:00Z", "2026-10-08T23:30:00Z", "2026-10-08T22:30:00Z", undefined];
    expect(groupByDay(rows, (row) => row).map((group) => [group.day, group.rows.length]))
      .toEqual([["2026-10-09", 2], ["2026-10-08", 1], ["", 1]]);
    expect(activityStamp({ createdAt: "2026-10-09T13:05:00Z", time: "9 Oct" }, "2026-10-09")).toBe("Today, 14:05");
    expect(activityStamp({ createdAt: "2026-10-05T18:45:00Z", time: "5 Oct" }, "2026-10-09")).toBe("5 Oct, 19:45");
    expect(activityStamp({ createdAt: "2025-12-30T10:00:00Z", time: "30 Dec" }, "2026-10-09")).toBe("30 Dec 2025, 10:00");
    expect(activityStamp({ createdAt: undefined, time: "Recently" }, "2026-10-09")).toBe("Recently");
  });
});

describe("the activity log", () => {
  it("shows this commune's records under day headings, each with its type and time", async () => {
    mount("/activity");
    const today = await screen.findByRole("region", { name: "Today" });
    expect(screen.getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent))
      .toEqual(["Today", "Yesterday", "Monday 5 October", "Tuesday, 30 December 2025"]);
    expect(within(today).getAllByRole("button").map(rowText)).toEqual([["Inspection", "Event · Created · Housemate Two", "14:05"]]);
    expect(within(screen.getByRole("region", { name: "Yesterday" })).getAllByRole("button").map(rowText))
      .toEqual([["Router", "Note · Created · Housemate Two", "09:30"]]);
    expect(within(screen.getByRole("region", { name: "Monday 5 October" })).getAllByRole("button").map(rowText))
      .toEqual([["Gas", "Expense · Housemate Two paid", "19:45"]]);
    expect(within(screen.getByRole("region", { name: "Tuesday, 30 December 2025" })).getAllByRole("button").map(rowText))
      .toEqual([["Boiler", "Fund · Created · Housemate Two", "10:00"]]);
    // The kind is in words; its icon is decoration.
    expect(today.querySelector(".c-type-chip.is-plan")?.getAttribute("aria-hidden")).toBe("true");
  });

  it("shows every commune's records together, each naming its commune", async () => {
    mount("/activity/all");
    const today = await screen.findByRole("region", { name: "Today" });
    await within(today).findByText("Ferry");
    expect(within(today).getAllByRole("button").map(rowText)).toEqual([
      ["Inspection", "Our home · Event · Created · Housemate Two", "14:05"],
      ["Ferry", "Lisbon trip · Repayment · Repayment of €20.00 recorded · Housemate Two", "10:10"],
    ]);
  });

  it("gives Home's recent records their type, day and time", async () => {
    mount("/");
    const recent = (await screen.findByRole("heading", { name: "Recent activity" })).closest(".a-card") as HTMLElement;
    await within(recent).findByText("Ferry");
    const rows = within(recent).getAllByRole("button").filter((button) => button.classList.contains("a-item"));
    expect(rows.map((row) => [row.querySelector("strong")?.textContent, ...[...row.querySelectorAll(".when")].map((node) => node.textContent)]))
      .toEqual([
        ["Inspection", "Our home · Event · Created · Housemate Two", "Today, 14:05"],
        ["Ferry", "Lisbon trip · Repayment · Repayment of €20.00 recorded · Housemate Two", "Today, 10:10"],
        ["Router", "Our home · Note · Created · Housemate Two", "Yesterday, 09:30"],
        ["Gas", "Our home · Expense · Housemate Two paid", "5 Oct, 19:45"],
        ["Boiler", "Our home · Fund · Created · Housemate Two", "30 Dec 2025, 10:00"],
      ]);
  });
});
