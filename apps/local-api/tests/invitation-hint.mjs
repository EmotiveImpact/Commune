import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

// Migration 0038: someone who opens an invitation while signed in with
// another address is told, masked, which address it was sent to, and no one
// else is told anything. Creates accounts and records, so it refuses the
// normal application API.
const base = process.env.API_BASE;
if (!base) throw new Error("Set API_BASE to an isolated local test API, not the user's database.");
const url = new URL(base);
if (url.protocol !== "http:" || !["127.0.0.1", "localhost"].includes(url.hostname) || !url.port ||
    url.port === "3002" || url.pathname !== "/" || url.search || url.hash || url.username || url.password) {
  throw new Error("Invitation hint tests require an isolated loopback API port (not 3002).");
}
// Letters only, so a commune name that carries it never holds a phone-like run of digits.
const suffix = randomUUID().slice(0, 8).replace(/[0-9]/g, (digit) => "ghijklmnop"[digit]);
const password = "DisposableInvitationHint-2026!";
function session() {
  let cookie = "";
  return async (method, path, input) => {
    const response = await fetch(`${base}/api${path}`, {
      method,
      headers: { ...(input === undefined ? {} : { "Content-Type": "application/json" }), ...(cookie ? { Cookie: cookie } : {}) },
      body: input === undefined ? undefined : JSON.stringify(input),
    });
    const set = response.headers.get("set-cookie");
    if (set) cookie = set.split(";")[0];
    return { status: response.status, ...(await response.json()) };
  };
}
const ok = (result, status = 200) => { assert.equal(result.status, status, JSON.stringify(result)); return result; };
const owner = session(), invited = session(), other = session(), guest = session();
const users = [];
for (const [index, call] of [owner, invited, other].entries()) {
  users.push(ok(await call("POST", "/auth/signup", {
    name: ["Owner", "Invited", "Other"][index], email: `${["hint-owner", "hint-invited", "other"][index]}-${suffix}@example.test`, password,
  }), 201).user);
}
const [, invitedUser] = users;
const name = `Hint home ${suffix}`;
const id = ok(await owner("POST", "/communes", { name, kind: "household", currency: "GBP" }), 201).id;
const { token } = ok(await owner("POST", `/communes/${id}/invites`, { email: invitedUser.email, role: "member" }), 201);

// Another account sees no invitation, but is told which address to use.
assert.equal(ok(await other("GET", `/invites/${token}`)).invite, null);
assert.deepEqual(ok(await other("GET", `/invites/${token}/hint`)), { status: 200, hint: "h•••@e•••.test" });

// The invited account sees the invitation, and no hint.
assert.equal(ok(await invited("GET", `/invites/${token}`)).invite.communeName, name);
assert.equal(ok(await invited("GET", `/invites/${token}/hint`)).hint, null);

// No hint without the invitation's token, or without a sign-in.
assert.equal(ok(await other("GET", `/invites/${"0".repeat(64)}/hint`)).hint, null);
assert.equal((await other("GET", "/invites/not-a-token/hint")).status, 404);
assert.equal((await guest("GET", `/invites/${token}/hint`)).status, 401);

// Once the invitation is used, it says nothing more.
assert.equal(ok(await invited("POST", `/invites/${token}/accept`, {})).communeId, id);
assert.equal(ok(await other("GET", `/invites/${token}/hint`)).hint, null);

console.log("Invitation hint tests passed");
