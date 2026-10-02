import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

// Fixture writes must never run against the user's normal local API.
const base = process.env.API_BASE;
const origin = new URL(base ?? "http://invalid");
if (!base || origin.protocol !== "http:" || !["localhost", "127.0.0.1"].includes(origin.hostname) ||
  !origin.port || origin.port === "3002" || origin.pathname !== "/" || origin.username || origin.password || origin.search || origin.hash) {
  throw new Error("Search tests require an isolated loopback API_BASE, not port 3002.");
}
const suffix = randomUUID().slice(0, 8);
function session() {
  let cookie = "";
  return async (method, path, input) => {
    const response = await fetch(`${base}/api${path}`, { method,
      headers: { ...(input === undefined ? {} : { "Content-Type": "application/json" }), ...(cookie ? { Cookie: cookie } : {}) },
      body: input === undefined ? undefined : JSON.stringify(input) });
    const set = response.headers.get("set-cookie"); if (set) cookie = set.split(";")[0];
    return { status: response.status, ...await response.json() };
  };
}
const owner = session(), member = session(), outsider = session(), guest = session();
async function signup(call, name, slug) {
  const result = await call("POST", "/auth/signup", { name, email: `${slug}-${suffix}@example.test`, password: "DisposableSearchFixture-2026!" });
  assert.equal(result.status, 201, JSON.stringify(result)); return result.user;
}
const alice = await signup(owner, "Garden owner", "search-owner");
const bob = await signup(member, "Garden member", "search-member");
await signup(outsider, "Outsider", "hidden-mailbox");
const commune = await owner("POST", "/communes", { name: "Garden House", kind: "household", currency: "GBP" });
assert.equal(commune.status, 201);
const second = await owner("POST", "/communes", { name: "Garden Weekend", kind: "trip", currency: "EUR" });
const foreign = await outsider("POST", "/communes", { name: "Garden Private", kind: "household", currency: "GBP" });
const invite = await owner("POST", `/communes/${commune.id}/invites`, { email: bob.email, role: "member" });
assert.equal((await member("POST", `/invites/${invite.token}/accept`, {})).status, 200);
const saved = {};
saved.expense = (await owner("POST", `/communes/${commune.id}/expenses`, { title: "Garden supplies", category: "Household",
  amountMinor: 4000, shares: [{ userId: alice.id, amountMinor: 4000 }] })).id;
saved.fund = (await owner("POST", `/communes/${commune.id}/funds`, { name: "Garden fund", targetMinor: 10000 })).id;
async function note(title, pill, body, facts = [], communeId = commune.id) {
  const result = await owner("POST", `/communes/${communeId}/notes`, { title, pill, kicker: "Everyone", lede: "", body, facts });
  assert.equal(result.status, 201, JSON.stringify(result)); return result.id;
}
saved.note = await note("Garden guide", "Other", "Remember the plants");
saved.operation = (await owner("POST", `/communes/${commune.id}/operations`, { kind: "task", category: "chore", title: "Garden reset", date: "2026-10-02", allDay: true, repeat: "none", status: "open", notes: "", assignee: null })).id;
saved.recurring = (await owner("POST", `/communes/${commune.id}/recurring`, { title: "Garden maintenance", amountMinor: 1000,
  paidByUserId: alice.id, allocations: [{ userId: alice.id, amountMinor: 1000 }], frequency: "monthly", nextDueOn: "2026-10-02", paused: false })).id;
saved.template = (await owner("POST", `/communes/${commune.id}/templates`, { name: "Garden halves", method: "Equal",
  participants: [{ userId: alice.id, value: "" }, { userId: bob.id, value: "" }] })).id;
assert.ok(Object.values(saved).every(Boolean), JSON.stringify(saved));
await note("Garden trip guide", "Other", "Weekend plans", [], second.id);
await note("Guest network", "Wi-Fi", "SecretBodySentinel", [["Password", "SecretFactSentinel"]]);
await note("Safe custom title", "Other", "CustomSecretSentinel", [["Door code", "54321"]]);
await note("Contacts book", "Contacts", "ContactPrivateSentinel", [["Phone", "01234567890"]]);
await note("Saving 50%_ this week", "Other", "Literal wildcards");
const search = (call, q, scope, limit) => call("GET", `/search?${new URLSearchParams({ q, ...(scope ? { commune: scope } : {}), ...(limit ? { limit: String(limit) } : {}) })}`);
assert.equal((await search(guest, "garden")).status, 401);
assert.equal((await search(guest, "g")).status, 401);
assert.equal((await search(outsider, "garden", commune.id)).status, 403);
const result = await search(owner, "garden", commune.id);
assert.equal(result.status, 200, JSON.stringify(result));
assert.equal(new Set(result.items.map(item => item.kind)).size, 8, JSON.stringify(result));
for (const [kind, id] of Object.entries(saved)) assert.ok(result.items.some(item => item.kind === kind && item.id === id && item.communeId === commune.id));
assert.ok(result.items.every(item => item.communeId === commune.id));
assert.ok(!JSON.stringify(result).includes(alice.email));
const all = await search(owner, "garden");
assert.ok(all.items.some(item => item.communeId === second.id));
assert.ok(all.items.every(item => item.communeId !== foreign.id));
assert.ok((await search(outsider, "garden")).items.every(item => item.communeId === foreign.id));
for (const secret of ["SecretBodySentinel", "SecretFactSentinel", "CustomSecretSentinel", "54321", "ContactPrivateSentinel", "01234567890", alice.email]) {
  assert.equal((await search(owner, secret)).total, 0, `Leaked search term: ${secret}`);
}
const wifi = await search(owner, "Guest network");
assert.equal(wifi.items[0].subtitle, "Network and password. Open to view connection details.");
assert.ok(!JSON.stringify(wifi).includes("Sentinel"));
assert.equal((await search(owner, "%_")).total, 1);
assert.equal((await search(owner, "%%")).total, 0);
assert.equal((await search(owner, "g")).total, 0);
assert.equal((await search(owner, "x".repeat(81))).status, 400);
assert.equal((await search(owner, "garden", commune.id, 26)).status, 400);
assert.equal((await owner("GET", "/search?q=garden&commune=not-an-id")).status, 400);
const limited = await search(owner, "garden", commune.id, 1);
assert.ok(limited.hasMore); assert.ok(limited.items.length < limited.total);
assert.ok(limited.items.filter(item => item.kind === "member").length === 1);
assert.equal((await owner("POST", `/funds/${saved.fund}/archive`, { archived: true })).status, 200);
assert.ok(!(await search(owner, "garden")).items.some(item => item.id === saved.fund));
assert.equal((await owner("POST", `/communes/${commune.id}/members/${bob.id}`, { action: "remove" })).status, 200);
assert.equal((await search(member, "garden", commune.id)).status, 403);
assert.equal((await search(member, "garden")).total, 0);
console.log("Search integration passed: 8 record types, exact IDs, scope/limits, literal wildcards, private-note masking, active-membership isolation, authentication and archived records.");
