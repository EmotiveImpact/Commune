import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

// Pay links: saving your own, who can see them, and leaving a commune.
// Creates accounts and records, so it refuses the normal application API.
const base = process.env.API_BASE;
if (!base) throw new Error("Set API_BASE to an isolated local test API, not the user's database.");
const url = new URL(base);
if (url.protocol !== "http:" || !["127.0.0.1", "localhost"].includes(url.hostname) || !url.port ||
    url.port === "3002" || url.pathname !== "/" || url.search || url.hash || url.username || url.password) {
  throw new Error("Pay link tests require an isolated loopback API port (not 3002).");
}
const suffix = randomUUID().slice(0, 8);
const password = "DisposablePayLinkFixture-2026!";
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
    return { ...(await response.json()), status: response.status };
  };
}
const ok = (result, status = 200) => { assert.equal(result.status, status, JSON.stringify(result)); return result; };
const a = session(), b = session(), outsider = session();
const users = [];
for (const [index, call] of [a, b, outsider].entries()) {
  users.push(ok(await call("POST", "/auth/signup", {
    name: ["Avery Pay", "Blake Pay", "Outsider"][index], email: `pay-links-${index}-${suffix}@example.test`, password,
  }), 201).user);
}
const [avery, blake] = users;
const id = ok(await a("POST", "/communes", { name: `Pay links ${suffix}`, kind: "household", currency: "GBP" }), 201).id;
const invite = ok(await a("POST", `/communes/${id}/invites`, { email: blake.email, role: "member" }), 201);
ok(await b("POST", `/invites/${invite.token}/accept`, {}));

// Validation happens in the database and comes back as a 400 with a reason.
assert.equal((await a("PUT", "/pay-links/monzo", { handle: "not a username" })).status, 400);
assert.equal((await a("PUT", "/pay-links/bank", { accountName: "Avery Pay", sortCode: "12345", accountNumber: "12345678" })).status, 400);
assert.equal((await a("PUT", "/pay-links/venmo", { handle: "avery" })).status, 404);
assert.equal((await outsider("GET", "/pay-links")).links.length, 0);

// Avery saves two; a pasted link keeps only the username.
ok(await a("PUT", "/pay-links/monzo", { handle: "https://monzo.me/averypay" }));
const saved = ok(await a("PUT", "/pay-links/bank", { accountName: "Avery Pay", sortCode: "20-45-77", accountNumber: "41029388" })).links;
assert.deepEqual(saved.map((link) => link.provider), ["monzo", "bank"]);
assert.equal(saved[0].handle, "averypay");
assert.equal(saved[1].sortCode, "204577");
assert.deepEqual(ok(await a("GET", "/pay-links")).links.map((link) => link.provider), ["monzo", "bank"]);

// Blake, in the same commune, sees them in the snapshot; the outsider cannot open it.
const seen = ok(await b("GET", `/communes/${id}/snapshot`)).payLinks;
assert.deepEqual(seen[avery.id].map((link) => link.provider), ["monzo", "bank"]);
assert.equal(seen[blake.id], undefined);
assert.equal((await outsider("GET", `/communes/${id}/snapshot`)).status, 404);
assert.equal(ok(await b("GET", "/pay-links")).links.length, 0);

// Removing is Avery's alone and harmless to repeat.
ok(await b("DELETE", "/pay-links/monzo"));
assert.equal(ok(await a("GET", "/pay-links")).links.length, 2);
assert.equal(ok(await a("DELETE", "/pay-links/monzo")).links.length, 1);
assert.equal(ok(await a("DELETE", "/pay-links/monzo")).links.length, 1);
assert.deepEqual(Object.keys(ok(await b("GET", `/communes/${id}/snapshot`)).payLinks), [avery.id]);

console.log("Pay link tests passed");
