import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Commune } from "../src/live/model";

const mocks = vi.hoisted(() => ({ getSession: vi.fn(), from: vi.fn(), rpc: vi.fn() }));
vi.mock("@neondatabase/neon-js", () => ({
  createClient: () => ({ auth: { getSession: mocks.getSession }, from: mocks.from, rpc: mocks.rpc }),
}));
const commune: Commune = { id: "commune-1", name: "Home", kind: "household", currency: "GBP", role: "admin" };
beforeEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
  vi.stubEnv("VITE_NEON_AUTH_URL", "https://ep-test.neonauth.c-7.us-east-2.aws.neon.tech/neondb/auth");
  mocks.getSession.mockResolvedValue({ data: null, error: null });
});

describe("hosted read authentication", () => {
  it("does not treat known commune metadata as an authenticated session", async () => {
    const { snapshot } = await import("../src/live/neon");
    await expect(snapshot(commune.id, commune)).rejects.toThrow("Sign in required");
    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("rejects a changed account before using a previous viewer", async () => {
    mocks.getSession.mockResolvedValue({ data: { user: { id: "new-user", emailVerified: true } } });
    const { listCommunes } = await import("../src/live/neon");
    await expect(listCommunes({ id: "old-user", name: "Old", email: "old@example.test", emailVerified: true }))
      .rejects.toThrow("Your account changed");
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("checks a verified session before requesting reminder usage", async () => {
    const { neonApi } = await import("../src/live/neon");
    await expect(neonApi("/reminders/usage")).rejects.toThrow("Sign in required");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
