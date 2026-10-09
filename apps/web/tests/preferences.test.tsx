import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { App } from "../src/App";
import { AppProvider, useApp, type AppState } from "../src/state";
import { api, loadCommunes, loadSnapshot, post } from "../src/live/api";
import type { Commune, Snapshot } from "../src/live/model";

vi.mock("../src/live/api", async (importOriginal) => ({
  ...await importOriginal<typeof import("../src/live/api")>(),
  api: vi.fn(), post: vi.fn(), loadCommunes: vi.fn(), loadSnapshot: vi.fn(),
}));

const user = { id: "user-1", name: "Test Person", email: "test@example.test", emailVerified: true };
const commune: Commune = { id: "home-1", name: "Our home", kind: "household", currency: "GBP", role: "admin" };
const snapshot: Snapshot = { commune, members: [{ userId: user.id, name: user.name, role: "admin" }], expenses: [], funds: [], notifications: [], reminderTargets: [] };
let app: AppState;
function Capture() { app = useApp(); return null; }
function mount(path = "/settings") {
  const location = memoryLocation({ path, record: true });
  render(<Router hook={location.hook}><AppProvider><Capture /><App /></AppProvider></Router>);
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
    if (path === "/preferences") return { emailReminders: true };
    throw new Error(`Unexpected API request ${path}`);
  });
  vi.mocked(post).mockResolvedValue({ ok: true });
  vi.mocked(loadCommunes).mockResolvedValue({ communes: [commune] });
  vi.mocked(loadSnapshot).mockResolvedValue(snapshot);
});
afterEach(cleanup);

describe("Settings preferences", () => {
  it("has no currency preference, since each commune keeps its own", async () => {
    mount();
    await screen.findByRole("heading", { name: "Preferences" });
    expect(screen.queryByLabelText("Currency")).toBeNull();
    expect(screen.queryByText("Currency")).toBeNull();
    expect("currency" in app).toBe(false);
    expect("setCurrency" in app).toBe(false);
  });
});
