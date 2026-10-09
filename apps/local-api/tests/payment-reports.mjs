import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

// "I've sent it" reports: a claim by the member who owes, answered by the
// bill payer. Creates accounts and records, so it refuses the normal API.
const base = process.env.API_BASE;
if (!base) throw new Error("Set API_BASE to an isolated local test API, not the user's database.");
const url = new URL(base);
if (url.protocol !== "http:" || !["127.0.0.1", "localhost"].includes(url.hostname) || !url.port ||
    url.port === "3002" || url.pathname !== "/" || url.search || url.hash || url.username || url.password) {
  throw new Error("Payment report tests require an isolated loopback API port (not 3002).");
}
// Letters only, so a commune name that carries it never holds a phone-like run of digits.
const suffix = randomUUID().slice(0, 8).replace(/[0-9]/g, (digit) => "ghijklmnop"[digit]);
const password = "DisposableReportFixture-2026!";
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
    return { ...data, reportStatus: data.status, status: response.status };
  };
}
const ok = (result, status = 200) => { assert.equal(result.status, status, JSON.stringify(result)); return result; };
const a = session(), b = session(), c = session(), outsider = session();
const users = [];
for (const [index, call] of [a, b, c, outsider].entries()) {
  users.push(ok(await call("POST", "/auth/signup", {
    name: ["Avery Payer", "Blake Debtor", "Casey Member", "Outsider"][index],
    email: `reports-${index}-${suffix}@example.test`, password,
  }), 201).user);
}
const [avery, blake, casey] = users;
const id = ok(await a("POST", "/communes", { name: `Reports ${suffix}`, kind: "household", currency: "GBP" }), 201).id;
for (const [user, call] of [[blake, b], [casey, c]]) {
  const invite = ok(await a("POST", `/communes/${id}/invites`, { email: user.email, role: "member" }), 201);
  ok(await call("POST", `/invites/${invite.token}/accept`, {}));
}
const today = new Date().toISOString().slice(0, 10);
const snapshot = async (call = a) => ok(await call("GET", `/communes/${id}/snapshot`));
const shareOf = async (expenseId, userId, call = a) =>
  (await snapshot(call)).expenses.find(item => item.id === expenseId).shares.find(item => item.userId === userId);
const report = (call, shareId, extra = {}) => call("POST", `/shares/${shareId}/payment-reports`,
  { amountMinor: 2000, sentOn: today, reference: "Bank transfer", requestId: randomUUID(), ...extra });

const expense = ok(await a("POST", `/communes/${id}/expenses`, {
  title: "Electricity", amountMinor: 6000,
  shares: [{ userId: avery.id, amountMinor: 2000 }, { userId: blake.id, amountMinor: 2000 }, { userId: casey.id, amountMinor: 2000 }],
}), 201).id;
const blakeShare = await shareOf(expense, blake.id);
const caseyShare = await shareOf(expense, casey.id);
const payerShare = await shareOf(expense, avery.id);

// ------------------------------------------------ who may report, and what
assert.equal((await report(a, blakeShare.id)).status, 403, "the payer cannot report for the debtor");
assert.equal((await report(c, blakeShare.id)).status, 403, "another member cannot report for the debtor");
assert.equal((await report(outsider, blakeShare.id)).status, 403);
assert.equal((await report(a, payerShare.id)).status, 400, "the payer's own share is not a repayment");
assert.equal((await report(b, blakeShare.id, { amountMinor: 2001 })).status, 409);
assert.equal((await report(b, blakeShare.id, { amountMinor: 0 })).status, 400);
assert.equal((await report(b, blakeShare.id, { reference: "Card 4111 1111 1111 1111" })).status, 400);
assert.equal((await report(b, blakeShare.id, { sentOn: "2099-01-01" })).status, 400);

// A report is a claim: nothing settles until the payer answers.
const requestId = randomUUID();
const first = ok(await report(b, blakeShare.id, { amountMinor: 1500, requestId }), 201);
assert.deepEqual([first.duplicate, first.reportStatus, first.settledMinor, first.outstandingMinor], [false, "pending", 0, 2000]);
const again = ok(await report(b, blakeShare.id, { amountMinor: 1500, requestId }), 200);
assert.deepEqual([again.id, again.duplicate], [first.id, true]);
assert.equal((await report(b, blakeShare.id, { amountMinor: 1600, requestId })).status, 400, "a reused request id with a different payload");
const second = await report(b, blakeShare.id, { amountMinor: 500 });
assert.equal(second.status, 409);
assert.match(second.error, /already reported £15\.00/);
let share = await shareOf(expense, blake.id, b);
assert.deepEqual([share.settledMinor, share.paymentReports.length, share.paymentReports[0].status, share.paymentReports[0].reference],
  [0, 1, "pending", "Bank transfer"]);
// The payer is told in Commune, and nobody else is.
const payerNotice = (await snapshot(a)).notifications.find(item => item.kind === "payment-reported");
assert.deepEqual([payerNotice?.amountMinor, payerNotice?.senderUserId, payerNotice?.detail], [1500, blake.id, "Bank transfer"]);
assert.equal((await snapshot(c)).notifications.some(item => item.kind === "payment-reported"), false);

// ------------------------------------------------------- decline, withdraw
const resolve = (call, reportId, decision, extra = {}) => call("POST", `/payment-reports/${reportId}/resolve`,
  { decision, requestId: randomUUID(), ...extra });
assert.equal((await resolve(b, first.id, "confirm")).status, 403, "the reporter cannot confirm their own report");
assert.equal((await resolve(c, first.id, "decline", { note: "No idea" })).status, 403);
assert.equal((await resolve(a, first.id, "decline", { note: "no" })).status, 400, "a decline needs a reason");
const declined = ok(await resolve(a, first.id, "decline", { note: "Nothing has arrived yet" }));
assert.deepEqual([declined.reportStatus, declined.outstandingMinor], ["declined", 2000]);
assert.equal(ok(await resolve(a, first.id, "decline", { note: "Nothing has arrived yet" })).duplicate, true);
assert.equal((await resolve(a, first.id, "confirm")).status, 409, "an answered report cannot be confirmed");
const declineNotice = (await snapshot(b)).notifications.find(item => item.kind === "payment-declined");
assert.equal(declineNotice?.detail, "Nothing has arrived yet");

const mistaken = ok(await report(b, blakeShare.id, { amountMinor: 700 }), 201);
assert.equal((await b("POST", `/payment-reports/${mistaken.id}/withdraw`, {})).status, 200);
assert.equal(ok(await b("POST", `/payment-reports/${mistaken.id}/withdraw`, {})).duplicate, true);
assert.equal((await a("POST", `/payment-reports/${mistaken.id}/withdraw`, {})).status, 403);
assert.equal((await resolve(a, mistaken.id, "confirm")).status, 409, "a withdrawn report cannot be confirmed");

// ------------------------------------------- confirm records a real receipt
const sent = ok(await report(b, blakeShare.id, { amountMinor: 1200, reference: "Monzo" }), 201);
const confirmId = randomUUID();
const confirmed = ok(await resolve(a, sent.id, "confirm", { requestId: confirmId }));
assert.deepEqual([confirmed.reportStatus, confirmed.settledMinor, confirmed.outstandingMinor], ["confirmed", 1200, 800]);
assert.equal(ok(await resolve(a, sent.id, "confirm", { requestId: confirmId })).duplicate, true);
share = await shareOf(expense, blake.id);
const receipt = share.receipts.find(item => item.id === confirmed.receiptId);
assert.deepEqual([receipt.amountMinor, receipt.receivedOn, receipt.reference, receipt.recordedBy], [1200, today, "Monzo", avery.id]);
assert.equal((await snapshot(b)).notifications.some(item => item.kind === "payment-confirmed" && item.amountMinor === 1200), true);
// Reversing that receipt is the ordinary reversal; the report keeps its link.
ok(await a("POST", `/receipts/${receipt.id}/reverse`, { reason: "The transfer bounced" }));
share = await shareOf(expense, blake.id);
assert.deepEqual([share.settledMinor, share.paymentReports.find(item => item.id === sent.id).status], [0, "confirmed"]);

// ------------------------------- pending reports close when nothing is left
{
  const pending = ok(await report(c, caseyShare.id, { amountMinor: 2000 }), 201);
  // The payer records the full amount directly instead of confirming.
  ok(await a("POST", `/shares/${caseyShare.id}/receipts`, { amountMinor: 2000, receivedOn: today, reference: "Cash", requestId: randomUUID() }), 201);
  const closed = (await shareOf(expense, casey.id)).paymentReports.find(item => item.id === pending.id);
  assert.deepEqual([closed.status, closed.note], ["closed", "Share settled"]);
  assert.equal((await report(c, caseyShare.id, { amountMinor: 100 })).status, 409, "a settled share takes no reports");

  const other = ok(await a("POST", `/communes/${id}/expenses`, {
    title: "Takeaway", amountMinor: 3000,
    shares: [{ userId: avery.id, amountMinor: 1500 }, { userId: blake.id, amountMinor: 1500 }],
  }), 201).id;
  const otherShare = await shareOf(other, blake.id);
  const onVoid = ok(await report(b, otherShare.id, { amountMinor: 1500 }), 201);
  const version = (await snapshot()).expenses.find(item => item.id === other).version;
  ok(await a("POST", `/expenses/${other}/void`, { expectedVersion: version, reason: "Entered twice", requestId: randomUUID() }));
  const afterVoid = (await shareOf(other, blake.id)).paymentReports.find(item => item.id === onVoid.id);
  assert.deepEqual([afterVoid.status, afterVoid.note], ["closed", "Expense voided"]);
  assert.equal((await report(b, otherShare.id, { amountMinor: 100 })).status, 409);
}

// ------------------------------------- two answers at once: exactly one wins
{
  const race = ok(await report(b, blakeShare.id, { amountMinor: 800 }), 201);
  const answers = await Promise.all([
    resolve(a, race.id, "confirm"), resolve(a, race.id, "decline", { note: "Not yet" }), resolve(a, race.id, "confirm"),
    b("POST", `/payment-reports/${race.id}/withdraw`, {}),
  ]);
  assert.ok(answers.every(item => item.status === 200 || item.status === 409), JSON.stringify(answers.map(item => item.status)));
  assert.equal(answers.filter(item => item.status === 200 && !item.duplicate).length, 1, JSON.stringify(answers));
  const share = await shareOf(expense, blake.id);
  const final = share.paymentReports.find(item => item.id === race.id);
  assert.ok(["confirmed", "declined", "withdrawn"].includes(final.status), JSON.stringify(answers));
  // Only a confirmation moves money, and only once.
  assert.equal(share.settledMinor, final.status === "confirmed" ? 800 : 0);
  assert.equal(share.receipts.filter(item => !item.reversedAt).length, final.status === "confirmed" ? 1 : 0);
}
console.log(`payment report integration passed (${base})`);
