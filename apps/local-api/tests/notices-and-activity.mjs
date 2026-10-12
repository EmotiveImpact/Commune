import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

// Unread notices across communes, activity record types and the pending
// payment reports an overview summary keeps (0039). Creates accounts and
// communes, so it refuses the normal application API.
const base = process.env.API_BASE;
if (!base) throw new Error("Set API_BASE to an isolated local test API, not the user's database.");
const url = new URL(base);
if (url.protocol !== "http:" || !["127.0.0.1", "localhost"].includes(url.hostname) || !url.port ||
    url.port === "3002" || url.pathname !== "/" || url.search || url.hash || url.username || url.password) {
  throw new Error("Notice and activity tests require an isolated loopback API port (not 3002).");
}
// Letters only, so a commune name that carries it never holds a phone-like run of digits.
const suffix = randomUUID().slice(0, 8).replace(/[0-9]/g, (digit) => "ghijklmnop"[digit]);
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
async function signup(call, name, slug) {
  return ok(await call("POST", "/auth/signup", { name, email: `${slug}-${suffix}@example.test`,
    password: "DisposableNoticeFixture-2026!" }), 201).user;
}
const a = session(), b = session(), outsider = session(), guest = session();
const avery = await signup(a, "Avery Notices", "notices-avery");
const blake = await signup(b, "Blake Notices", "notices-blake");
await signup(outsider, "Casey Notices", "notices-casey");
async function commune(call, name, currency, member, memberCall) {
  const id = ok(await call("POST", "/communes", { name, kind: "household", currency }), 201).id;
  const invite = ok(await call("POST", `/communes/${id}/invites`, { email: member.email, role: "member" }), 201);
  ok(await memberCall("POST", `/invites/${invite.token}/accept`, {}));
  return id;
}
// Avery's home, with Blake, and Blake's trip, with Avery.
const home = await commune(a, `Home ${suffix}`, "GBP", blake, b);
const trip = await commune(b, `Trip ${suffix}`, "EUR", avery, a);
const today = new Date().toISOString().slice(0, 10);
const snapshot = async (call, id) => ok(await call("GET", `/communes/${id}/snapshot`));
const counts = async (call) => Object.fromEntries((ok(await call("GET", "/communes")).communes)
  .filter((item) => [home, trip].includes(item.id)).map((item) => [item.id, item.unreadNotices]));
assert.deepEqual(await counts(a), { [home]: 0, [trip]: 0 });
assert.deepEqual(ok(await a("GET", "/notices/unread")).notices, []);

// Home: Blake says he has sent his share of the gas, which Avery has to confirm.
const gas = ok(await a("POST", `/communes/${home}/expenses`, { title: "Gas", amountMinor: 3000,
  shares: [{ userId: avery.id, amountMinor: 1500 }, { userId: blake.id, amountMinor: 1500 }], requestId: randomUUID() }), 201).id;
const gasShare = (await snapshot(b, home)).expenses.find((item) => item.id === gas).shares.find((item) => item.userId === blake.id);
const report = ok(await b("POST", `/shares/${gasShare.id}/payment-reports`,
  { amountMinor: 1500, sentOn: today, reference: "Bank transfer", requestId: randomUUID() }), 201);
// Trip: Blake nudges Avery about her share of the ferry.
const ferry = ok(await b("POST", `/communes/${trip}/expenses`, { title: "Ferry", amountMinor: 4000, dueOn: today,
  shares: [{ userId: avery.id, amountMinor: 2000 }, { userId: blake.id, amountMinor: 2000 }], requestId: randomUUID() }), 201).id;
const ferryShare = (await snapshot(b, trip)).expenses.find((item) => item.id === ferry).shares.find((item) => item.userId === avery.id);
ok(await b("POST", "/reminders", { kind: "nudge", sourceId: ferryShare.id, requestId: randomUUID() }), 201);
// Home again: Avery moves Blake's pledge to a later date, which tells Blake.
const fund = ok(await a("POST", `/communes/${home}/funds`, { name: "Boiler", targetMinor: 50000, requestId: randomUUID() }), 201).id;
const inDays = (days) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
const pledge = ok(await b("POST", `/funds/${fund}/pledges`, { amountMinor: 10000, dueOn: inDays(30), requestId: randomUUID() }), 201).id;
ok(await a("PATCH", `/commitments/${pledge}`, { amountMinor: 10000, dueOn: inDays(60), expectedAmountMinor: 10000, expectedDueOn: inDays(30) }));

// ------------------------------------------------------------ counts
// Each commune in the list carries the reader's own unread count, as does the snapshot.
assert.deepEqual(await counts(a), { [home]: 1, [trip]: 1 });
assert.deepEqual(await counts(b), { [home]: 1, [trip]: 0 });
assert.equal((await snapshot(a, trip)).commune.unreadNotices, 1);
assert.equal(ok(await a("GET", `/communes/${home}/snapshot?detail=summary`)).commune.unreadNotices, 1);

// ------------------------------------------------------------ every commune's unread notices
const averys = ok(await a("GET", "/notices/unread")).notices;
assert.deepEqual(averys.map((item) => [item.communeId, item.kind, item.senderName, item.fundId]),
  [[trip, "nudge", "Blake Notices", null], [home, "payment-reported", "Blake Notices", null]]);
// Each is the snapshot's notice with the sender's name and a pledge notice's fund.
const { senderName, fundId, ...nudge } = averys[0];
assert.deepEqual(nudge, (await snapshot(a, trip)).notifications[0]);
const blakes = ok(await b("GET", "/notices/unread")).notices;
assert.deepEqual(blakes.map((item) => [item.communeId, item.kind, item.senderName, item.fundId]),
  [[home, "pledge-changed", "Avery Notices", fund]]);
assert.deepEqual(ok(await outsider("GET", "/notices/unread")).notices, []);
assert.equal((await guest("GET", "/notices/unread")).status, 401);

// Reading one changes only its own commune.
ok(await a("POST", `/notifications/${averys[0].id}/read`, {}));
assert.deepEqual(await counts(a), { [home]: 1, [trip]: 0 });
assert.deepEqual(ok(await a("GET", "/notices/unread")).notices.map((item) => item.id), [averys[1].id]);

// ------------------------------------------------------------ record types
// Each activity event names the kind of record it is about.
const events = (await snapshot(a, home)).activityEvents;
assert.ok(events.every((event) => typeof event.recordType === "string"), JSON.stringify(events));
const types = Object.fromEntries(events.map((event) => [`${event.title}: ${event.description}`, event.recordType]));
assert.deepEqual([types["Boiler: Created"], types["Boiler: Pledge made"], types["Boiler: Pledge updated"],
  types["Blake Notices: Joined the commune"]], ["fund", "pledge", "pledge", "member"], JSON.stringify(types));

// ------------------------------------------------------------ the summary keeps a pending report
const reportsIn = (body) => body.expenses.find((item) => item.id === gas).shares
  .find((item) => item.userId === blake.id).paymentReports.map((item) => [item.id, item.status]);
assert.deepEqual(reportsIn(ok(await a("GET", `/communes/${home}/snapshot?detail=summary`))), [[report.id, "pending"]]);
ok(await a("POST", `/payment-reports/${report.id}/resolve`, { decision: "confirm", requestId: randomUUID() }));
assert.deepEqual(reportsIn(ok(await a("GET", `/communes/${home}/snapshot?detail=summary`))), []);
assert.deepEqual(reportsIn(await snapshot(a, home)), [[report.id, "confirmed"]]);
// Confirming it records a repayment, named as one.
const repaid = (await snapshot(a, home)).activityEvents.filter((event) => event.title === "Gas");
assert.deepEqual(repaid.map((event) => event.recordType), ["repayment"], JSON.stringify(repaid));
console.log("Notices and activity: counts, notices across communes, record types and pending reports behave as expected.");
