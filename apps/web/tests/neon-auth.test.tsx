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
  function listResults(communes: unknown, members: unknown, error: unknown = null) {
    mocks.getSession.mockResolvedValue({ data: { user: { id: "viewer", emailVerified: true } } });
    mocks.from.mockImplementation((table: string) => {
      const result = Promise.resolve({ data: table === "communes" ? communes : members, error });
      return { select: () => Object.assign(result, { order: () => result, eq: () => result }) };
    });
  }

  it("reports missing database identity as authentication failure, not an empty list", async () => {
    listResults(null, null, { code: "28000", message: "Request identity could not be verified" });
    const { listCommunes } = await import("../src/live/neon");
    await expect(listCommunes()).rejects.toMatchObject({ status: 401 });
  });

  it("does not turn malformed database responses into No communes yet", async () => {
    listResults(null, []);
    const { listCommunes } = await import("../src/live/neon");
    await expect(listCommunes()).rejects.toMatchObject({ status: 502 });
  });

  it("rejects inconsistent membership reads instead of displaying an empty account", async () => {
    listResults([], [{ commune_id: "commune-1", user_id: "viewer", role: "admin" }]);
    const { listCommunes } = await import("../src/live/neon");
    await expect(listCommunes()).rejects.toMatchObject({ status: 409 });
  });

  it("does not publish a commune without the viewer's membership", async () => {
    listResults([{ id: "commune-1", name: "Home" }], []);
    const { listCommunes } = await import("../src/live/neon");
    await expect(listCommunes()).rejects.toMatchObject({ status: 409 });
  });

  it("still accepts a genuinely empty new account", async () => {
    listResults([], []);
    const { listCommunes } = await import("../src/live/neon");
    expect(await listCommunes()).toEqual([]);
  });

  it("does not treat known commune metadata as an authenticated session", async () => {
    const { snapshot } = await import("../src/live/neon");
    await expect(snapshot(commune.id, commune)).rejects.toThrow("Sign in required");
    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("loads the complete hosted snapshot through one guarded database RPC", async () => {
    mocks.getSession.mockResolvedValue({data:{user:{id:"viewer",emailVerified:true}}});
    const data={commune,members:[],expenses:[],funds:[],reminderTargets:[],notifications:[],recurringBills:[],splitTemplates:[]};
    mocks.rpc.mockResolvedValue({data,error:null});
    const {snapshot}=await import("../src/live/neon");
    expect(await snapshot(commune.id,commune)).toEqual(data);
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("commune_snapshot",{p_commune_id:commune.id});
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it("rejects a mis-scoped snapshot instead of rendering another commune's records",async()=>{
    mocks.getSession.mockResolvedValue({data:{user:{id:"viewer",emailVerified:true}}});
    mocks.rpc.mockResolvedValue({data:{commune:{...commune,id:"other"},members:[],expenses:[],funds:[]},error:null});
    const {snapshot}=await import("../src/live/neon");
    await expect(snapshot(commune.id,commune)).rejects.toMatchObject({status:502});
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

  it("checks a verified session before searching", async () => {
    const { neonApi } = await import("../src/live/neon");
    await expect(neonApi("/search?q=garden")).rejects.toThrow("Sign in required");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("uses the bounded guarded RPC for hosted search without downloading snapshots", async () => {
    mocks.getSession.mockResolvedValue({ data: { user: { id: "viewer", emailVerified: true } } });
    const data = { query: "garden", items: [], total: 0, hasMore: false };
    mocks.rpc.mockResolvedValue({ data, error: null });
    const { neonApi } = await import("../src/live/neon");
    expect(await neonApi("/search?q=garden&commune=commune-1&limit=8")).toEqual(data);
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("search_commune_records", {
      p_query: "garden", p_commune_id: "commune-1", p_limit: 8,
    });
    expect(mocks.from).not.toHaveBeenCalled();
  });
});
