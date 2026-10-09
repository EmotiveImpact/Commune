import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getSession: vi.fn(), from: vi.fn(), rpc: vi.fn() }));
vi.mock("@neondatabase/neon-js", () => ({
  createClient: () => ({ auth: { getSession: mocks.getSession }, from: mocks.from, rpc: mocks.rpc }),
}));
beforeEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
  vi.stubEnv("VITE_NEON_AUTH_URL", "https://ep-test.neonauth.c-7.us-east-2.aws.neon.tech/neondb/auth");
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("the account on screen", () => {
  it("is the only account the hosted client acts for", async () => {
    // Another tab signed in as someone else; this tab still shows "viewer".
    mocks.getSession.mockResolvedValue({ data: { user: { id: "someone-else", emailVerified: true } } });
    const { ACCOUNT_CHANGED, setViewer } = await import("../src/live/session");
    const { neonApi } = await import("../src/live/neon");
    setViewer("viewer");
    await expect(neonApi("/communes")).rejects.toMatchObject({ status: 401, message: ACCOUNT_CHANGED });
    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
    // Asking who is signed in still answers, so the tab can tell what changed.
    expect(await neonApi("/auth/me")).toMatchObject({ user: { id: "someone-else" } });
  });

  it("leaves no copy of the session in local storage", async () => {
    // What the auth SDK writes for other tabs on a sign-in or token refresh.
    const broadcast = () => localStorage.setItem("better-auth.message",
      JSON.stringify({ event: "session", data: { trigger: "SIGNED_IN", sessionData: { session: { token: "a-token", ipAddress: "192.0.2.1" } } } }));
    mocks.getSession.mockImplementation(async () => {
      broadcast();
      return { data: { user: { id: "someone-else", emailVerified: true } } };
    });
    const { setViewer } = await import("../src/live/session");
    const { neonApi } = await import("../src/live/neon");
    await neonApi("/auth/me");
    expect(localStorage.getItem("better-auth.message")).toBeNull();
    // Also when the request is refused.
    setViewer("viewer");
    await expect(neonApi("/communes")).rejects.toMatchObject({ status: 401 });
    expect(localStorage.getItem("better-auth.message")).toBeNull();
    setViewer(null);
  });

  it("is named on every request to the local API", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ communes: [] }), { headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    const { setViewer } = await import("../src/live/session");
    const { api } = await import("../src/live/api");
    setViewer("viewer");
    await api("/communes");
    setViewer(null);
    await api("/communes");
    const sent = fetchMock.mock.calls.map((call) => new Headers((call as unknown as [string, RequestInit])[1].headers).get("X-Commune-Viewer"));
    expect(sent).toEqual(["viewer", null]);
  });
});
