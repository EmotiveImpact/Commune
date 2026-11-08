import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

// Migration 0046: a personal invitation is a link for one named person, sent
// on WhatsApp or by text. It needs no email, works once and never sends an
// email. Creates accounts and records, so it refuses the normal application API.
const base = process.env.API_BASE;
if (!base) throw new Error("Set API_BASE to an isolated local test API, not the user's database.");
const url = new URL(base);
if (url.protocol !== "http:" || !["127.0.0.1", "localhost"].includes(url.hostname) || !url.port ||
    url.port === "3002" || url.pathname !== "/" || url.search || url.hash || url.username || url.password) {
  throw new Error("Personal invitation tests require an isolated loopback API port (not 3002).");
}
const suffix = randomUUID().slice(0, 8).replace(/[0-9]/g, (digit) => "ghijklmnop"[digit]);
const password = "DisposablePersonalInvite-2026!";
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
const admin = session(), maya = session(), theo = session();
for (const [index, call] of [admin, maya, theo].entries()) {
  ok(await call("POST", "/auth/signup", {
    name: ["Jean Phil", "Maya", "Theo"][index], email: `${["pi-admin", "pi-maya", "pi-theo"][index]}-${suffix}@example.test`, password,
  }), 201);
}
const commune = ok(await admin("POST", "/communes", { name: `Elm Road ${suffix}`, kind: "household", currency: "GBP" }), 201);

// Bad requests are refused before the database.
assert.equal((await admin("POST", `/communes/${commune.id}/invites`, { name: "Maya", sentVia: "fax" })).status, 400);
assert.equal((await admin("POST", `/communes/${commune.id}/invites`, { name: "  ", sentVia: "text" })).status, 400);
// Only admins make them.
assert.equal((await maya("POST", `/communes/${commune.id}/invites`, { name: "Someone", sentVia: "link" })).status, 403);

const made = ok(await admin("POST", `/communes/${commune.id}/invites`, { name: "Maya Okafor", sentVia: "whatsapp" }), 201);
assert.match(made.token, /^[0-9a-f]{64}$/);
const listed = ok(await admin("GET", `/communes/${commune.id}/invites`)).invites;
assert.equal(listed.length, 1);
assert.equal(listed[0].inviteeName, "Maya Okafor");
assert.equal(listed[0].sentVia, "whatsapp");
assert.equal(listed[0].email, null);

// It never goes by email.
assert.equal((await admin("POST", "/invitation-email", { token: made.token })).status === 200, false);

// Maya opens it, sees the commune and joins; then it is spent.
const preview = ok(await maya("GET", `/invites/${made.token}`));
assert.equal(preview.invite.communeName, `Elm Road ${suffix}`);
assert.equal(ok(await maya("POST", `/invites/${made.token}/accept`, {})).communeId, commune.id);
assert.equal(ok(await theo("GET", `/invites/${made.token}`)).invite, null);
assert.equal((await theo("POST", `/invites/${made.token}/accept`, {})).status, 403);
console.log("personal invitations ok");
