import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
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

// Finding 65: the sign-in pages do not download every screen. Code a browser
// loads on first use is held back here until a test lets it arrive.
const held = vi.hoisted(() => {
  const hold = () => {
    let arrive = () => {};
    const arrived = new Promise<void>((resolve) => { arrive = resolve; });
    return { arrived, arrive, loads: 0 };
  };
  return { app: hold(), templates: hold(), announcement: hold() };
});
vi.mock("../src/shell/ProductShell", async (importOriginal) => {
  held.app.loads += 1;
  await held.app.arrived;
  return importOriginal();
});
vi.mock("../src/screens/Templates", async (importOriginal) => {
  held.templates.loads += 1;
  await held.templates.arrived;
  return importOriginal();
});
vi.mock("../src/windows/AnnouncementWindows", async (importOriginal) => {
  held.announcement.loads += 1;
  await held.announcement.arrived;
  return importOriginal();
});

const user = { id: "user-1", name: "Test Person", email: "test@example.test", emailVerified: true };
const commune: Commune = { id: "home-1", name: "Our home", kind: "household", currency: "GBP", role: "admin" };
const snapshot: Snapshot = { commune, members: [{ userId: user.id, name: user.name, role: "admin" }], expenses: [], funds: [], notifications: [], reminderTargets: [] };
let signedIn: typeof user | null = null;
let app: AppState;
function Capture() { app = useApp(); return null; }
function mount(path: string) {
  const location = memoryLocation({ path, record: true });
  render(<Router hook={location.hook}><AppProvider><Capture /><App /></AppProvider></Router>);
}

beforeAll(() => { Element.prototype.scrollIntoView = vi.fn(); });
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

// In order: the code each test lets arrive stays loaded for the next.
describe("code a browser loads on first use", () => {
  it("is not part of the sign-in page", async () => {
    signedIn = null;
    mount("/login");
    await screen.findByRole("heading", { name: "Welcome back" });
    expect(held.app.loads).toBe(0);
  });

  it("keeps the loading page up until the signed-in app arrives", async () => {
    mount("/hub");
    await waitFor(() => expect(app.session?.userId).toBe(user.id));
    expect(held.app.loads).toBe(1);
    expect(screen.getByLabelText("Loading account").getAttribute("aria-busy")).toBe("true");
    expect(screen.queryByRole("heading", { name: commune.name })).toBeNull();
    await act(async () => held.app.arrive());
    expect(await screen.findByRole("heading", { name: commune.name })).toBeTruthy();
    expect(screen.queryByLabelText("Loading account")).toBeNull();
  });

  it("shows the page's skeleton while a screen's code arrives", async () => {
    mount("/templates");
    expect(await screen.findByRole("status", { name: "Loading this page" })).toBeTruthy();
    expect(held.templates.loads).toBe(1);
    await act(async () => held.templates.arrive());
    expect(await screen.findByRole("button", { name: /Save template/ })).toBeTruthy();
    expect(screen.queryByRole("status", { name: "Loading this page" })).toBeNull();
  });

  it("shows the window's loading state while a window's code arrives", async () => {
    mount("/hub/announce");
    const dialog = await screen.findByRole("dialog", { name: "Post an announcement" });
    expect(await within(dialog).findByRole("status", { name: "Loading" })).toBeTruthy();
    expect(held.announcement.loads).toBe(1);
    await act(async () => held.announcement.arrive());
    expect(await within(dialog).findByLabelText(/^Title/)).toBeTruthy();
    expect(within(dialog).queryByRole("status", { name: "Loading" })).toBeNull();
  });
});
