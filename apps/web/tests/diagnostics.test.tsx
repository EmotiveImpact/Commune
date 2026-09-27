import { afterEach, expect, it, vi } from "vitest";
import { observedDataFetch } from "../src/live/diagnostics";

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

it("logs only safe request labels on failure, never credentials or filters", async () => {
  const log = vi.spyOn(console, "info").mockImplementation(() => {});
  const response = new Response('{"message":"private database details"}', { status: 403 });
  const fetchMock = vi.fn().mockResolvedValue(response);
  vi.stubGlobal("fetch", fetchMock);
  const url = "https://example.test/rest/v1/rpc/member_profiles?p_commune_id=private-id";
  const init = { method: "POST", headers: { Authorization: "Bearer secret-token" }, body: "private-body" };
  expect(await observedDataFetch(url, init)).toBe(response);
  expect(fetchMock).toHaveBeenCalledWith(url, init);
  const trace = log.mock.calls[0][1];
  expect(JSON.parse(trace)).toMatchObject({ resource: "rpc/member_profiles", status: 403 });
  for (const secret of ["example.test", "private-id", "secret-token", "private-body", "private database details"]) {
    expect(trace).not.toContain(secret);
  }
});

it("does not log successful requests without opt-in diagnostics", async () => {
  const log = vi.spyOn(console, "info").mockImplementation(() => {});
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("[]")));
  await observedDataFetch("https://example.test/rest/v1/expenses");
  expect(log).not.toHaveBeenCalled();
});
