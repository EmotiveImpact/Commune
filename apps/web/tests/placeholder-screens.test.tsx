import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { App } from "../src/App";
import { AppProvider } from "../src/state";
import { api, loadCommunes, loadSnapshot, post } from "../src/live/api";
import { hubFromSnapshot, type Commune, type Expense, type Snapshot } from "../src/live/model";

vi.mock("../src/live/api", async (importOriginal) => ({
  ...await importOriginal<typeof import("../src/live/api")>(),
  api: vi.fn(), post: vi.fn(), loadCommunes: vi.fn(), loadSnapshot: vi.fn(),
}));

const user = { id: "user-1", name: "Test Person", email: "test@example.test", emailVerified: true };
const other = { userId: "user-2", name: "Other Person", role: "member" as const };
const commune: Commune = { id: "home-1", name: "Our home", kind: "household", currency: "GBP", role: "admin" };
const snapshot: Snapshot = { commune, members: [{ userId: user.id, name: user.name, role: "admin" }, other], expenses: [], funds: [], notifications: [], reminderTargets: [] };
const rent = (dueOn: string): Expense => ({ id: "expense-1", title: "Rent", amountMinor: 120000, paidByUserId: user.id, dueOn,
  shares: [{ id: "share-1", userId: user.id, amountMinor: 60000, settledMinor: 60000 }, { id: "share-2", userId: other.userId, amountMinor: 60000, settledMinor: 0 }] });
const nextDue = (expenses: Expense[]) => hubFromSnapshot({ ...snapshot, expenses }, user).kpis.find((kpi) => kpi.kicker === "Next due");

function mount(path: string) {
  const location = memoryLocation({ path, record: true });
  render(<Router hook={location.hook}><AppProvider><App /></AppProvider></Router>);
  return location;
}
beforeEach(() => {
  vi.resetAllMocks();
  sessionStorage.clear();
  localStorage.clear();
  vi.mocked(api).mockImplementation(async (path) => {
    if (path === "/auth/me") return { user };
    if (path === "/reminders/usage") return { totalUsed: 0, totalLimit: 60, recipientLimit: 6, recipientUsage: {}, nextSlotAt: null };
    if (path.endsWith("/invites")) return { invites: [] };
    throw new Error(`Unexpected API request ${path}`);
  });
  vi.mocked(post).mockResolvedValue({ ok: true });
  vi.mocked(loadCommunes).mockResolvedValue({ communes: [commune] });
  vi.mocked(loadSnapshot).mockResolvedValue(snapshot);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("Next due", () => {
  it("says a date that has passed is overdue, and since when", () => {
    vi.useFakeTimers({ now: new Date(2026, 9, 9, 12), toFake: ["Date"] });
    expect(nextDue([rent("2026-09-04")])?.num).toBe("Overdue since 4 Sept");
    expect(nextDue([rent("2026-10-09")])?.num).toBe("9 Oct");
    expect(nextDue([rent("2026-11-12")])?.num).toBe("12 Nov");
    expect(nextDue([])?.num).toBe("-");
  });
});

describe("Billing and Analytics", () => {
  it("are not in the navigation", async () => {
    mount("/hub");
    const nav = await screen.findByRole("navigation", { name: "Primary" });
    expect(within(nav).queryByRole("button", { name: "Billing" })).toBeNull();
    expect(within(nav).queryByRole("button", { name: "Analytics" })).toBeNull();
    expect(within(nav).getByRole("button", { name: "Activity" })).toBeTruthy();
  });

  it.each(["/billing", "/analytics"])("%s goes to Home", async (path) => {
    const location = mount(path);
    await screen.findByRole("heading", { name: "Your communes, Test." });
    await waitFor(() => expect(location.history?.at(-1)).toBe("/"));
  });
});
