import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

// Recurring bill commands: an edit carries the version it was based on,
// pause and archive change only their own state, resuming checks who has
// left, and skips are limited. Creates accounts, so it refuses the normal
// application API.
const base = process.env.API_BASE;
if (!base) throw new Error("Set API_BASE to an isolated local test API, not the user's database.");
const url = new URL(base);
if (url.protocol !== "http:" || !["127.0.0.1", "localhost"].includes(url.hostname) || !url.port ||
    url.port === "3002" || url.pathname !== "/" || url.search || url.hash || url.username || url.password) {
  throw new Error("Recurring bill tests require an isolated loopback API port (not 3002).");
}
const suffix = randomUUID().slice(0, 8);
const password = "DisposableRecurringBills-2026!";
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
    return { ...(await response.json()), status: response.status };
  };
}
const ok = (result, status = 200) => { assert.equal(result.status, status, JSON.stringify(result)); return result; };
const refused = (result, status, pattern) => {
  assert.equal(result.status, status, JSON.stringify(result));
  assert.match(result.error, pattern);
};
const a = session(), b = session(), c = session(), d = session();
const users = [];
for (const [index, call] of [a, b, c, d].entries()) {
  users.push(ok(await call("POST", "/auth/signup", {
    name: ["Avery Admin", "Blake Payer", "Casey Member", "Dana Leaver"][index], email: `bills-${index}-${suffix}@example.test`, password,
  }), 201).user);
}
const [avery, blake, casey, dana] = users;
const id = ok(await a("POST", "/communes", { name: `Bills ${suffix}`, kind: "household", currency: "GBP" }), 201).id;
for (const [user, call] of [[blake, b], [casey, c], [dana, d]]) {
  const invite = ok(await a("POST", `/communes/${id}/invites`, { email: user.email, role: "member" }), 201);
  ok(await call("POST", `/invites/${invite.token}/accept`, {}));
}
const iso = (date) => date.toISOString().slice(0, 10);
const daysFrom = (days) => iso(new Date(Date.now() + days * 86_400_000));
const today = daysFrom(0);
const bill = async (billId) => ok(await a("GET", `/communes/${id}/snapshot`)).recurringBills.find(item => item.id === billId);
const add = async (input) => ok(await a("POST", `/communes/${id}/recurring`, { requestId: randomUUID(), ...input }), 201).id;
const only = (user, amountMinor) => [{ userId: user.id, amountMinor }];

// ------------------------------------------------ adding is safe to retry
const broadband = { title: "Broadband", amountMinor: 9000, paidByUserId: blake.id, frequency: "monthly", nextDueOn: daysFrom(-3),
  allocations: [{ userId: blake.id, amountMinor: 4500 }, { userId: casey.id, amountMinor: 4500 }] };
refused(await b("POST", `/communes/${id}/recurring`, broadband), 400, /requestId/);
const requestId = randomUUID();
const broadbandId = ok(await b("POST", `/communes/${id}/recurring`, { ...broadband, paused: false, requestId }), 201).id;
assert.equal(ok(await b("POST", `/communes/${id}/recurring`, { ...broadband, paused: false, requestId }), 201).id, broadbandId);
let saved = await bill(broadbandId);
assert.deepEqual([saved.version, saved.archivedAt, saved.paused], [1, null, false]);
assert.equal(ok(await a("GET", `/communes/${id}/snapshot`)).recurringBills.length, 1, "a retried add made one bill");

// ------------------------- a screen opened earlier cannot undo a newer change
// Blake's editor loaded version 1. Avery raises the amount and records the period.
const raised = { ...broadband, id: broadbandId, amountMinor: 9600,
  allocations: [{ userId: blake.id, amountMinor: 4800 }, { userId: casey.id, amountMinor: 4800 }] };
ok(await a("POST", `/communes/${id}/recurring`, { ...raised, expectedVersion: 1 }), 201);
const recorded = ok(await a("POST", `/recurring/${broadbandId}/periods`, { expectedDueOn: broadband.nextDueOn }), 201);
refused(await b("POST", `/communes/${id}/recurring`, { ...broadband, id: broadbandId, expectedVersion: 1 }), 409,
  /^This recurring bill was changed by someone else\./);
refused(await b("POST", `/communes/${id}/recurring`, { ...broadband, id: broadbandId }), 400, /expectedVersion/);
// His Pause, from the same old screen, changes only whether it is paused.
const paused = ok(await b("POST", `/recurring/${broadbandId}/pause`, { paused: true }));
assert.deepEqual([paused.paused, paused.duplicate], [true, false]);
saved = await bill(broadbandId);
assert.deepEqual([saved.amountMinor, saved.nextDueOn, saved.paused, saved.version], [9600, recorded.nextDueOn, true, paused.version]);
assert.equal(ok(await b("POST", `/recurring/${broadbandId}/pause`, { paused: true })).duplicate, true, "pausing twice changes nothing");
assert.equal((await bill(broadbandId)).version, paused.version);
refused(await b("POST", `/recurring/${broadbandId}/pause`, {}), 400, /paused/);
// An edit cannot resume, nor put the due date back on a recorded period.
refused(await a("POST", `/communes/${id}/recurring`, { ...raised, expectedVersion: saved.version, nextDueOn: saved.nextDueOn, paused: false }),
  400, /^An edit cannot pause or resume a bill\./);
refused(await a("POST", `/communes/${id}/recurring`, { ...raised, expectedVersion: saved.version }), 409, /already recorded/);
// Casey is in the split but neither added nor pays the bill.
refused(await c("POST", `/recurring/${broadbandId}/pause`, { paused: false }), 403, /pause or resume/);
refused(await c("POST", `/recurring/${broadbandId}/archive`, { archived: true }), 403, /archive or restore/);
refused(await c("POST", `/communes/${id}/recurring`, { ...raised, paidByUserId: casey.id, expectedVersion: saved.version, nextDueOn: saved.nextDueOn }),
  403, /admin/);
ok(await b("POST", `/recurring/${broadbandId}/pause`, { paused: false }));

// ------------------------------------------------------ archive and restore
const archived = ok(await b("POST", `/recurring/${broadbandId}/archive`, { archived: true }));
assert.ok(archived.archivedAt);
assert.deepEqual([archived.paused, archived.duplicate], [true, false]);
assert.equal(ok(await b("POST", `/recurring/${broadbandId}/archive`, { archived: true })).duplicate, true);
saved = await bill(broadbandId);
assert.equal(saved.archivedAt, archived.archivedAt);
refused(await b("POST", `/recurring/${broadbandId}/periods`, { expectedDueOn: saved.nextDueOn }), 409, /archived/);
refused(await b("POST", `/recurring/${broadbandId}/skip`, { expectedDueOn: saved.nextDueOn, reason: "Away" }), 409, /archived/);
refused(await b("POST", `/recurring/${broadbandId}/pause`, { paused: false }), 409, /archived/);
refused(await a("POST", `/communes/${id}/recurring`, { ...raised, expectedVersion: saved.version, nextDueOn: saved.nextDueOn }), 409, /archived/);
refused(await b("POST", `/recurring/${broadbandId}/archive`, { archived: "no" }), 400, /archived/);
const restored = ok(await b("POST", `/recurring/${broadbandId}/archive`, { archived: false }));
assert.deepEqual([restored.archivedAt, restored.paused, restored.duplicate], [null, true, false]);
ok(await b("POST", `/recurring/${broadbandId}/pause`, { paused: false }));
const events = ok(await a("GET", `/communes/${id}/snapshot`)).activityEvents.filter(item => item.entityId === broadbandId).map(item => item.description);
for (const line of ["Paused", "Resumed", "Archived", "Restored, still paused"]) assert.ok(events.includes(line), JSON.stringify(events));

// ------------------------------------------ someone leaves while it is paused
const cleaner = { title: "Cleaner", amountMinor: 6000, paidByUserId: avery.id, frequency: "weekly", nextDueOn: daysFrom(2),
  allocations: [{ userId: casey.id, amountMinor: 3000 }, { userId: dana.id, amountMinor: 3000 }] };
const cleanerId = await add(cleaner);
refused(await d("POST", `/communes/${id}/members/${dana.id}`, { action: "leave" }), 409, /recurring bills/);
ok(await a("POST", `/recurring/${cleanerId}/pause`, { paused: true }));
ok(await d("POST", `/communes/${id}/members/${dana.id}`, { action: "leave" }));
const resume = await a("POST", `/recurring/${cleanerId}/pause`, { paused: false });
assert.equal(resume.status, 409, JSON.stringify(resume));
assert.equal(resume.error, "Dana Leaver has left the commune. Update the payer and split before resuming this bill.");
ok(await a("POST", `/communes/${id}/recurring`, { ...cleaner, id: cleanerId, expectedVersion: (await bill(cleanerId)).version,
  allocations: only(casey, 6000) }), 201);
assert.equal((await bill(cleanerId)).paused, true, "saving the fixed split does not resume it");
ok(await a("POST", `/recurring/${cleanerId}/pause`, { paused: false }));

// --------------------------------------- skips: one period ahead, 12 a day
const milkId = await add({ title: "Milk", amountMinor: 700, paidByUserId: avery.id, frequency: "weekly", nextDueOn: daysFrom(3),
  allocations: only(avery, 700) });
ok(await a("POST", `/recurring/${milkId}/skip`, { expectedDueOn: daysFrom(3), reason: "Away this week" }), 201);
refused(await a("POST", `/recurring/${milkId}/skip`, { expectedDueOn: daysFrom(10), reason: "Away next week too" }), 409,
  /^It is too early to skip the .+ period\. You can skip it from .+\.$/);
const paper = { title: "Paper", amountMinor: 500, paidByUserId: avery.id, frequency: "weekly", nextDueOn: daysFrom(-140),
  allocations: only(avery, 500) };
const paperId = await add(paper);
for (let week = 0; week < 12; week += 1) {
  ok(await a("POST", `/recurring/${paperId}/skip`, { expectedDueOn: daysFrom(-140 + 7 * week), reason: "Catching up" }), 201);
}
refused(await a("POST", `/recurring/${paperId}/skip`, { expectedDueOn: daysFrom(-56), reason: "One more" }), 409,
  /12 periods skipped in the last day/);
// A longer backlog is cleared by moving the next due date on.
ok(await a("POST", `/communes/${id}/recurring`, { ...paper, id: paperId, expectedVersion: (await bill(paperId)).version, nextDueOn: today }), 201);
assert.equal((await bill(paperId)).nextDueOn, today);

// ---------------------------------------------------------- next due range
refused(await a("POST", `/communes/${id}/recurring`, { ...paper, requestId: randomUUID(), nextDueOn: daysFrom(-400) }), 400,
  /^Choose a next due date between /);
refused(await a("POST", `/communes/${id}/recurring`, { ...paper, requestId: randomUUID(), nextDueOn: daysFrom(800) }), 400,
  /^Choose a next due date between /);
console.log(`recurring bill commands integration passed (${base})`);
