// @vitest-environment node
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
  // The list, each role and member count and each change mark come from one
  // database function, read together.
  const listed = { id: "commune-1", name: "Home", kind: "household", currency: "GBP", address: "", destination: "",
    stayName: "", stayAddress: "", role: "admin", memberCount: 2, changeMark: "2026-10-09:3:41" };
  function listResult(data: unknown, error: unknown = null) {
    mocks.getSession.mockResolvedValue({ data: { user: { id: "viewer", emailVerified: true } } });
    mocks.rpc.mockResolvedValue({ data, error });
  }

  it("reports missing database identity as authentication failure, not an empty list", async () => {
    listResult(null, { code: "28000", message: "Request identity could not be verified" });
    const { listCommunes } = await import("../src/live/neon");
    await expect(listCommunes()).rejects.toMatchObject({ status: 401 });
  });

  it("does not turn malformed database responses into No communes yet", async () => {
    listResult(null);
    const { listCommunes } = await import("../src/live/neon");
    await expect(listCommunes()).rejects.toMatchObject({ status: 502 });
  });

  it("reads communes, roles, member counts and change marks in one consistent call", async () => {
    listResult([listed]);
    const { listCommunes } = await import("../src/live/neon");
    expect(await listCommunes()).toEqual([{ id: "commune-1", name: "Home", kind: "household", currency: "GBP", role: "admin",
      memberCount: 2, address: "", destination: "", stayName: "", stayAddress: "", changeMark: "2026-10-09:3:41" }]);
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("my_communes");
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("carries each commune's unread notice count for the bell, when the database sends one (0039)", async () => {
    listResult([{ ...listed, unreadNotices: 3 }, { ...listed, id: "commune-2" }]);
    const { listCommunes } = await import("../src/live/neon");
    const [counted, older] = await listCommunes();
    expect(counted.unreadNotices).toBe(3);
    // Before 0039 the field is missing, and the app counts the open commune's own notices.
    expect("unreadNotices" in older).toBe(false);
    listResult([{ ...listed, unreadNotices: "many" }]);
    await expect(listCommunes()).rejects.toMatchObject({ status: 502 });
  });

  it("checks a verified session before reading notices across communes", async () => {
    const { neonApi } = await import("../src/live/neon");
    await expect(neonApi("/notices/unread")).rejects.toThrow("Sign in required");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("reads unread notices across communes through one guarded RPC and refuses a malformed answer", async () => {
    mocks.getSession.mockResolvedValue({ data: { user: { id: "viewer", emailVerified: true } } });
    const notices = [{ id: "notice-1", kind: "payment-reported", communeId: "commune-2", senderName: "Ben", fundId: null }];
    mocks.rpc.mockResolvedValue({ data: notices, error: null });
    const { neonApi } = await import("../src/live/neon");
    expect(await neonApi("/notices/unread")).toEqual({ notices });
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("my_unread_notices");
    mocks.rpc.mockResolvedValue({ data: null, error: null });
    await expect(neonApi("/notices/unread")).rejects.toMatchObject({ status: 502 });
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("does not publish a commune without the viewer's membership or its change mark", async () => {
    const { listCommunes } = await import("../src/live/neon");
    for (const entry of [{ id: "commune-1", name: "Home" }, { ...listed, role: "owner" }, { ...listed, changeMark: null }]) {
      listResult([entry]);
      await expect(listCommunes()).rejects.toMatchObject({ status: 409 });
    }
  });

  it("still accepts a genuinely empty new account", async () => {
    listResult([]);
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
  it("reads an overview summary through its own RPC and never takes one for the full record", async () => {
    mocks.getSession.mockResolvedValue({ data: { user: { id: "viewer", emailVerified: true } } });
    const data = { commune, members: [], expenses: [], funds: [], reminderTargets: [], notifications: [], detail: "summary" };
    mocks.rpc.mockResolvedValue({ data, error: null });
    const { snapshot, neonApi } = await import("../src/live/neon");
    expect(await snapshot(commune.id, commune, "summary")).toEqual(data);
    expect(mocks.rpc).toHaveBeenLastCalledWith("commune_summary", { p_commune_id: commune.id });
    expect(await neonApi(`/communes/${commune.id}/snapshot?detail=summary`)).toEqual(data);
    expect(mocks.rpc).toHaveBeenLastCalledWith("commune_summary", { p_commune_id: commune.id });
    await expect(snapshot(commune.id, commune)).rejects.toMatchObject({ status: 502 });
    expect(mocks.rpc).toHaveBeenLastCalledWith("commune_snapshot", { p_commune_id: commune.id });
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
    expect(mocks.rpc).not.toHaveBeenCalled();
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
