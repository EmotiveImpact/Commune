import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

// Recurring bill periods: record at a different amount, skip with a reason,
// safe retries and period history. Creates accounts, so it refuses the
// normal application API.
const base = process.env.API_BASE;
if (!base) throw new Error("Set API_BASE to an isolated local test API, not the user's database.");
const url = new URL(base);
if (url.protocol !== "http:" || !["127.0.0.1", "localhost"].includes(url.hostname) || !url.port ||
    url.port === "3002" || url.pathname !== "/" || url.search || url.hash || url.username || url.password) {
  throw new Error("Recurring period tests require an isolated loopback API port (not 3002).");
}
// Letters only, so a commune name that carries it never holds a phone-like run of digits.
const suffix = randomUUID().slice(0, 8).replace(/[0-9]/g, (digit) => "ghijklmnop"[digit]);
const password = "DisposableRecurringFixture-2026!";
function session() {
  let cookie = "";
  return async (method, path, input) => {
    const response = await fetch(`${base.replace(/\/$/, "")}/api${path}`, {
      method,
      headers: { ...(input === undefined ? {} : { "Content-Type": "application/json" }), ...(cookie ? { Cookie: cookie } : {}) },
      body: input === undefined ? undefined : JSON.stringify(input),
    });
    const set = response.headers.get("set-cookie");
    if (set) cookie = set.split(";")[0];
    const data = await response.json();
    return { ...data, periodStatus: data.status, status: response.status };
  };
}
const ok = (result, status = 200) => { assert.equal(result.status, status, JSON.stringify(result)); return result; };
const a = session(), b = session(), c = session();
const users = [];
for (const [index, call] of [a, b, c].entries()) {
  users.push(ok(await call("POST", "/auth/signup", {
    name: ["Avery Payer", "Blake Member", "Casey Member"][index], email: `recurring-${index}-${suffix}@example.test`, password,
  }), 201).user);
}
const [avery, blake, casey] = users;
const id = ok(await a("POST", "/communes", { name: `Recurring ${suffix}`, kind: "household", currency: "GBP" }), 201).id;
for (const [user, call] of [[blake, b], [casey, c]]) {
  const invite = ok(await a("POST", `/communes/${id}/invites`, { email: user.email, role: "member" }), 201);
  ok(await call("POST", `/invites/${invite.token}/accept`, {}));
}
const iso = (date) => date.toISOString().slice(0, 10);
const today = iso(new Date());
const snapshot = async (call = a) => ok(await call("GET", `/communes/${id}/snapshot`));
const bill = async (billId) => (await snapshot()).recurringBills.find(item => item.id === billId);
// Month ends, in UTC like the database's dates: the latest 31st followed by
// a shorter month whose third period is already past. The bill is then
// recent enough to add, and its periods can be recorded or skipped.
const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const monthEnd = (year, month) => new Date(Date.UTC(year, month + 1, 0));
let anchor = null;
for (let back = 3; !anchor; back += 1) {
  const now = new Date();
  const candidate = monthEnd(now.getUTCFullYear(), now.getUTCMonth() - back);
  if (candidate.getUTCDate() === 31 && monthEnd(now.getUTCFullYear(), now.getUTCMonth() - back + 1).getUTCDate() < 31) anchor = candidate;
}
const periodDate = (offset) => monthEnd(anchor.getUTCFullYear(), anchor.getUTCMonth() + offset);
const period = (offset) => iso(periodDate(offset));
const label = (offset) => `${periodDate(offset).getUTCDate()} ${months[periodDate(offset).getUTCMonth()]}`;

const electricity = ok(await a("POST", `/communes/${id}/recurring`, {
  title: "Electricity", amountMinor: 9000, paidByUserId: avery.id, frequency: "monthly", nextDueOn: period(0), paused: false, requestId: randomUUID(),
  allocations: [{ userId: avery.id, amountMinor: 3000 }, { userId: blake.id, amountMinor: 3000 }, { userId: casey.id, amountMinor: 3000 }],
}), 201).id;

// --------------------------------------------- a different amount this time
assert.equal((await b("POST", `/recurring/${electricity}/periods`, { expectedDueOn: period(0) })).status, 403, "only the payer or an admin");
assert.equal((await a("POST", `/recurring/${electricity}/periods`, { expectedDueOn: period(0), amountMinor: 0 })).status, 400);
const first = ok(await a("POST", `/recurring/${electricity}/periods`, { expectedDueOn: period(0), amountMinor: 10001 }), 201);
assert.deepEqual([first.periodStatus, first.amountMinor, first.dueOn, first.nextDueOn, first.duplicate],
  ["recorded", 10001, period(0), period(1), false]);
// The recorded expense carries the scaled split, which adds up exactly.
let snap = await snapshot();
const expense = snap.expenses.find(item => item.id === first.expenseId);
assert.equal(expense.amountMinor, 10001);
assert.deepEqual(expense.shares.map(share => share.amountMinor).sort((x, y) => y - x), [3334, 3334, 3333]);
// The saved bill is unchanged; only this period differed.
assert.equal((await bill(electricity)).amountMinor, 9000);
// A retry of the same period reports the one already recorded.
const retry = ok(await a("POST", `/recurring/${electricity}/periods`, { expectedDueOn: period(0), amountMinor: 10001 }), 200);
assert.deepEqual([retry.duplicate, retry.expenseId], [true, first.expenseId]);
assert.equal((await a("POST", `/recurring/${electricity}/periods`, { expectedDueOn: period(0), amountMinor: 9000 })).status, 409);
assert.equal((await snapshot()).expenses.filter(item => item.title === "Electricity").length, 1);

// ------------------------------------------------- skip, ahead of time too
assert.equal((await a("POST", `/recurring/${electricity}/skip`, { expectedDueOn: period(1), reason: "no" })).status, 400);
assert.equal((await c("POST", `/recurring/${electricity}/skip`, { expectedDueOn: period(1), reason: "Away" })).status, 403);
const second = ok(await a("POST", `/recurring/${electricity}/skip`, { expectedDueOn: period(1), reason: "Supplier holiday credit" }), 201);
assert.deepEqual([second.periodStatus, second.expenseId, second.nextDueOn], ["skipped", null, period(2)]);
assert.equal(ok(await a("POST", `/recurring/${electricity}/skip`, { expectedDueOn: period(1), reason: "Supplier holiday credit" })).duplicate, true);
assert.equal((await a("POST", `/recurring/${electricity}/periods`, { expectedDueOn: period(1) })).status, 409, "a skipped period cannot be recorded");
assert.equal((await a("POST", `/recurring/${electricity}/skip`, { expectedDueOn: period(0), reason: "Too late" })).status, 409, "a recorded period cannot be skipped");
// The usual amount, via the original command older clients use.
const third = ok(await a("POST", `/recurring/${electricity}/record`, { expectedDueOn: period(2) }), 201);
assert.ok(third.id);
// A future period can be skipped ahead of time, but not recorded.
const future = (await bill(electricity)).nextDueOn;
assert.equal(future, period(3));
if (future > today) {
  assert.equal((await a("POST", `/recurring/${electricity}/periods`, { expectedDueOn: future })).status, 409);
}
ok(await a("POST", `/recurring/${electricity}/skip`, { expectedDueOn: future, reason: "Moving out that month" }), 201);

// ------------------------------------------------------------ history line
const saved = await bill(electricity);
assert.equal(saved.nextDueOn, period(4));
assert.deepEqual(saved.history.map(item => [item.dueOn, item.status, item.amountMinor, item.note]), [
  [period(3), "skipped", null, "Moving out that month"],
  [period(2), "recorded", 9000, null],
  [period(1), "skipped", null, "Supplier holiday credit"],
  [period(0), "recorded", 10001, null],
]);
assert.ok(saved.history.every(item => item.actorId === avery.id));
const events = (await snapshot()).activityEvents.filter(item => item.entityId === electricity).map(item => item.description);
assert.ok(events.includes(`Recorded for ${label(0)} · £100.01 (usually £90.00)`), JSON.stringify(events));
assert.ok(events.includes(`Skipped ${label(1)}: Supplier holiday credit`), JSON.stringify(events));
assert.equal(events.filter(item => item === "Updated").length, 0, JSON.stringify(events));

// --------------------------------------- two people record at once: one wins
{
  const water = ok(await a("POST", `/communes/${id}/recurring`, {
    title: "Water", amountMinor: 4000, paidByUserId: avery.id, frequency: "weekly", nextDueOn: today, paused: false, requestId: randomUUID(),
    allocations: [{ userId: avery.id, amountMinor: 2000 }, { userId: blake.id, amountMinor: 2000 }],
  }), 201).id;
  const results = await Promise.all([
    a("POST", `/recurring/${water}/periods`, { expectedDueOn: today }),
    a("POST", `/recurring/${water}/periods`, { expectedDueOn: today }),
    a("POST", `/recurring/${water}/skip`, { expectedDueOn: today, reason: "Duplicate click" }),
  ]);
  assert.ok(results.every(result => [200, 201, 409].includes(result.status)), JSON.stringify(results.map(result => result.status)));
  assert.equal(results.filter(result => result.status === 201).length, 1, JSON.stringify(results));
  assert.equal((await snapshot()).expenses.filter(item => item.title === "Water").length <= 1, true);
  assert.equal((await bill(water)).history.length, 1);
}
console.log(`recurring period integration passed (${base})`);
