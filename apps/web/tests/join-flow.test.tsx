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
import { readInviteHints, withInviteHints } from "../src/data/inviteHints";

vi.mock("../src/live/api", async (importOriginal) => ({
  ...await importOriginal<typeof import("../src/live/api")>(),
  api: vi.fn(), post: vi.fn(), loadCommunes: vi.fn(), loadSnapshot: vi.fn(),
}));

// Joining a house from an invitation link (mock-up approved 8 November 2026).
const user = { id: "user-2", name: "Priya Nair", email: "priya@example.test", emailVerified: true };
const house: Commune = { id: "house-1", name: "14 Park Street", kind: "household", currency: "GBP", role: "member" };
const snapshot: Snapshot = { commune: house,
  members: [{ userId: "user-1", name: "Maya Chen", role: "admin" }, { userId: user.id, name: user.name, role: "member" }],
  expenses: [], funds: [], notifications: [], reminderTargets: [] };
const token = "cd".repeat(32);
const link = `/invite?token=${token}&house=14+Park+Street&by=Maya`;

let signedIn: typeof user | null = null;
let member = false;
function mount(path = link) {
  const location = memoryLocation({ path, record: true });
  render(<Router hook={location.hook}><AppProvider><App /></AppProvider></Router>);
  return location;
}

beforeAll(preloadAll);
beforeEach(() => {
  vi.resetAllMocks();
  sessionStorage.clear();
  setViewer(null);
  signedIn = null;
  member = false;
  vi.mocked(api).mockImplementation(async (path) => {
    if (path === "/auth/me") return { user: signedIn };
    if (path === "/reminders/usage") return { totalUsed: 0, totalLimit: 60, recipientLimit: 6, recipientUsage: {}, nextSlotAt: null };
    if (path.endsWith("/invites")) return { invites: [] };
    if (path === "/preferences") return { emailReminders: true };
    if (path === "/pay-links") return { links: [] };
    if (path === `/invites/${token}`) return { invite: { communeName: "14 Park Street", role: "member", expiresAt: "2026-11-15T10:00:00Z" } };
    if (path.startsWith("/communes/house-1/")) return {};
    throw new Error(`Unexpected API request ${path}`);
  });
  vi.mocked(post).mockImplementation(async (path) => {
    if (path === `/invites/${token}/accept`) { member = true; return { communeId: house.id }; }
    return { ok: true };
  });
  vi.mocked(loadCommunes).mockImplementation(async () => ({ communes: member ? [house] : [] }));
  vi.mocked(loadSnapshot).mockResolvedValue(snapshot);
});
afterEach(cleanup);

describe("joining a house", () => {
  it("greets someone signed out with the house and who asked, then asks them to sign in", async () => {
    mount();
    await screen.findByRole("heading", { name: "Join 14 Park Street" });
    expect(screen.getByText("Maya invited you to join")).toBeTruthy();
    await waitFor(() => expect((screen.getByRole("button", { name: "Join 14 Park Street" }) as HTMLButtonElement).disabled).toBe(false));
    expect(screen.getByText("The house already has Commune. It’s free for you.")).toBeTruthy();
    // No plans and no trial for someone joining.
    expect(screen.queryByText(/trial/i)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Join 14 Park Street" }));
    await screen.findByRole("heading", { name: "Sign in to join" });
    fireEvent.click(screen.getByRole("link", { name: "Create an account with email" }));
    // Signing up comes back to the invitation.
    expect(sessionStorage.getItem("commune.return-to")).toBe(link);
  });

  it("joins, then shows how the house sees you and your part, then Home", async () => {
    signedIn = user;
    const location = mount();
    const join = await screen.findByRole("button", { name: "Join 14 Park Street" });
    await waitFor(() => expect((join as HTMLButtonElement).disabled).toBe(false));
    await act(async () => { fireEvent.click(join); });
    expect(vi.mocked(post)).toHaveBeenCalledWith(`/invites/${token}/accept`, {});
    await screen.findByRole("heading", { name: "This is how the house sees you" });
    // Still on the invitation, not sent to the house yet.
    expect(location.history?.at(-1)).toBe(link);
    fireEvent.click(await screen.findByRole("button", { name: "Continue without" }));
    await screen.findByRole("heading", { name: "You owe nothing today." });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "That looks right" })); });
    expect(location.history?.at(-1)).toBe("/");
  });
});

describe("invitation link hints", () => {
  it("adds the house and the inviter's first name, and reads them back", () => {
    const url = withInviteHints(new URL(`https://app.ourcommune.io/invite?token=${token}`), "14 Park Street", "Maya Chen");
    expect(url.searchParams.get("token")).toBe(token);
    expect(readInviteHints(url.search)).toEqual({ house: "14 Park Street", by: "Maya" });
  });

  it("drops markup and links, and keeps them short", () => {
    expect(readInviteHints("?house=%3Cb%3EHi%3C%2Fb%3E&by=https://evil.test").house).toBe("bHi/b");
    expect(readInviteHints("?by=https://evil.test").by).toBeNull();
    expect(readInviteHints(`?house=${"a".repeat(90)}`).house).toHaveLength(60);
    expect(readInviteHints("")).toEqual({ house: null, by: null });
  });
});
