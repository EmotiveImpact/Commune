import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, waitFor, within } from "@testing-library/react";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import type { Commune, Snapshot } from "../src/live/model";

// Two tabs of one browser: each has its own copy of the app's modules (and
// so its own record of whom it shows), and they hear each other on the
// session channel, as real tabs do. The mocked server below is shared, as
// the real one is.
vi.mock("../src/live/api", async (importOriginal) => ({
  ...await importOriginal<typeof import("../src/live/api")>(),
  api: vi.fn(), post: vi.fn(), loadCommunes: vi.fn(), loadSnapshot: vi.fn(),
}));

const user = { id: "user-1", name: "Test Person", email: "test@example.com", emailVerified: true };
const commune: Commune = { id: "home-1", name: "Our home", kind: "household", currency: "GBP", role: "admin", address: "Test address" };
const snapshot: Snapshot = { commune, members: [{ userId: user.id, name: user.name, role: "admin" }], expenses: [], funds: [], notifications: [], reminderTargets: [] };
// The browser's one shared session, and whether the database accepts it.
let signedIn: typeof user | null = null;
let refused = false;
let checks = 0;
let heard: unknown[] = [];
let bystander: BroadcastChannel;

async function openTab(path: string) {
  vi.resetModules();
  const live = await import("../src/live/api");
  const { AppProvider } = await import("../src/state");
  const { App } = await import("../src/App");
  // The code a browser loads later comes with each tab's copy now, before
  // the next tab replaces the modules it would load.
  await (await import("../src/shell/lazyComponent")).preloadAll();
  vi.mocked(live.api).mockImplementation(async (request) => {
    if (request === "/auth/me") { checks += 1; return { user: signedIn }; }
    if (request === "/reminders/usage") return { totalUsed: 0, totalLimit: 60, recipientLimit: 6, recipientUsage: {}, nextSlotAt: null };
    if (request.endsWith("/invites")) return { invites: [] };
    throw new Error(`Unexpected API request ${request}`);
  });
  vi.mocked(live.post).mockResolvedValue({ ok: true });
  vi.mocked(live.loadCommunes).mockImplementation(async () => {
    if (refused) throw new live.ApiError("Request identity could not be verified", 401);
    return { communes: [commune] };
  });
  vi.mocked(live.loadSnapshot).mockResolvedValue(snapshot);
  const location = memoryLocation({ path });
  const view = render(<Router hook={location.hook}><AppProvider><App /></AppProvider></Router>);
  return within(view.container);
}

// Long enough for any message a tab sends in reply to arrive and be acted on.
const settle = () => new Promise((resolve) => setTimeout(resolve, 150));

beforeEach(() => {
  sessionStorage.clear();
  signedIn = null;
  refused = false;
  checks = 0;
  heard = [];
  bystander = new BroadcastChannel("commune.session");
  bystander.onmessage = (event) => heard.push(event.data);
});
afterEach(() => {
  bystander.close();
  cleanup();
});

describe("a sign-in in one tab", () => {
  it("reaches a signed-out tab when it comes back from Google, in one message", async () => {
    const first = await openTab("/login");
    await first.findByRole("heading", { name: "Welcome back" });
    // Google returns to a fresh page in the second tab; nothing there calls
    // a sign-in function, only the start-up check finds the session.
    signedIn = user;
    const second = await openTab("/hub");
    await second.findByRole("heading", { name: commune.name });
    await first.findByRole("heading", { name: commune.name });
    await settle();
    expect(heard).toEqual([{ type: "session", userId: user.id }]);
    // Each tab checked at start-up, and the first once more when it heard.
    expect(checks).toBe(3);
  });

  it("does not bounce between tabs when the session is then refused", async () => {
    const first = await openTab("/login");
    await first.findByRole("heading", { name: "Welcome back" });
    // The sign-in holds, but the database refuses its token, so each tab
    // ends up signed out again after finding it. Were a tab that heard the
    // news to pass it on, the two would wake each other for ever.
    signedIn = user;
    refused = true;
    const second = await openTab("/hub");
    await second.findByRole("heading", { name: "Welcome back" });
    await waitFor(() => expect(checks).toBe(3));
    await first.findByText("Commune couldn’t confirm your sign-in. Please sign in again.");
    await settle();
    expect(heard).toEqual([{ type: "session", userId: user.id }]);
    expect(checks).toBe(3);
  });
});
