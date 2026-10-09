import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { App } from "../src/App";
import { AppProvider } from "../src/state";
import { api, loadCommunes, loadSnapshot } from "../src/live/api";
import type { Commune, Snapshot } from "../src/live/model";

vi.mock("../src/live/api", async (importOriginal) => ({
  ...await importOriginal<typeof import("../src/live/api")>(),
  api: vi.fn(), loadCommunes: vi.fn(), loadSnapshot: vi.fn(),
}));

const user = { id: "user-1", name: "Test Person", email: "test@example.com", emailVerified: true };
const commune: Commune = { id: "home-1", name: "Our home", kind: "household", currency: "GBP", role: "admin", address: "Test address" };
const snapshot: Snapshot = { commune, members: [{ userId: user.id, name: user.name, role: "admin" }], expenses: [], funds: [], notifications: [], reminderTargets: [] };
let saved: boolean;
let failRead: boolean;

beforeEach(() => {
  vi.resetAllMocks();
  sessionStorage.clear();
  saved = true;
  failRead = false;
  vi.mocked(api).mockImplementation(async (path, init) => {
    if (path === "/auth/me") return { user };
    if (path === "/reminders/usage") return { totalUsed: 0, totalLimit: 60, recipientLimit: 6, recipientUsage: {}, nextSlotAt: null };
    if (path.endsWith("/invites")) return { invites: [] };
    if (path === "/preferences" && (init?.method ?? "GET") === "GET") {
      if (failRead) throw new TypeError("Failed to fetch");
      return { emailReminders: saved };
    }
    if (path === "/preferences" && init?.method === "PUT") {
      saved = (JSON.parse(String(init.body)) as { emailReminders: boolean }).emailReminders;
      return { emailReminders: saved };
    }
    throw new Error(`Unexpected API request ${path}`);
  });
  vi.mocked(loadCommunes).mockResolvedValue({ communes: [commune] });
  vi.mocked(loadSnapshot).mockResolvedValue(snapshot);
});
afterEach(cleanup);

function mount() {
  const location = memoryLocation({ path: "/settings", record: true });
  render(<Router hook={location.hook}><AppProvider><App /></AppProvider></Router>);
}

describe("Email reminders in Settings", () => {
  it("shows the saved account setting and saves a change", async () => {
    mount();
    const toggle = await screen.findByRole("switch", { name: "Email reminders" });
    await waitFor(() => expect(toggle.getAttribute("aria-checked")).toBe("true"));
    expect((toggle as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(toggle);
    await waitFor(() => expect(toggle.getAttribute("aria-checked")).toBe("false"));
    expect(saved).toBe(false);
    expect(vi.mocked(api)).toHaveBeenCalledWith("/preferences", { method: "PUT", body: JSON.stringify({ emailReminders: false }) });
  });

  it("keeps the switch disabled and says so when the setting cannot be read", async () => {
    failRead = true;
    mount();
    const toggle = await screen.findByRole("switch", { name: "Email reminders" });
    await screen.findByText("Your email setting couldn’t be loaded. Reload to try again.");
    expect((toggle as HTMLButtonElement).disabled).toBe(true);
  });
});

const mocks = vi.hoisted(() => ({ getSession: vi.fn(), from: vi.fn(), rpc: vi.fn() }));
vi.mock("@neondatabase/neon-js", () => ({
  createClient: () => ({ auth: { getSession: mocks.getSession }, from: mocks.from, rpc: mocks.rpc }),
}));

describe("hosted email reminder setting", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("VITE_NEON_AUTH_URL", "https://ep-test.neonauth.c-7.us-east-2.aws.neon.tech/neondb/auth");
    mocks.getSession.mockResolvedValue({ data: { user: { id: "viewer", emailVerified: true } }, error: null });
  });

  it("reads the viewer's own row and treats no row as on", async () => {
    const eq = vi.fn().mockResolvedValue({ data: [], error: null });
    const select = vi.fn(() => ({ eq }));
    mocks.from.mockReturnValue({ select });
    const { neonApi } = await import("../src/live/neon");
    expect(await neonApi("/preferences")).toEqual({ emailReminders: true });
    expect(mocks.from).toHaveBeenCalledWith("notification_preferences");
    expect(eq).toHaveBeenCalledWith("user_id", "viewer");
    eq.mockResolvedValue({ data: [{ email_reminders: false }], error: null });
    expect(await neonApi("/preferences")).toEqual({ emailReminders: false });
  });

  it("saves through the database function and refuses anything but on or off", async () => {
    mocks.rpc.mockResolvedValue({ data: false, error: null });
    const { neonApi } = await import("../src/live/neon");
    expect(await neonApi("/preferences", { method: "PUT", body: JSON.stringify({ emailReminders: false }) })).toEqual({ emailReminders: false });
    expect(mocks.rpc).toHaveBeenCalledWith("set_email_reminders", { p_enabled: false });
    await expect(neonApi("/preferences", { method: "PUT", body: JSON.stringify({ emailReminders: "off" }) })).rejects.toMatchObject({ status: 400 });
  });
});
