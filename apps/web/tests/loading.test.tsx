import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { App } from "../src/App";
import { AppProvider, useApp, type AppState } from "../src/state";
import { api, post, loadCommunes, loadSnapshot } from "../src/live/api";
import type { Commune, Snapshot } from "../src/live/model";

vi.mock("../src/live/api", () => ({ api: vi.fn(), post: vi.fn(), loadCommunes: vi.fn(), loadSnapshot: vi.fn() }));
const user = { id: "user-1", name: "Test Person", email: "test@example.com", emailVerified: true };
const commune: Commune = { id: "home-1", name: "Our home", kind: "household", currency: "GBP", role: "admin", address: "Test address" };
const snapshot: Snapshot = { commune, members: [{ userId: user.id, name: user.name, role: "admin" }], expenses: [], funds: [], notifications: [], reminderTargets: [] };
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
let app: AppState;
function Capture() { app = useApp(); return null; }
function mount(path = "/hub") {
  const location = memoryLocation({ path, record: true });
  render(<Router hook={location.hook}><AppProvider><Capture /><App /></AppProvider></Router>);
  return location;
}
beforeEach(() => {
  vi.resetAllMocks();
  sessionStorage.clear();
  vi.mocked(api).mockImplementation(async (path) => {
    if (path === "/auth/me") return { user };
    if (path === "/reminders/usage") return { totalUsed: 0, totalLimit: 60, recipientLimit: 6, recipientUsage: {}, nextSlotAt: null };
    if (path.endsWith("/invites")) return { invites: [] };
    throw new Error(`Unexpected API request ${path}`);
  });
  vi.mocked(loadCommunes).mockResolvedValue({ communes: [commune] });
  vi.mocked(loadSnapshot).mockResolvedValue(snapshot);
});
afterEach(cleanup);

describe("commune loading", () => {
  it("shows the known commune while activity loads, without an empty ledger", async () => {
    const pending = deferred<Snapshot>();
    vi.mocked(loadSnapshot).mockReturnValue(pending.promise);
    mount();
    await screen.findByText("Opening Our home…");
    expect(app.session?.hasHubs).toBe(true);
    expect(app.hub.name).toBe("Our home");
    expect(screen.queryByText("No expenses yet. Add the first one to start the shared ledger.")).toBeNull();
    await act(async () => pending.resolve(snapshot));
    await screen.findByRole("heading", { name: "Our home" });
    expect(app.contentLoading).toBe(false);
    expect(vi.mocked(api).mock.calls.filter(([path]) => path === "/auth/me")).toHaveLength(1);
    expect(loadCommunes).toHaveBeenCalledTimes(1);
    expect(loadSnapshot).toHaveBeenCalledTimes(1);
  });

  it("does not make the hub wait for reminder counts or invitations", async () => {
    const pending = deferred<never>();
    vi.mocked(api).mockImplementation(async (path) => path === "/auth/me" ? { user } : pending.promise);
    mount();
    await screen.findByRole("heading", { name: "Our home" });
    expect(app.contentLoading).toBe(false);
    expect(app.reminderUsage).toBeNull();
  });

  it("publishes a created commune after the save, without a full refresh", async () => {
    vi.mocked(loadCommunes).mockResolvedValue({ communes: [] });
    const location = mount("/onboard");
    await screen.findByRole("heading", { name: "Name your commune." });
    vi.mocked(post).mockResolvedValue({ id: "new-home" });
    await act(async () => {
      await app.createHub({ name: "New home", type: "Household", currency: "£ GBP", address: "42 Test Road" });
    });
    await screen.findByRole("heading", { name: "New home" });
    expect(screen.getByText("42 Test Road")).toBeTruthy();
    expect(location.history?.at(-1)).toBe("/hub");
    expect(app.hub.members[0].userId).toBe(user.id);
    expect(loadCommunes).toHaveBeenCalledTimes(1);
    expect(loadSnapshot).not.toHaveBeenCalled();
  });

  it("keeps existing content visible during refresh", async () => {
    mount();
    await screen.findByRole("heading", { name: "Our home" });
    const pending = deferred<Snapshot>();
    vi.mocked(loadSnapshot).mockReturnValue(pending.promise);
    let refresh!: Promise<void>;
    await act(async () => { refresh = app.refresh(); });
    expect(app.contentLoading).toBe(false);
    expect(screen.getByRole("heading", { name: "Our home" })).toBeTruthy();
    await act(async () => { pending.resolve(snapshot); await refresh; });
  });

  it("ignores an older refresh that finishes after a commune is created", async () => {
    mount();
    await screen.findByRole("heading", { name: "Our home" });
    const pending = deferred<{ communes: Commune[] }>();
    vi.mocked(loadCommunes).mockReturnValue(pending.promise);
    let refresh!: Promise<void>;
    await act(async () => { refresh = app.refresh(); });
    vi.mocked(post).mockResolvedValue({ id: "new-home" });
    await act(async () => { await app.createHub({ name: "New home", type: "Household", currency: "£ GBP" }); });
    await act(async () => { pending.resolve({ communes: [commune] }); await refresh; });
    expect(app.places.map((place) => place.id)).toContain("new-home");
    expect(app.hub.id).toBe("new-home");
  });

  it("does not display a commune when the save fails", async () => {
    vi.mocked(loadCommunes).mockResolvedValue({ communes: [] });
    mount("/onboard");
    await screen.findByRole("heading", { name: "Name your commune." });
    vi.mocked(post).mockRejectedValue(new Error("Save failed"));
    await act(async () => {
      await expect(app.createHub({ name: "Unsaved home", type: "Household", currency: "£ GBP" })).rejects.toThrow("Save failed");
    });
    expect(app.places).toHaveLength(0);
    expect(app.session?.hasHubs).toBe(false);
  });

  it("offers retry instead of showing an empty commune after a failed load", async () => {
    vi.mocked(loadSnapshot).mockRejectedValue(new Error("Network unavailable"));
    mount();
    await screen.findByRole("heading", { name: "Could not load your commune" });
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
    expect(screen.queryByText("No expenses yet. Add the first one to start the shared ledger.")).toBeNull();
  });

  it("redirects bookmarked empty-state URLs to the canonical hub", async () => {
    const location = mount("/hub-empty");
    await screen.findByRole("heading", { name: "Our home" });
    await waitFor(() => expect(location.history?.at(-1)).toBe("/hub"));
  });
});
