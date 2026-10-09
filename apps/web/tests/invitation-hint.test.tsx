import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { App } from "../src/App";
import { preloadAll } from "../src/shell/lazyComponent";
import { AppProvider } from "../src/state";
import { api, loadCommunes, loadSnapshot, post } from "../src/live/api";
import type { Commune, Snapshot } from "../src/live/model";
import { setViewer } from "../src/live/session";

vi.mock("../src/live/api", async (importOriginal) => ({
  ...await importOriginal<typeof import("../src/live/api")>(),
  api: vi.fn(), post: vi.fn(), loadCommunes: vi.fn(), loadSnapshot: vi.fn(),
}));

// Finding 31: an invitation opened while signed in with another address.
const user = { id: "user-1", name: "Test Person", email: "test@example.test", emailVerified: true };
const home: Commune = { id: "home-1", name: "Our home", kind: "household", currency: "GBP", role: "admin" };
const snapshot: Snapshot = { commune: home, members: [{ userId: user.id, name: user.name, role: "admin" }],
  expenses: [], funds: [], notifications: [], reminderTargets: [] };
const token = "ab".repeat(32);
const invitation = `/invite?token=${token}`;

let signedIn: typeof user | null = user;
let preview: { communeName: string; role: string; expiresAt: string } | null = null;
let hint: () => Promise<{ hint: string | null }> = async () => ({ hint: "e•••@g•••.com" });
function mount(path = invitation) {
  const location = memoryLocation({ path, record: true });
  render(<Router hook={location.hook}><AppProvider><App /></AppProvider></Router>);
  return location;
}

// The screens and windows a browser loads on first use are loaded up front,
// so each test sees them drawn at once.
beforeAll(preloadAll);
beforeEach(() => {
  vi.resetAllMocks();
  sessionStorage.clear();
  setViewer(null);
  signedIn = user;
  preview = null;
  hint = async () => ({ hint: "e•••@g•••.com" });
  vi.mocked(api).mockImplementation(async (path) => {
    if (path === "/auth/me") return { user: signedIn };
    if (path === "/reminders/usage") return { totalUsed: 0, totalLimit: 60, recipientLimit: 6, recipientUsage: {}, nextSlotAt: null };
    if (path.endsWith("/invites")) return { invites: [] };
    if (path === "/preferences") return { emailReminders: true };
    if (path === `/invites/${token}`) return { invite: preview };
    if (path === `/invites/${token}/hint`) return hint();
    throw new Error(`Unexpected API request ${path}`);
  });
  vi.mocked(post).mockImplementation(async (path) => {
    if (path === "/auth/login") signedIn = user;
    if (path === "/auth/logout") signedIn = null;
    return { ok: true };
  });
  vi.mocked(loadCommunes).mockResolvedValue({ communes: [home] });
  vi.mocked(loadSnapshot).mockResolvedValue(snapshot);
});
afterEach(cleanup);

const hintRequests = () => vi.mocked(api).mock.calls.filter(([path]) => path.endsWith("/hint")).length;

describe("an invitation sent to another address", () => {
  it("says which address, masked, and which account is signed in", async () => {
    mount();
    await screen.findByRole("heading", { name: "This invitation is for another address" });
    expect(screen.getByText("It was sent to e•••@g•••.com, and you’re signed in as test@example.test. To join, sign in with the address it was sent to.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Sign out and use another account" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Continue to Commune" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Join commune" })).toBeNull();
  });

  it("signs out, and comes back to the invitation after signing in again", async () => {
    const location = mount();
    fireEvent.click(await screen.findByRole("button", { name: "Sign out and use another account" }));
    await screen.findByRole("heading", { name: "Welcome back" });
    expect(vi.mocked(post)).toHaveBeenCalledWith("/auth/logout", {});
    expect(sessionStorage.getItem("commune.return-to")).toBe(invitation);
    // The other account is the one invited.
    preview = { communeName: "Flat 4", role: "member", expiresAt: "2026-10-16T10:00:00Z" };
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "emma@gmail.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "a long enough password" } });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Sign in" })); });
    await screen.findByRole("heading", { name: "Join Flat 4" });
    expect(location.history?.at(-1)).toBe(invitation);
  });

  it("carries on to Commune", async () => {
    const location = mount();
    fireEvent.click(await screen.findByRole("button", { name: "Continue to Commune" }));
    await screen.findByRole("heading", { name: "Your communes, Test." });
    expect(location.history?.at(-1)).toBe("/");
  });

  it("still leads on when there is nothing to tell", async () => {
    hint = async () => ({ hint: null });
    mount();
    await screen.findByRole("heading", { name: "Invitation unavailable" });
    expect(screen.getByRole("button", { name: "Continue to Commune" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Sign out and use another account" })).toBeNull();
  });

  it("does without the hint when it cannot be read", async () => {
    hint = async () => { throw new Error("Network unavailable"); };
    mount();
    await screen.findByRole("heading", { name: "Invitation unavailable" });
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByRole("button", { name: "Continue to Commune" })).toBeTruthy();
  });

  it("never asks for a hint for the invited account, or when signed out", async () => {
    preview = { communeName: "Flat 4", role: "member", expiresAt: "2026-10-16T10:00:00Z" };
    mount();
    await screen.findByRole("heading", { name: "Join Flat 4" });
    expect(screen.getByRole("button", { name: "Join commune" })).toBeTruthy();
    expect(hintRequests()).toBe(0);
    cleanup();
    signedIn = null;
    mount();
    await screen.findByRole("heading", { name: "You have a Commune invitation" });
    expect(screen.getByRole("button", { name: "Sign in" })).toBeTruthy();
    expect(hintRequests()).toBe(0);
  });
});
