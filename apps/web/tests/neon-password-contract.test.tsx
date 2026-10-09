import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { commandFailure } from "../src/data/commands";

// Changing a password, signing out everywhere else and resetting a password,
// through the real installed auth SDK: which auth endpoints are called, with
// what, and how the SDK's errors reach the app. The transport is the test
// boundary; nothing contacts Neon.
const user = { id: "viewer", name: "Test", email: "test@example.test", emailVerified: true };
const jwt = () => `e30.${btoa(JSON.stringify({ sub: user.id, exp: Math.floor(Date.now() / 1000) + 900 }))}.test-signature`;
const refusal = (status: number, code: string, message: string) => () => Response.json({ code, message }, { status });
let calls: Array<{ path: string; body: unknown }>;
let answer: () => Response;
let sessionReads = 0;

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("VITE_NEON_AUTH_URL", "https://ep-test.neonauth.c-7.us-east-2.aws.neon.tech/neondb/auth");
  calls = [];
  answer = () => Response.json({ status: true });
  vi.stubGlobal("fetch", vi.fn<typeof fetch>(async (input, init) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input : input.url);
    if (url.pathname.endsWith("/get-session")) {
      sessionReads++;
      return Response.json({
        session: { id: "session-1", userId: user.id, token: "opaque-cookie-token", expiresAt: "2030-01-01T00:00:00Z" }, user,
      }, { headers: { "Set-Auth-Jwt": jwt() } });
    }
    calls.push({ path: url.pathname.slice(url.pathname.indexOf("/auth/") + 5), body: typeof init?.body === "string" ? JSON.parse(init.body) : null });
    return answer();
  }));
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

async function send(path: string, body: unknown) {
  const { neonApi } = await import("../src/live/neon");
  return neonApi(path, { method: "POST", body: JSON.stringify(body) });
}
const change = { currentPassword: "Current-password-1", newPassword: "A-new-password-22" };

describe("hosted password change", () => {
  it("checks the current password and ends the account's other sessions", async () => {
    answer = () => Response.json({ token: "new-session-token", user });
    expect(await send("/auth/change-password", change)).toEqual({ ok: true });
    expect(calls).toEqual([{ path: "/change-password", body: { ...change, revokeOtherSessions: true } }]);
    // This tab carries on as the same account with the token it already has,
    // so the account checks in session.ts see no change.
    const reads = sessionReads;
    const { neonApi } = await import("../src/live/neon");
    expect(await neonApi("/auth/me")).toEqual({ user });
    expect(sessionReads).toBe(reads);
  });

  it("keeps a wrong current password a refusal, apart from an ended sign-in", async () => {
    // The SDK turns both into a 401; only an ended sign-in may read as signed out.
    answer = refusal(400, "INVALID_PASSWORD", "Invalid password");
    await expect(send("/auth/change-password", change)).rejects.toMatchObject({
      name: "ApiError", status: 400, message: "Your current password isn’t right. Nothing was changed." });
    answer = refusal(401, "UNAUTHORIZED", "Unauthorized");
    await expect(send("/auth/change-password", change)).rejects.toMatchObject({
      name: "ApiError", status: 401, message: "Your sign-in has ended. Sign in again to carry on." });
  });

  it("passes on the sign-in rate limit and explains an account without a password", async () => {
    answer = () => Response.json({ message: "Too many requests. Please try again later." }, { status: 429 });
    await expect(send("/auth/change-password", change)).rejects.toMatchObject({ status: 429 });
    answer = refusal(400, "CREDENTIAL_ACCOUNT_NOT_FOUND", "Credential account not found");
    await expect(send("/auth/change-password", change)).rejects.toMatchObject({
      status: 400, message: "This account signs in with Google, so it has no password to change." });
  });

  it("leaves the outcome unknown when the reply is lost or the server fails", async () => {
    answer = () => { throw new TypeError("Failed to fetch"); };
    const lost = await send("/auth/change-password", change).catch((error: unknown) => error);
    expect(commandFailure(lost, "").rejected).toBe(false);
    answer = () => Response.json({ code: "INTERNAL_SERVER_ERROR", message: "Internal Server Error" }, { status: 500 });
    const failed = await send("/auth/change-password", change).catch((error: unknown) => error);
    expect(commandFailure(failed, "").rejected).toBe(false);
    // A failure after the change, starting this device's new session, which
    // the SDK reports as a missing session (401).
    answer = () => Response.json({ code: "FAILED_TO_GET_SESSION", message: "Failed to get session" }, { status: 500 });
    const late = await send("/auth/change-password", change).catch((error: unknown) => error);
    expect(commandFailure(late, "").rejected).toBe(false);
  });

  it("refuses a new password outside 12 to 128 characters without asking the server", async () => {
    for (const newPassword of ["elevenchars", "x".repeat(129)]) {
      await expect(send("/auth/change-password", { ...change, newPassword })).rejects.toMatchObject({
        status: 400, message: "Password must contain 12–128 characters" });
    }
    expect(calls).toEqual([]);
  });
});

describe("hosted sign out everywhere else", () => {
  it("ends the account's other sessions and keeps this one", async () => {
    expect(await send("/auth/logout-others", {})).toEqual({ ok: true });
    expect(calls).toEqual([{ path: "/revoke-other-sessions", body: {} }]);
  });

  it("reads a refusal as an ended sign-in", async () => {
    answer = refusal(401, "UNAUTHORIZED", "Unauthorized");
    await expect(send("/auth/logout-others", {})).rejects.toMatchObject({ name: "ApiError", status: 401 });
  });
});

describe("hosted password reset", () => {
  it("sends the token from the link with the new password", async () => {
    expect(await send("/auth/reset-password", { token: "reset-token", password: "A-new-password-22" })).toEqual({ ok: true });
    expect(calls).toEqual([{ path: "/reset-password", body: { newPassword: "A-new-password-22", token: "reset-token" } }]);
  });

  it("says when the link was used or has expired", async () => {
    answer = refusal(400, "INVALID_TOKEN", "Invalid token");
    await expect(send("/auth/reset-password", { token: "used-token", password: "A-new-password-22" })).rejects.toMatchObject({
      name: "ApiError", status: 400, message: "This reset link has expired or was already used. Request a new one." });
  });
});
