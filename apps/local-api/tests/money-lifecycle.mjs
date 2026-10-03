import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

// Money lifecycle integration: reminder commands, repayment receipts and
// reversals, expense correction/void, and operation occurrences. These tests
// create accounts and records, so they refuse the normal application API.
const base = process.env.API_BASE;
if (!base) throw new Error("Set API_BASE to an isolated local test API, not the user's database.");
const url = new URL(base);
if (url.protocol !== "http:" || !["127.0.0.1", "localhost"].includes(url.hostname) || !url.port ||
    url.port === "3002" || url.pathname !== "/" || url.search || url.hash || url.username || url.password) {
  throw new Error("Money lifecycle tests require an isolated loopback API port (not 3002).");
}
const suffix = randomUUID().slice(0, 8);
const password = "DisposableLifecycleFixture-2026!";
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
const a = session(), b = session(), c = session(), outsider = session();
const users = [];
for (const [index, call] of [a, b, c, outsider].entries()) {
  const result = ok(await call("POST", "/auth/signup", {
    name: ["Avery Payer", "Blake Debtor", "Casey Member", "Outsider"][index],
    email: `lifecycle-${index}-${suffix}@example.test`, password,
  }), 201);
  users.push(result.user);
}
const [avery, blake, casey] = users;
const id = ok(await a("POST", "/communes", { name: `Lifecycle ${suffix}`, kind: "household", currency: "GBP" }), 201).id;
for (const [user, call] of [[blake, b], [casey, c]]) {
  const invite = ok(await a("POST", `/communes/${id}/invites`, { email: user.email, role: "member" }), 201);
  assert.equal(ok(await call("POST", `/invites/${invite.token}/accept`, {})).communeId, id);
}
const snapshot = async (call = a) => ok(await call("GET", `/communes/${id}/snapshot`));
const past = "2026-01-05";
const today = new Date().toISOString().slice(0, 10);

// ---------------------------------------------------------------- reminders
{
  const expense = ok(await a("POST", `/communes/${id}/expenses`, {
    title: "Reminder bill", amountMinor: 3000, dueOn: past,
    shares: [{ userId: avery.id, amountMinor: 1000 }, { userId: blake.id, amountMinor: 1000 }, { userId: casey.id, amountMinor: 1000 }],
  }), 201);
  let snap = await snapshot();
  const shares = snap.expenses.find(item => item.id === expense.id).shares;
  const blakeShare = shares.find(item => item.userId === blake.id);
  const caseyShare = shares.find(item => item.userId === casey.id);
  assert.deepEqual(snap.sentReminders, []);

  // Only the payer may nudge, and a malformed request id is refused.
  assert.equal((await b("POST", "/reminders", { kind: "nudge", sourceId: blakeShare.id, requestId: randomUUID() })).status, 403);
  assert.equal((await a("POST", "/reminders", { kind: "nudge", sourceId: blakeShare.id, requestId: "not-a-uuid" })).status, 400);

  // The same decision sent twice (and concurrently) records one reminder.
  const requestId = randomUUID();
  const first = ok(await a("POST", "/reminders", { kind: "nudge", sourceId: blakeShare.id, requestId }), 201);
  assert.equal(first.duplicate, false);
  assert.equal(first.emailStatus, "none");
  const retry = ok(await a("POST", "/reminders", { kind: "nudge", sourceId: blakeShare.id, requestId }), 200);
  assert.equal(retry.id, first.id);
  assert.equal(retry.duplicate, true);
  const burstId = randomUUID();
  const burst = await Promise.all(Array.from({ length: 6 }, () =>
    a("POST", "/reminders", { kind: "nudge", sourceId: caseyShare.id, requestId: burstId })));
  assert.equal(new Set(burst.map(result => result.id)).size, 1, JSON.stringify(burst));
  assert.equal(burst.filter(result => result.status === 201).length, 1);
  assert.equal(burst.filter(result => result.status === 200 && result.duplicate).length, 5);

  // A request id cannot be replayed against a different obligation.
  assert.equal((await a("POST", "/reminders", { kind: "nudge", sourceId: caseyShare.id, requestId })).status, 400);
  // A genuinely new request inside the cooldown is still rejected by the server.
  const cooled = await a("POST", "/reminders", { kind: "nudge", sourceId: blakeShare.id, requestId: randomUUID() });
  assert.equal(cooled.status, 409);
  assert.match(cooled.error, /already sent in the last 3 days/);

  snap = await snapshot();
  assert.equal(snap.sentReminders.length, 2);
  assert.ok(snap.sentReminders.every(item => item.emailStatus === "none" && item.kind === "nudge"));
  // A sender's reminder log is private to that sender.
  assert.deepEqual((await snapshot(b)).sentReminders, []);
  assert.equal((await snapshot(b)).notifications.length, 1);
  const usage = ok(await a("GET", "/reminders/usage"));
  assert.equal(usage.totalUsed, 2);
  assert.equal((await outsider("POST", "/reminders", { kind: "nudge", sourceId: blakeShare.id, requestId: randomUUID() })).status, 403);
  console.log("reminder commands: ok");
}

// ------------------------------------------------- repayment receipts
{
  // The roadmap acceptance example: a 120.00 bill split 40.00 / 80.00.
  const expense = ok(await a("POST", `/communes/${id}/expenses`, {
    title: "Acceptance bill", amountMinor: 12000,
    shares: [{ userId: avery.id, amountMinor: 4000 }, { userId: blake.id, amountMinor: 8000 }],
  }), 201);
  const find = async (call = a) => (await snapshot(call)).expenses.find(item => item.id === expense.id);
  let saved = await find();
  const own = saved.shares.find(item => item.userId === avery.id);
  const owed = saved.shares.find(item => item.userId === blake.id);
  assert.equal(owed.settledMinor, 0);
  assert.deepEqual(owed.receipts, []);
  const receipt = (input, call = a) => call("POST", `/shares/${owed.id}/receipts`, { receivedOn: today, ...input });

  // Authority: only the payer; not the debtor, another member or an outsider.
  for (const call of [b, c, outsider]) {
    assert.equal((await receipt({ amountMinor: 2500, requestId: randomUUID() }, call)).status, 403);
  }
  // The payer's own share is never a repayment target.
  assert.equal((await a("POST", `/shares/${own.id}/receipts`, { amountMinor: 100, receivedOn: today, requestId: randomUUID() })).status, 400);
  // Validation happens on the server.
  assert.equal((await receipt({ amountMinor: 0, requestId: randomUUID() })).status, 400);
  assert.equal((await receipt({ amountMinor: 2500 })).status, 400);
  assert.equal((await receipt({ amountMinor: 2500, receivedOn: "2099-01-01", requestId: randomUUID() })).status, 400);
  assert.equal((await receipt({ amountMinor: 2500, receivedOn: "2026-02-30", requestId: randomUUID() })).status, 400);
  const unsafe = await receipt({ amountMinor: 2500, reference: "acct 1234 5678 9012", requestId: randomUUID() });
  assert.equal(unsafe.status, 400);
  assert.match(unsafe.error, /card or account numbers/);
  const excess = await receipt({ amountMinor: 8001, requestId: randomUUID() });
  assert.equal(excess.status, 409);
  assert.match(excess.error, /Only £80\.00 is still outstanding/);
  assert.equal((await find()).shares.find(item => item.id === owed.id).settledMinor, 0);

  // Receive 25.00 against the 80.00 share: 55.00 outstanding for both people.
  const requestId = randomUUID();
  const first = ok(await receipt({ amountMinor: 2500, reference: "Bank transfer", requestId }), 201);
  assert.deepEqual([first.duplicate, first.settledMinor, first.outstandingMinor], [false, 2500, 5500]);
  // Retry: still 25.00 received, not 50.00.
  const again = ok(await receipt({ amountMinor: 2500, reference: "Bank transfer", requestId }), 200);
  assert.deepEqual([again.id, again.duplicate, again.settledMinor], [first.id, true, 2500]);
  // The same request id cannot be reused for a different amount, date or reference.
  assert.equal((await receipt({ amountMinor: 100, requestId })).status, 400);
  assert.equal((await receipt({ amountMinor: 2500, reference: "Cash", requestId })).status, 400);
  assert.equal((await receipt({ amountMinor: 2500, reference: "Bank transfer", receivedOn: past, requestId })).status, 400);
  for (const call of [a, b, c]) {
    const seen = (await find(call)).shares.find(item => item.id === owed.id);
    assert.deepEqual([seen.settledMinor, seen.settledAt, seen.receipts.length], [2500, null, 1]);
    assert.deepEqual([seen.receipts[0].amountMinor, seen.receipts[0].reference, seen.receipts[0].receivedOn, seen.receipts[0].recordedBy, seen.receipts[0].reversedAt],
      [2500, "Bank transfer", today, avery.id, null]);
  }

  // Concurrency: six parallel 30.00 receipts cannot exceed the 55.00 left.
  const parallel = await Promise.all(Array.from({ length: 6 }, () => receipt({ amountMinor: 3000, requestId: randomUUID() })));
  assert.equal(parallel.filter(result => result.status === 201).length, 1, JSON.stringify(parallel));
  assert.equal(parallel.filter(result => result.status === 409).length, 5);
  // One command sent six times at once records one entry.
  const burstId = randomUUID();
  const burst = await Promise.all(Array.from({ length: 6 }, () => receipt({ amountMinor: 500, requestId: burstId })));
  assert.equal(new Set(burst.map(result => result.id)).size, 1, JSON.stringify(burst));
  assert.equal(burst.filter(result => result.status === 201).length, 1);
  saved = await find();
  let share = saved.shares.find(item => item.id === owed.id);
  assert.equal(share.settledMinor, 6000);
  assert.equal(share.receipts.length, 3);

  // Reversal: payer only, with a reason, keeping the original entry.
  assert.equal((await b("POST", `/receipts/${first.id}/reverse`, { reason: "Not mine to reverse" })).status, 403);
  assert.equal((await a("POST", `/receipts/${first.id}/reverse`, { reason: "no" })).status, 400);
  assert.equal((await a("POST", `/receipts/${first.id}/reverse`, {})).status, 400);
  const reversed = ok(await a("POST", `/receipts/${first.id}/reverse`, { reason: "Transfer bounced" }));
  assert.deepEqual([reversed.duplicate, reversed.settledMinor, reversed.outstandingMinor], [false, 3500, 4500]);
  const reversedAgain = ok(await a("POST", `/receipts/${first.id}/reverse`, { reason: "Second click" }));
  assert.deepEqual([reversedAgain.duplicate, reversedAgain.settledMinor], [true, 3500]);
  share = (await find(b)).shares.find(item => item.id === owed.id);
  assert.equal(share.settledMinor, 3500);
  assert.equal(share.receipts.length, 3);
  const original = share.receipts.find(item => item.id === first.id);
  assert.deepEqual([original.amountMinor, original.reversalReason, original.reversedBy], [2500, "Transfer bounced", avery.id]);
  assert.ok(original.reversedAt);
  // A reversed entry cannot be received again by replaying its request, and
  // the replay is not reported as a standing repayment either.
  const replayed = await receipt({ amountMinor: 2500, reference: "Bank transfer", requestId });
  assert.equal(replayed.status, 409);
  assert.match(replayed.error, /later reversed/);
  assert.equal((await find()).shares.find(item => item.id === owed.id).settledMinor, 3500);

  // The debtor is told their balance reopened; the payer is not self-notified.
  const notice = (await snapshot(b)).notifications.find(item => item.kind === "receipt-reversed");
  assert.deepEqual([notice.expenseId, notice.amountMinor, notice.detail, notice.senderUserId, notice.title],
    [expense.id, 2500, "Transfer bounced", avery.id, "Acceptance bill"]);
  assert.equal((await snapshot(a)).notifications.some(item => item.kind === "receipt-reversed"), false);
  assert.equal((await snapshot(c)).notifications.some(item => item.kind === "receipt-reversed"), false);
  ok(await b("POST", `/notifications/${notice.id}/read`, {}));

  // History records each entry with its amount.
  const events = (await snapshot(c)).activityEvents.filter(item => item.entityId === expense.id).map(item => item.description);
  assert.ok(events.includes("Repayment of £25.00 recorded"), JSON.stringify(events));
  assert.ok(events.includes("Repayment of £25.00 reversed"));

  // Full confirmation still works and is now one more ledger entry.
  ok(await a("POST", `/shares/${owed.id}/confirm`, {}));
  ok(await a("POST", `/shares/${owed.id}/confirm`, {}));
  share = (await find()).shares.find(item => item.id === owed.id);
  assert.equal(share.settledMinor, 8000);
  assert.ok(share.settledAt);
  assert.equal(share.receipts.filter(item => !item.reversedAt).reduce((sum, item) => sum + item.amountMinor, 0), 8000);
  assert.equal((await receipt({ amountMinor: 1, requestId: randomUUID() })).status, 409);
  assert.equal((await b("POST", `/shares/${owed.id}/confirm`, {})).status, 403);
  assert.equal((await a("POST", `/shares/${own.id}/confirm`, {})).status, 403);

  // A settled member can leave; their receipts can then no longer be reversed.
  const solo = ok(await a("POST", `/communes/${id}/expenses`, {
    title: "Leaver bill", amountMinor: 1000, shares: [{ userId: casey.id, amountMinor: 1000 }],
  }), 201);
  const leaverShare = (await snapshot()).expenses.find(item => item.id === solo.id).shares[0];
  const blocked = await c("POST", `/communes/${id}/members/${casey.id}`, { action: "leave" });
  assert.equal(blocked.status, 409, JSON.stringify(blocked));
  const leaverReceipt = ok(await a("POST", `/shares/${leaverShare.id}/receipts`, { amountMinor: 1000, receivedOn: today, requestId: randomUUID() }), 201);
  console.log("repayment receipts: ok");
  globalThis.lifecycle = { leaverReceiptId: leaverReceipt.id, leaverExpenseId: solo.id };
}

// ------------------------------------------- expense correction and void
{
  const create = ok(await a("POST", `/communes/${id}/expenses`, {
    title: "Groceries", amountMinor: 9000, category: "Groceries", dueOn: past,
    shares: [avery, blake, casey].map(user => ({ userId: user.id, amountMinor: 3000 })),
  }), 201);
  const find = async (call = a, expenseId = create.id) => (await snapshot(call)).expenses.find(item => item.id === expenseId);
  let saved = await find();
  assert.deepEqual([saved.version, saved.voidedAt, saved.revisions.length, saved.recordedBy], [1, null, 0, avery.id]);
  const equal = (amountMinor, people) => people.map(user => ({ userId: user.id, amountMinor: amountMinor / people.length }));
  const change = (patch, call = a, expenseId = create.id) => call("PUT", `/expenses/${expenseId}`, {
    expectedVersion: 1, title: "Groceries", amountMinor: 9000, category: "Groceries", dueOn: past, paidByUserId: avery.id,
    shares: equal(9000, [avery, blake, casey]), reason: "Receipt total was wrong", requestId: randomUUID(), ...patch });

  // Permission: the payer or an admin; not another member or an outsider.
  assert.equal((await change({ amountMinor: 9300, shares: equal(9300, [avery, blake, casey]) }, b)).status, 403);
  assert.equal((await change({ amountMinor: 9300, shares: equal(9300, [avery, blake, casey]) }, outsider)).status, 403);
  // A reason, a real change and a valid split are all required.
  assert.equal((await change({ amountMinor: 9300, shares: equal(9300, [avery, blake, casey]), reason: "no" })).status, 400);
  const unchanged = await change({});
  assert.equal(unchanged.status, 400);
  assert.match(unchanged.error, /Nothing has changed/);
  assert.equal((await change({ amountMinor: 9300 })).status, 400);
  assert.equal((await change({ amountMinor: 9300, shares: equal(9300, [avery, blake, casey]), requestId: undefined })).status, 400);
  assert.equal((await change({ amountMinor: 9300, shares: equal(9300, [avery, blake, casey]), expectedVersion: 0 })).status, 400);
  assert.equal((await find()).version, 1);

  // Correct an unpaid expense: both people see the same new version.
  const requestId = randomUUID();
  const corrected = ok(await change({ amountMinor: 9300, shares: equal(9300, [avery, blake, casey]), requestId }));
  assert.deepEqual([corrected.version, corrected.duplicate], [2, false]);
  const replay = ok(await change({ amountMinor: 9300, shares: equal(9300, [avery, blake, casey]), requestId }));
  assert.deepEqual([replay.version, replay.duplicate], [2, true]);
  // A different change under the same request id is refused, not swallowed.
  assert.equal((await change({ amountMinor: 9900, shares: equal(9900, [avery, blake, casey]), requestId })).status, 400);
  assert.equal((await change({ amountMinor: 9300, shares: equal(9300, [avery, blake, casey]), reason: "Another reason", requestId })).status, 400);
  assert.equal((await find()).amountMinor, 9300);
  for (const call of [a, b, c]) {
    const seen = await find(call);
    assert.deepEqual([seen.version, seen.amountMinor, seen.revisions.length], [2, 9300, 1]);
    assert.deepEqual(seen.shares.map(share => share.amountMinor), [3100, 3100, 3100]);
    assert.deepEqual([seen.revisions[0].action, seen.revisions[0].reason, seen.revisions[0].actorId, seen.revisions[0].version,
      seen.revisions[0].before.amountMinor, seen.revisions[0].after.amountMinor], ["corrected", "Receipt total was wrong", avery.id, 2, 9000, 9300]);
  }
  assert.equal((await find()).shares.find(share => share.userId === avery.id).settledMinor, 3100);
  // A competing stale correction is a conflict, not a silent overwrite.
  const stale = await change({ amountMinor: 9600, shares: equal(9600, [avery, blake, casey]) });
  assert.equal(stale.status, 409);
  assert.match(stale.error, /changed by someone else/);
  // Two corrections from the same version at once: exactly one wins.
  const race = await Promise.all([9600, 9900].map(total => change({ expectedVersion: 2, amountMinor: total, shares: equal(total, [avery, blake, casey]) })));
  assert.deepEqual(race.map(result => result.status).sort(), [200, 409], JSON.stringify(race));
  saved = await find();
  assert.equal(saved.version, 3);
  assert.ok([9600, 9900].includes(saved.amountMinor));
  // Affected members are told; the person who made the change is not.
  const corrections = (await snapshot(b)).notifications.filter(item => item.kind === "expense-corrected" && item.expenseId === create.id);
  assert.equal(corrections.length, 2);
  assert.deepEqual([corrections[0].detail, corrections[0].senderUserId], ["Receipt total was wrong", avery.id]);
  assert.equal((await snapshot(a)).notifications.some(item => item.kind === "expense-corrected"), false);

  // Details that are not money (title, category, due date) are always correctable.
  const renamed = ok(await change({ expectedVersion: 3, title: "Weekly groceries", amountMinor: saved.amountMinor,
    shares: saved.shares.map(share => ({ userId: share.userId, amountMinor: share.amountMinor })) }));
  assert.equal(renamed.version, 4);
  assert.equal((await find()).title, "Weekly groceries");

  // Once a repayment exists, money fields are locked until it is reversed.
  saved = await find();
  const blakeShare = saved.shares.find(share => share.userId === blake.id);
  const paid = ok(await a("POST", `/shares/${blakeShare.id}/receipts`, { amountMinor: 1000, receivedOn: today, requestId: randomUUID() }), 201);
  const current = { expectedVersion: 4, title: "Weekly groceries", amountMinor: saved.amountMinor,
    shares: saved.shares.map(share => ({ userId: share.userId, amountMinor: share.amountMinor })) };
  const locked = await change({ ...current, amountMinor: 12000, shares: equal(12000, [avery, blake, casey]) });
  assert.equal(locked.status, 409);
  assert.match(locked.error, /Reverse them before changing the amount, payer or split/);
  const voidLocked = await a("POST", `/expenses/${create.id}/void`, { expectedVersion: 4, reason: "Entered twice", requestId: randomUUID() });
  assert.equal(voidLocked.status, 409);
  assert.match(voidLocked.error, /bill payer needs to reverse them before it can be voided/);
  assert.equal(ok(await change({ ...current, dueOn: today })).version, 5);
  assert.equal((await find()).shares.find(share => share.id === blakeShare.id).settledMinor, 1000);

  // After an explicit reversal the split can change, but a person with
  // repayment history cannot silently disappear from it.
  ok(await a("POST", `/receipts/${paid.id}/reverse`, { reason: "Recorded on the wrong bill" }));
  const dropped = await change({ ...current, expectedVersion: 5, dueOn: today, shares: equal(saved.amountMinor, [avery, casey]) });
  assert.equal(dropped.status, 409);
  assert.match(dropped.error, /Blake Debtor has repayment history/);
  // Only an admin may change who paid; a member payer cannot hand the bill on.
  const blakeBill = ok(await b("POST", `/communes/${id}/expenses`, { title: "Taxi", amountMinor: 2000,
    shares: [{ userId: blake.id, amountMinor: 1000 }, { userId: casey.id, amountMinor: 1000 }] }), 201);
  const taxi = { expectedVersion: 1, title: "Taxi", amountMinor: 2000, category: "Other", dueOn: null,
    shares: [{ userId: blake.id, amountMinor: 1000 }, { userId: casey.id, amountMinor: 1000 }], reason: "Casey paid, not me", requestId: randomUUID() };
  assert.equal((await b("PUT", `/expenses/${blakeBill.id}`, { ...taxi, paidByUserId: casey.id })).status, 403);
  // The payer can correct their own bill; an admin can reassign the payer.
  assert.equal(ok(await b("PUT", `/expenses/${blakeBill.id}`, { ...taxi, paidByUserId: blake.id, title: "Taxi home", reason: "Clearer name" })).version, 2);
  assert.equal(ok(await a("PUT", `/expenses/${blakeBill.id}`, { ...taxi, expectedVersion: 2, title: "Taxi home", paidByUserId: casey.id, requestId: randomUUID() })).version, 3);
  const reassigned = await find(a, blakeBill.id);
  assert.equal(reassigned.paidByUserId, casey.id);
  assert.deepEqual(reassigned.shares.map(share => [share.userId === casey.id, share.settledMinor]).sort(), [[false, 0], [true, 1000]]);
  // The balance moved with the payer: Blake now owes Casey, and Casey can confirm.
  assert.equal((await b("POST", `/shares/${reassigned.shares.find(share => share.userId === blake.id).id}/receipts`, { amountMinor: 1000, receivedOn: today, requestId: randomUUID() })).status, 403);
  ok(await c("POST", `/shares/${reassigned.shares.find(share => share.userId === blake.id).id}/receipts`, { amountMinor: 1000, receivedOn: today, requestId: randomUUID() }), 201);

  // Void: reason and version required; history kept; nothing is deleted.
  assert.equal((await b("POST", `/expenses/${create.id}/void`, { expectedVersion: 5, reason: "Not allowed", requestId: randomUUID() })).status, 403);
  assert.equal((await a("POST", `/expenses/${create.id}/void`, { expectedVersion: 5, reason: "", requestId: randomUUID() })).status, 400);
  assert.equal((await a("POST", `/expenses/${create.id}/void`, { expectedVersion: 4, reason: "Entered twice", requestId: randomUUID() })).status, 409);
  const due = (await snapshot()).reminderTargets.filter(target => target.label === "Weekly groceries");
  assert.equal(due.length, 2);
  const voidId = randomUUID();
  const voided = ok(await a("POST", `/expenses/${create.id}/void`, { expectedVersion: 5, reason: "Entered twice", requestId: voidId }));
  assert.deepEqual([voided.version, voided.duplicate], [6, false]);
  assert.equal(ok(await a("POST", `/expenses/${create.id}/void`, { expectedVersion: 5, reason: "Entered twice", requestId: voidId })).duplicate, true);
  assert.equal((await a("POST", `/expenses/${create.id}/void`, { expectedVersion: 5, reason: "A different reason", requestId: voidId })).status, 400);
  assert.equal((await a("POST", `/expenses/${create.id}/void`, { expectedVersion: 6, reason: "Again", requestId: randomUUID() })).status, 409);
  saved = await find(c);
  assert.ok(saved.voidedAt);
  assert.deepEqual([saved.version, saved.voidedBy, saved.voidReason, saved.revisions[0].action, saved.shares.length], [6, avery.id, "Entered twice", "voided", 3]);
  assert.equal(saved.shares.find(share => share.id === blakeShare.id).receipts.length, 1);
  // A voided expense cannot be changed, repaid, reminded or searched as open.
  assert.equal((await change({ ...current, expectedVersion: 6, title: "Back again" })).status, 409);
  assert.equal((await a("POST", `/shares/${blakeShare.id}/receipts`, { amountMinor: 100, receivedOn: today, requestId: randomUUID() })).status, 409);
  assert.equal((await a("POST", `/receipts/${paid.id}/reverse`, { reason: "After void" })).duplicate, true);
  assert.equal((await snapshot()).reminderTargets.some(target => target.label === "Weekly groceries"), false);
  const caseyShare = saved.shares.find(share => share.userId === casey.id);
  const voidedNudge = await a("POST", "/reminders", { kind: "nudge", sourceId: caseyShare.id, requestId: randomUUID() });
  assert.equal(voidedNudge.status, 409);
  assert.match(voidedNudge.error, /voided/);
  const found = ok(await a("GET", `/search?q=${encodeURIComponent("Weekly groceries")}&commune=${id}`));
  assert.equal(found.items.find(item => item.kind === "expense" && item.id === create.id).meta, "Voided");
  assert.ok((await snapshot(b)).notifications.some(item => item.kind === "expense-voided" && item.expenseId === create.id && item.detail === "Entered twice"));
  const events = (await snapshot(c)).activityEvents.filter(item => item.entityId === create.id).map(item => item.description);
  assert.ok(events.includes("Expense corrected") && events.includes("Expense voided"), JSON.stringify(events));
  console.log("expense correction and void: ok");
}

// -------------------------------- reminders racing receipts, corrections, void
{
  // Reminders lock the obligation; receipts, corrections and voids lock the
  // commune first. Run them against each other: every request must end in a
  // decision (2xx, or a 4xx such as the daily reminder limit), never a
  // deadlock or server error, and a voided bill must never stay remindable.
  const bills = [];
  for (let index = 0; index < 8; index += 1) {
    const bill = ok(await a("POST", `/communes/${id}/expenses`, { title: `Race bill ${index}`, amountMinor: 2000, dueOn: past,
      shares: [{ userId: avery.id, amountMinor: 1000 }, { userId: blake.id, amountMinor: 1000 }] }), 201);
    bills.push(bill.id);
  }
  const before = (await snapshot()).expenses.filter(item => bills.includes(item.id));
  const results = (await Promise.all(before.flatMap((expense, index) => {
    const share = expense.shares.find(item => item.userId === blake.id);
    const nudge = a("POST", "/reminders", { kind: "nudge", sourceId: share.id, requestId: randomUUID() });
    const other = index % 2
      ? a("POST", `/expenses/${expense.id}/void`, { expectedVersion: 1, reason: "Race test void", requestId: randomUUID() })
      : a("POST", `/shares/${share.id}/receipts`, { amountMinor: 400, receivedOn: today, requestId: randomUUID() });
    return [nudge, other];
  })));
  assert.equal(results.filter(result => result.status >= 500).length, 0, JSON.stringify(results.filter(result => result.status >= 500)));
  const after = await snapshot();
  const voided = after.expenses.filter(item => bills.includes(item.id) && item.voidedAt);
  const voidedIds = voided.map(item => item.id);
  assert.equal(voidedIds.length, 4);
  const voidedTitles = new Set(voided.map(item => item.title));
  assert.equal(after.reminderTargets.some(target => voidedTitles.has(target.label)), false);
  for (const expense of after.expenses.filter(item => voidedIds.includes(item.id))) {
    const share = expense.shares.find(item => item.userId === blake.id);
    assert.equal((await a("POST", "/reminders", { kind: "nudge", sourceId: share.id, requestId: randomUUID() })).status, 409);
  }
  // Settle what the race left open so the leaving-member checks below start clean.
  for (const expense of after.expenses.filter(item => bills.includes(item.id) && !item.voidedAt)) {
    ok(await a("POST", `/shares/${expense.shares.find(item => item.userId === blake.id).id}/confirm`, {}));
  }
  console.log("reminder, receipt and void races: ok");
}

// --------------------------------------- former members and reopened debt
{
  // A voided bill never blocks leaving; a real outstanding share does.
  let snap = await snapshot();
  for (const expense of snap.expenses.filter(item => !item.voidedAt && item.paidByUserId === avery.id)) {
    for (const share of expense.shares.filter(item => item.userId === casey.id && item.settledMinor < item.amountMinor)) {
      ok(await a("POST", `/shares/${share.id}/confirm`, {}));
    }
  }
  ok(await c("POST", `/communes/${id}/members/${casey.id}`, { action: "leave" }));
  assert.equal((await c("GET", `/communes/${id}/snapshot`)).status, 404);
  // Reversing would reopen a debt for someone who can no longer see or settle it.
  const reopened = await a("POST", `/receipts/${globalThis.lifecycle.leaverReceiptId}/reverse`, { reason: "Changed my mind" });
  assert.equal(reopened.status, 409);
  assert.match(reopened.error, /former member/);
  // Their history stays readable, and a split cannot be rewritten onto them.
  snap = await snapshot();
  const leaverBill = snap.expenses.find(item => item.id === globalThis.lifecycle.leaverExpenseId);
  assert.equal(leaverBill.shares[0].receipts.length, 1);
  assert.equal(snap.members.find(member => member.userId === casey.id).active, false);
  const rewrite = await a("PUT", `/expenses/${leaverBill.id}`, { expectedVersion: leaverBill.version, title: leaverBill.title, amountMinor: 2000,
    category: "Other", dueOn: null, paidByUserId: avery.id, shares: [{ userId: casey.id, amountMinor: 2000 }], reason: "Should have been more", requestId: randomUUID() });
  assert.equal(rewrite.status, 409);
  // A void is the way out: it closes the repayment that can no longer be
  // reversed, keeping it in the history with the reason, and reopens nothing.
  const voided = ok(await a("POST", `/expenses/${leaverBill.id}/void`, { expectedVersion: leaverBill.version, reason: "Recorded twice", requestId: randomUUID() }));
  assert.equal(voided.duplicate, false);
  snap = await snapshot();
  const closed = snap.expenses.find(item => item.id === leaverBill.id);
  assert.ok(closed.voidedAt);
  assert.equal(closed.shares[0].receipts.length, 1);
  assert.equal(closed.shares[0].receipts[0].reversalReason, "Expense voided: Recorded twice");
  assert.equal(closed.shares[0].settledMinor, 0);
  // Nothing shows as owed by the former member on a voided bill.
  assert.equal(snap.reminderTargets.some(target => target.recipientUserId === casey.id), false);
  console.log("former member protection: ok");
}

// ------------------------------------------------ cross-commune reminder cooldown
{
  // The one-day sender-to-recipient limit applies across communes, and the
  // allowance read reports it so the UI can explain it before Send.
  const other = ok(await a("POST", "/communes", { name: `Lifecycle other ${suffix}`, kind: "household", currency: "GBP" }), 201).id;
  const invite = ok(await a("POST", `/communes/${other}/invites`, { email: blake.email, role: "member" }), 201);
  ok(await b("POST", `/invites/${invite.token}/accept`, {}));
  const usage = ok(await a("GET", "/reminders/usage"));
  assert.ok(usage.recipientLastSent[blake.id], JSON.stringify(usage));
  const bill = ok(await a("POST", `/communes/${other}/expenses`, { title: "Other bill", amountMinor: 1000, dueOn: past,
    shares: [{ userId: avery.id, amountMinor: 500 }, { userId: blake.id, amountMinor: 500 }] }), 201);
  const share = ok(await a("GET", `/communes/${other}/snapshot`)).expenses.find(item => item.id === bill.id).shares.find(item => item.userId === blake.id);
  const refused = await a("POST", "/reminders", { kind: "nudge", sourceId: share.id, requestId: randomUUID() });
  assert.equal(refused.status, 409);
  assert.match(refused.error, /already reminded in the last day/);
  console.log("cross-commune cooldown: ok");
}

console.log(`money lifecycle integration passed (${base})`);
