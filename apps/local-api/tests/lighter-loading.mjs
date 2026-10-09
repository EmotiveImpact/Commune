import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

// Change marks in the commune list, the overview summary, pages of older
// expenses, named expense records and the limit on creating communes (0036).
// Creates accounts and communes, so it refuses the normal application API.
const base = process.env.API_BASE;
if (!base) throw new Error("Set API_BASE to an isolated local test API, not the user's database.");
const url = new URL(base);
if (url.protocol !== "http:" || !["127.0.0.1", "localhost"].includes(url.hostname) || !url.port ||
    url.port === "3002" || url.pathname !== "/" || url.search || url.hash || url.username || url.password) {
  throw new Error("Lighter loading tests require an isolated loopback API port (not 3002).");
}
// Letters only, so a commune name that carries it never holds a phone-like run of digits.
const suffix = randomUUID().slice(0, 8).replace(/[0-9]/g, (digit) => "ghijklmnop"[digit]);
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
async function signup(call, name, slug) {
  const result = await call("POST", "/auth/signup", { name, email: `${slug}-${suffix}@example.test`, password: "DisposableLoadingFixture-2026!" });
  assert.equal(result.status, 201, JSON.stringify(result));
  return result.user;
}
const owner = session(), member = session(), outsider = session(), maker = session();
const avery = await signup(owner, "Avery Loading", "loading-owner");
const blake = await signup(member, "Blake Loading", "loading-member");
await signup(outsider, "Casey Loading", "loading-outsider");
const home = await owner("POST", "/communes", { name: `Loading ${suffix}`, kind: "household", currency: "GBP" });
assert.equal(home.status, 201, JSON.stringify(home));
const invite = await owner("POST", `/communes/${home.id}/invites`, { email: blake.email, role: "member" });
assert.equal((await member("POST", `/invites/${invite.token}/accept`, {})).status, 200);

// The list carries each commune's mark, which stays put until something changes.
async function listed(call) {
  const list = await call("GET", "/communes");
  assert.equal(list.status, 200, JSON.stringify(list));
  return list.communes.find((commune) => commune.id === home.id);
}
const first = await listed(owner);
assert.deepEqual(Object.keys(first).sort(), ["address", "changeMark", "currency", "destination", "id", "kind",
  "memberCount", "name", "role", "stayAddress", "stayName"]);
assert.deepEqual([first.name, first.role, first.memberCount], [`Loading ${suffix}`, "admin", 2]);
assert.match(first.changeMark, /^\d{4}-\d{2}-\d{2}:\d+:\d+$/);
assert.equal((await listed(owner)).changeMark, first.changeMark, "Reading moved the mark");
assert.equal((await listed(member)).changeMark, first.changeMark, "Members see the same mark");
assert.equal((await listed(outsider)), undefined, "Someone outside sees the commune");
const snapshot = await owner("GET", `/communes/${home.id}/snapshot`);
assert.equal(snapshot.changeMark, first.changeMark);
const today = new Date();
const since = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1)).toISOString().slice(0, 10);
assert.deepEqual(snapshot.expenseHistory, { since, olderCount: 0, olderVoidedCount: 0 });

// A write by anyone in the commune moves it.
const expense = await member("POST", `/communes/${home.id}/expenses`, { title: "Milk", category: "Groceries", amountMinor: 300,
  shares: [{ userId: avery.id, amountMinor: 150 }, { userId: blake.id, amountMinor: 150 }], requestId: randomUUID() });
assert.equal(expense.status, 201, JSON.stringify(expense));
const moved = (await listed(owner)).changeMark;
assert.notEqual(moved, first.changeMark, "A new expense did not move the mark");

// The overview summary: the same parts without the detail of the commune's own screens.
const summary = await owner("GET", `/communes/${home.id}/snapshot?detail=summary`);
assert.equal(summary.status, 200, JSON.stringify(summary));
assert.equal(summary.detail, "summary");
assert.equal(summary.changeMark, moved);
assert.deepEqual(summary.expenses.map((item) => item.id), [expense.id]);
assert.deepEqual(summary.expenses[0].shares.map((share) => share.amountMinor), [150, 150]);
assert.equal((await owner("GET", `/communes/${home.id}/snapshot?detail=everything`)).status, 400);
assert.equal((await outsider("GET", `/communes/${home.id}/snapshot?detail=summary`)).status, 404);

// Older pages. Everything here is new, so there is nothing before the snapshot's start.
const page = await member("GET", `/communes/${home.id}/expenses/history?months=1`);
assert.equal(page.status, 200, JSON.stringify(page));
assert.deepEqual([page.expenses, page.before, page.from, page.olderCount, page.olderVoidedCount], [[], since, null, 0, 0]);
const all = await member("GET", `/communes/${home.id}/expenses/history`);
assert.deepEqual([all.status, all.expenses, all.from], [200, [], null]);
const earlier = await member("GET", `/communes/${home.id}/expenses/history?before=2026-01-15&months=2`);
assert.deepEqual([earlier.status, earlier.before], [200, "2026-01-01"]);
for (const query of ["months=0", "months=13", "months=one", "before=2026-02-30", "before=yesterday"]) {
  assert.equal((await member("GET", `/communes/${home.id}/expenses/history?${query}`)).status, 400, query);
}
assert.equal((await outsider("GET", `/communes/${home.id}/expenses/history?months=1`)).status, 403);

// Named records come in the snapshot's shape, and only from this commune.
const fresh = await owner("GET", `/communes/${home.id}/snapshot`);
const named = await owner("GET", `/communes/${home.id}/expenses/records?ids=${expense.id},${randomUUID()}`);
assert.equal(named.status, 200, JSON.stringify(named));
assert.deepEqual(named.expenses, fresh.expenses);
const tooMany = Array.from({ length: 51 }, () => randomUUID()).join(",");
for (const query of ["", "ids=", `ids=${tooMany}`, "ids=not-an-id"]) {
  assert.equal((await owner("GET", `/communes/${home.id}/expenses/records?${query}`)).status, 400, query);
}
assert.equal((await outsider("GET", `/communes/${home.id}/expenses/records?ids=${expense.id}`)).status, 403);

// Ten new communes in an hour is the most; the next one is refused calmly.
await signup(maker, "Morgan Loading", "loading-maker");
for (const letter of "abcdefghij") {
  const made = await maker("POST", "/communes", { name: `Maker ${letter} ${suffix}`, kind: "household", currency: "GBP" });
  assert.equal(made.status, 201, JSON.stringify(made));
}
const refused = await maker("POST", "/communes", { name: `Maker more ${suffix}`, kind: "household", currency: "GBP" });
assert.equal(refused.status, 409, JSON.stringify(refused));
assert.equal(refused.error, "You have created 10 communes in the last hour. Try again later.");
assert.equal((await maker("GET", "/communes")).communes.length, 10);
// Someone else can still create one.
assert.equal((await outsider("POST", "/communes", { name: `Casey ${suffix}`, kind: "trip", currency: "EUR" })).status, 201);
console.log("Lighter loading: marks, summary, older pages, named records and the creation limit behave as expected.");
