import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { App } from "../src/App";
import { preloadAll } from "../src/shell/lazyComponent";
import { AppProvider, useApp, type AppState } from "../src/state";
import { api, post, loadCommunes, loadSnapshot, ApiError } from "../src/live/api";
import { ACCOUNT_CHANGED, currentViewer } from "../src/live/session";
import type { Commune, Snapshot } from "../src/live/model";

vi.mock("../src/live/api", async (importOriginal) => ({
  ...await importOriginal<typeof import("../src/live/api")>(),
  api: vi.fn(), post: vi.fn(), loadCommunes: vi.fn(), loadSnapshot: vi.fn(),
}));
const user = { id: "user-1", name: "Test Person", email: "test@example.com", emailVerified: true };
const commune: Commune = { id: "home-1", name: "Our home", kind: "household", currency: "GBP", role: "admin", address: "Test address" };
const snapshot: Snapshot = { commune, members: [{ userId: user.id, name: user.name, role: "admin" }], expenses: [], funds: [], notifications: [], reminderTargets: [] };
let signedIn: typeof user | { id: string; name: string; email: string; emailVerified: boolean } | null = user;
let app: AppState;
function Capture() { app = useApp(); return null; }
function mount(path = "/hub") {
  const location = memoryLocation({ path, record: true });
  render(<Router hook={location.hook}><AppProvider><Capture /><App /></AppProvider></Router>);
  return location;
}
// Another tab of the same browser.
function otherTab(userId: string | null) {
  const channel = new BroadcastChannel("commune.session");
  channel.postMessage({ type: "session", userId });
  channel.close();
}
// The screens and windows a browser loads on first use are loaded up front,
// so each test sees them drawn at once.
beforeAll(preloadAll);
beforeEach(() => {
  vi.resetAllMocks();
  sessionStorage.clear();
  signedIn = user;
  vi.mocked(api).mockImplementation(async (path) => {
    if (path === "/auth/me") return { user: signedIn };
    if (path === "/reminders/usage") return { totalUsed: 0, totalLimit: 60, recipientLimit: 6, recipientUsage: {}, nextSlotAt: null };
    if (path.endsWith("/invites")) return { invites: [] };
    throw new Error(`Unexpected API request ${path}`);
  });
  vi.mocked(post).mockResolvedValue({ ok: true });
  vi.mocked(loadCommunes).mockResolvedValue({ communes: [commune] });
  vi.mocked(loadSnapshot).mockResolvedValue(snapshot);
});
afterEach(cleanup);

describe("signing out", () => {
  it("clears the tab and its stored settings before the server answers", async () => {
    localStorage.setItem(`commune.local.${user.id}`, JSON.stringify({ activeHubId: commune.id, payMethods: [{ provider: "Monzo", value: "@test" }] }));
    sessionStorage.setItem(`commune.local.${user.id}`, JSON.stringify({ activeHubId: commune.id, dark: true }));
    const location = mount();
    await screen.findByRole("heading", { name: commune.name });
    let answer!: () => void;
    vi.mocked(post).mockImplementation(() => new Promise((resolve) => { answer = () => resolve({ ok: true }); }));
    let finished = false;
    act(() => { void app.signOut().then(() => { finished = true; }); });
    // Nothing of the account is left while the request is still out.
    await screen.findByRole("heading", { name: "Welcome back" });
    expect(screen.queryByText(commune.name)).toBeNull();
    expect(sessionStorage.getItem(`commune.local.${user.id}`)).toBeNull();
    expect(localStorage.getItem(`commune.local.${user.id}`)).toBeNull();
    expect(location.history?.at(-1)).toBe("/login");
    expect(currentViewer()).toBeNull();
    await act(async () => answer());
    await waitFor(() => expect(finished).toBe(true));
    expect(post).toHaveBeenCalledWith("/auth/logout", {});
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("says when sign-out was not confirmed and offers to try again", async () => {
    mount();
    await screen.findByRole("heading", { name: commune.name });
    vi.mocked(post).mockRejectedValueOnce(new ApiError("Auth provider unavailable", 503));
    await act(async () => { await app.signOut(); });
    await screen.findByRole("heading", { name: "Welcome back" });
    expect(screen.getByRole("alert").textContent).toContain("Commune couldn’t confirm your sign-out, so this device may still be signed in.");
    expect(screen.queryByText("Auth provider unavailable")).toBeNull();
    vi.mocked(post).mockRejectedValueOnce(new TypeError("Failed to fetch"));
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await screen.findByText(/Sign-out still isn’t confirmed/);
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(screen.queryByText(/sign-out/i)).toBeNull());
    expect(vi.mocked(post).mock.calls.filter(([path]) => path === "/auth/logout")).toHaveLength(3);
  });

  it("can sign out from the connection problem screen", async () => {
    vi.mocked(api).mockRejectedValue(new TypeError("Failed to fetch"));
    mount();
    await screen.findByRole("heading", { name: "We couldn’t connect" });
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    await screen.findByRole("heading", { name: "Welcome back" });
    expect(post).toHaveBeenCalledWith("/auth/logout", {});
  });
});

describe("a refused session", () => {
  it("is treated as signed out at start-up, not as a connection problem", async () => {
    vi.mocked(loadCommunes).mockRejectedValue(new ApiError("Request identity could not be verified", 401));
    mount();
    await screen.findByRole("heading", { name: "Welcome back" });
    expect(screen.getByRole("status").textContent).toBe("Commune couldn’t confirm your sign-in. Please sign in again.");
    expect(screen.queryByRole("heading", { name: "We couldn’t connect" })).toBeNull();
    expect(loadCommunes).toHaveBeenCalledTimes(1);
  });

  it("says a change was not saved when it was refused because the account changed", async () => {
    mount();
    await screen.findByRole("heading", { name: commune.name });
    signedIn = { id: "user-2", name: "Someone else", email: "else@example.com", emailVerified: true };
    vi.mocked(post).mockRejectedValueOnce(new ApiError(ACCOUNT_CHANGED, 401));
    await act(async () => { await app.markNotificationRead("notice-1").catch(() => undefined); });
    await screen.findByRole("heading", { name: "Welcome back" });
    expect(screen.getByRole("status").textContent).toBe("You were signed out, so your last change wasn’t saved. Sign in to try again.");
    expect(screen.queryByText(commune.name)).toBeNull();
    expect(loadSnapshot).toHaveBeenCalledTimes(1);
  });
});

describe("other tabs", () => {
  it("forget this account when another tab signs out", async () => {
    mount();
    await screen.findByRole("heading", { name: commune.name });
    act(() => otherTab(null));
    await screen.findByRole("heading", { name: "Welcome back" });
    expect(screen.getByRole("status").textContent).toBe("You signed out or changed account in another tab.");
    expect(screen.queryByText(commune.name)).toBeNull();
    // This tab does not sign out again: the other tab already did.
    expect(post).not.toHaveBeenCalled();
  });

  it("never switch to another account's data while showing this one", async () => {
    mount();
    await screen.findByRole("heading", { name: commune.name });
    signedIn = { id: "user-2", name: "Someone else", email: "else@example.com", emailVerified: true };
    act(() => otherTab("user-2"));
    await screen.findByRole("heading", { name: "Welcome back" });
    expect(screen.queryByText(commune.name)).toBeNull();
    expect(loadCommunes).toHaveBeenCalledTimes(1);
  });

  it("are followed by a signed-out tab when one of them signs in", async () => {
    signedIn = null;
    mount("/login");
    await screen.findByRole("heading", { name: "Welcome back" });
    signedIn = user;
    act(() => otherTab(user.id));
    await waitFor(() => expect(loadCommunes).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(app.session?.userId).toBe(user.id));
  });

  it("hear about this tab's sign-in", async () => {
    signedIn = null;
    mount("/login");
    await screen.findByRole("heading", { name: "Welcome back" });
    const heard: unknown[] = [];
    const listener = new BroadcastChannel("commune.session");
    listener.onmessage = (event) => heard.push(event.data);
    signedIn = user;
    await act(async () => { await app.signInWithPassword(user.email, "a long password"); });
    await waitFor(() => expect(heard).toEqual([{ type: "session", userId: user.id }]));
    listener.close();
  });
});
