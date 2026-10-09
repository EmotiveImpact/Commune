import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { App } from "../src/App";
import { preloadAll } from "../src/shell/lazyComponent";
import { AppProvider, useApp, type AppState } from "../src/state";
import { api, loadCommunes, loadSnapshot, post } from "../src/live/api";
import type { Commune, Snapshot } from "../src/live/model";

vi.mock("../src/live/api", async (importOriginal) => ({
  ...await importOriginal<typeof import("../src/live/api")>(),
  api: vi.fn(), post: vi.fn(), loadCommunes: vi.fn(), loadSnapshot: vi.fn(),
}));

const user = { id: "user-1", name: "Test Person", email: "test@example.test", emailVerified: true };
// Communes are listed newest first.
const trip: Commune = { id: "trip-1", name: "Lisbon trip", kind: "trip", currency: "EUR", role: "admin" };
const commune: Commune = { id: "home-1", name: "Our home", kind: "household", currency: "GBP", role: "admin" };
const snapshotOf = (item: Commune): Snapshot => ({ commune: item, members: [{ userId: user.id, name: user.name, role: "admin" }], expenses: [], funds: [], notifications: [], reminderTargets: [] });
const ACCOUNT = `commune.local.${user.id}`;
let app: AppState;
function Capture() { app = useApp(); return null; }
function mount(path = "/settings") {
  const location = memoryLocation({ path, record: true });
  render(<Router hook={location.hook}><AppProvider><Capture /><App /></AppProvider></Router>);
  return location;
}
// Closing the tab: the page goes, and so does its session storage.
function closeTab() {
  cleanup();
  sessionStorage.clear();
}
const shell = () => document.querySelector(".a-body")!;
const kept = (key: string) => JSON.parse(localStorage.getItem(key) ?? "null");

// The device's light or dark setting, which a test can change.
let deviceDark = false;
const listeners = new Set<() => void>();
function setDeviceDark(dark: boolean) {
  deviceDark = dark;
  for (const listener of listeners) listener();
}

// The screens and windows a browser loads on first use are loaded up front,
// so each test sees them drawn at once.
beforeAll(preloadAll);
beforeEach(() => {
  vi.resetAllMocks();
  sessionStorage.clear();
  deviceDark = false;
  listeners.clear();
  vi.stubGlobal("matchMedia", (query: string) => ({
    media: query,
    get matches() { return query === "(prefers-color-scheme: dark)" && deviceDark; },
    addEventListener: (_type: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_type: string, listener: () => void) => listeners.delete(listener),
  }));
  vi.mocked(api).mockImplementation(async (path) => {
    if (path === "/auth/me") return { user };
    if (path === "/reminders/usage") return { totalUsed: 0, totalLimit: 60, recipientLimit: 6, recipientUsage: {}, nextSlotAt: null };
    if (path.endsWith("/invites")) return { invites: [] };
    if (path === "/preferences") return { emailReminders: true };
    throw new Error(`Unexpected API request ${path}`);
  });
  vi.mocked(post).mockResolvedValue({ ok: true });
  vi.mocked(loadCommunes).mockResolvedValue({ communes: [trip, commune] });
  vi.mocked(loadSnapshot).mockImplementation(async (item) => snapshotOf(item));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

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

describe("the theme", () => {
  it("follows the device until Light or Dark is chosen, and can follow it again", async () => {
    setDeviceDark(true);
    mount();
    const theme = await screen.findByLabelText("Theme") as HTMLSelectElement;
    expect(theme.value).toBe("system");
    expect(shell().classList.contains("is-dark")).toBe(true);
    act(() => setDeviceDark(false));
    expect(shell().classList.contains("is-dark")).toBe(false);
    fireEvent.change(theme, { target: { value: "dark" } });
    expect(shell().classList.contains("is-dark")).toBe(true);
    act(() => setDeviceDark(true));
    fireEvent.change(theme, { target: { value: "light" } });
    expect(shell().classList.contains("is-dark")).toBe(false);
    fireEvent.change(theme, { target: { value: "system" } });
    expect(shell().classList.contains("is-dark")).toBe(true);
    expect(screen.getByRole("option", { name: "Match this device" })).toBeTruthy();
  });

  it("is kept for the next tab, with the sidebar and notices", async () => {
    mount();
    fireEvent.change(await screen.findByLabelText("Theme"), { target: { value: "dark" } });
    fireEvent.click(screen.getByRole("button", { name: "Advanced" }));
    fireEvent.click(screen.getByRole("switch", { name: "Notices" }));
    expect(kept("commune.device")).toEqual({ theme: "dark", navMode: "advanced", noticesOn: false });
    closeTab();
    mount();
    expect((await screen.findByLabelText("Theme") as HTMLSelectElement).value).toBe("dark");
    expect(shell().classList.contains("is-dark")).toBe(true);
    expect(shell().classList.contains("nav-advanced")).toBe(true);
    expect(app.noticesOn).toBe(false);
  });

  it("changes in every open tab when one tab changes it", async () => {
    mount();
    await screen.findByLabelText("Theme");
    localStorage.setItem("commune.device", JSON.stringify({ theme: "dark", navMode: "basic", noticesOn: true }));
    act(() => { window.dispatchEvent(new StorageEvent("storage", { key: "commune.device" })); });
    expect(shell().classList.contains("is-dark")).toBe(true);
    expect((screen.getByLabelText("Theme") as HTMLSelectElement).value).toBe("dark");
  });
});

describe("the last commune", () => {
  it("opens again in a new tab, rather than the newest", async () => {
    mount("/hub");
    await screen.findByRole("heading", { name: trip.name });
    await act(async () => app.go("hub", { hub: commune.id }));
    await screen.findByRole("heading", { name: commune.name });
    closeTab();
    mount("/hub");
    await screen.findByRole("heading", { name: commune.name });
    expect(app.hub.id).toBe(commune.id);
  });

  it("is passed over once the account has left it", async () => {
    localStorage.setItem(ACCOUNT, JSON.stringify({ activeHubId: "left-1", payMethods: [], hubPhotos: {} }));
    mount("/hub");
    await screen.findByRole("heading", { name: trip.name });
    expect(app.hub.id).toBe(trip.id);
  });

  it("belongs to one account", async () => {
    localStorage.setItem("commune.local.someone-else", JSON.stringify({ activeHubId: commune.id, payMethods: [], hubPhotos: {} }));
    mount("/hub");
    await screen.findByRole("heading", { name: trip.name });
  });
});

describe("preferences kept by a tab before this release", () => {
  it("move to this browser once, and the tab's copy goes", async () => {
    sessionStorage.setItem(ACCOUNT, JSON.stringify({
      activeHubId: commune.id, navMode: "advanced", dark: true, noticesOn: true,
      payMethods: [{ provider: "Monzo", value: "@test" }], hubPhotos: {},
    }));
    mount("/hub");
    await screen.findByRole("heading", { name: commune.name });
    expect(shell().classList.contains("is-dark")).toBe(true);
    expect(shell().classList.contains("nav-advanced")).toBe(true);
    expect(app.payMethods).toEqual([{ provider: "Monzo", value: "@test" }]);
    expect(sessionStorage.getItem(ACCOUNT)).toBeNull();
    expect(kept(ACCOUNT)).toMatchObject({ activeHubId: commune.id, payMethods: [{ provider: "Monzo", value: "@test" }] });
    expect(kept("commune.device")).toEqual({ theme: "dark", navMode: "advanced", noticesOn: true });
  });

  it("never replace what this browser already keeps", async () => {
    localStorage.setItem("commune.device", JSON.stringify({ theme: "light", navMode: "basic", noticesOn: true }));
    sessionStorage.setItem(ACCOUNT, JSON.stringify({ dark: true, navMode: "advanced" }));
    mount();
    await screen.findByLabelText("Theme");
    expect(kept("commune.device")).toEqual({ theme: "light", navMode: "basic", noticesOn: true });
    expect(shell().classList.contains("is-dark")).toBe(false);
  });

  it("dark mode left off now follows the device", async () => {
    setDeviceDark(true);
    sessionStorage.setItem(ACCOUNT, JSON.stringify({ dark: false }));
    mount();
    expect((await screen.findByLabelText("Theme") as HTMLSelectElement).value).toBe("system");
    expect(shell().classList.contains("is-dark")).toBe(true);
  });
});

describe("a full or blocked store", () => {
  it("keeps a change for this visit and breaks nothing", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new DOMException("Full", "QuotaExceededError"); });
    mount();
    fireEvent.change(await screen.findByLabelText("Theme"), { target: { value: "dark" } });
    expect(shell().classList.contains("is-dark")).toBe(true);
    expect(localStorage.getItem("commune.device")).toBeNull();
    expect(warn).toHaveBeenCalledWith("This browser could not keep a Commune preference");
  });

  it("that cannot even be read still shows the app", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new DOMException("Blocked", "SecurityError"); });
    mount("/hub");
    await screen.findByRole("heading", { name: trip.name });
    expect(app.theme).toBe("system");
  });
});

describe("signing out", () => {
  it("removes the account's preferences and keeps the device's", async () => {
    mount();
    fireEvent.change(await screen.findByLabelText("Theme"), { target: { value: "dark" } });
    act(() => { app.savePayMethod({ provider: "Monzo", value: "@test" }); });
    await act(async () => app.go("hub", { hub: commune.id }));
    expect(kept(ACCOUNT)).toMatchObject({ activeHubId: commune.id, payMethods: [{ provider: "Monzo", value: "@test" }] });
    await act(async () => { await app.signOut(); });
    await screen.findByRole("heading", { name: "Welcome back" });
    expect(localStorage.getItem(ACCOUNT)).toBeNull();
    expect(sessionStorage.getItem(ACCOUNT)).toBeNull();
    expect(kept("commune.device")).toMatchObject({ theme: "dark" });
    await waitFor(() => expect(app.payMethods).toEqual([]));
  });

  it("keeps nothing saved afterwards by something still holding the account", async () => {
    mount("/hub");
    await screen.findByRole("heading", { name: trip.name });
    // As the remembered commune's effect, or a form, can after sign-out.
    const { savePayMethod } = app;
    await act(async () => { await app.signOut(); });
    await screen.findByRole("heading", { name: "Welcome back" });
    act(() => { savePayMethod({ provider: "Monzo", value: "@late" }); });
    expect(localStorage.getItem(ACCOUNT)).toBeNull();
    expect(app.payMethods).toEqual([]);
  });
});
