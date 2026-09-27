import { afterEach, expect, it, vi } from "vitest";
import { createClient } from "@neondatabase/neon-js";

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

// Exercise the real installed SDK, not a mock of getSession/from/rpc. The
// transport is the test boundary; no live accounts or network are involved.
it("deduplicates session bootstrap and refreshes the JWT before concurrent reads after expiry", async () => {
  const start = new Date("2026-09-27T00:00:00Z");
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(start);
  let sessions = 0;
  const credentials: string[] = [];
  const token = () => `e30.${btoa(JSON.stringify({ sub: "test-user", exp: Math.floor(Date.now() / 1000) + 900 }))}.test-signature`;
  const transport = vi.fn<typeof fetch>(async (input, init) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input : input.url);
    if (url.pathname.endsWith("/get-session")) {
      sessions++;
      return Response.json({
        session: { id: "test-session", userId: "test-user", token: "opaque-cookie-token", expiresAt: "2026-10-01T00:00:00Z" },
        user: { id: "test-user", name: "Test", email: "test@example.test", emailVerified: true },
      }, { headers: { "Set-Auth-Jwt": token() } });
    }
    if (url.pathname.includes("/rest/v1/")) {
      credentials.push(new Headers(init?.headers).get("Authorization") ?? "");
      return Response.json([]);
    }
    throw new Error(`Unexpected test endpoint: ${url.pathname}`);
  });
  vi.stubGlobal("fetch", transport);
  const client = createClient({
    auth: { url: "https://test.neonauth.example.test/neondb/auth" },
    dataApi: { url: "https://test.apirest.example.test/neondb/rest/v1", options: { global: { fetch: transport } } },
  });
  const read = () => Promise.all([
    client.from("communes").select("id"),
    client.rpc("member_profiles", { p_commune_id: "test-commune" }),
    client.from("commune_operations").select("id"),
  ]);
  const initialToken = token();
  expect((await read()).every((result) => !result.error)).toBe(true);
  expect(sessions).toBe(1);
  expect(credentials).toEqual(Array(3).fill(`Bearer ${initialToken}`));

  vi.setSystemTime(new Date(start.getTime() + 16 * 60_000));
  credentials.length = 0;
  const refreshedToken = token();
  expect((await read()).every((result) => !result.error)).toBe(true);
  expect(sessions).toBe(2);
  expect(credentials).toEqual(Array(3).fill(`Bearer ${refreshedToken}`));
  expect(refreshedToken).not.toBe(initialToken);
});
