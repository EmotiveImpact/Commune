import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

const base = process.env.API_BASE;
if (!base) throw new Error("Set API_BASE to an isolated local test API, not the user's database.");
const baseUrl = new URL(base);
if (baseUrl.protocol !== "http:" ||
    !["127.0.0.1", "localhost"].includes(baseUrl.hostname) ||
    !Number.isInteger(Number(baseUrl.port)) || Number(baseUrl.port) < 1024 ||
    Number(baseUrl.port) > 65535 || baseUrl.port === "3002" || baseUrl.pathname !== "/" ||
    baseUrl.search || baseUrl.hash || baseUrl.username || baseUrl.password) {
  throw new Error("Smoke tests require an isolated loopback API port (not 3002)");
}
// Letters only, so a commune name that carries it never holds a phone-like run of digits.
const suffix = randomUUID().slice(0, 8).replace(/[0-9]/g, (digit) => "ghijklmnop"[digit]);
const password = "LocalSmokePassword-2026!";

function session() {
  let cookie = "";
  return async (method, path, input) => {
    const response = await fetch(`${base}/api${path}`, {
      method,
      headers: {
        ...(input === undefined ? {} : { "Content-Type": "application/json" }),
        ...(cookie ? { Cookie: cookie } : {}),
      },
      body: input === undefined ? undefined : JSON.stringify(input),
    });
    const setCookie = response.headers.get("set-cookie");
    if (setCookie) cookie = setCookie.split(";")[0];
    const value = await response.json();
    return { status: response.status, ...value };
  };
}

const a = session();
const b = session();
const d = session();
const outsider = session();
const noCookie = session();
const addressA = `commune-smoke-a-${suffix}@example.test`;
const addressB = `commune-smoke-b-${suffix}@example.test`;
const addressC = `commune-smoke-c-${suffix}@example.test`;
const addressD = `commune-smoke-d-${suffix}@example.test`;

assert.equal((await noCookie("GET", "/communes")).status, 401);
assert.equal((await noCookie("GET", "/reminders/usage")).status, 401);

const userA = await a("POST", "/auth/signup", {
  name: "API Alice", email: addressA, password,
});
const userB = await b("POST", "/auth/signup", {
  name: "API Bob", email: addressB, password,
});
const userC = await outsider("POST", "/auth/signup", {
  name: "API Charlie", email: addressC, password,
});
const userD = await d("POST", "/auth/signup", {
  name: "API Dana", email: addressD, password,
});
assert.equal(userA.status, 201, JSON.stringify(userA));
assert.equal(userB.status, 201, JSON.stringify(userB));
assert.equal(userC.status, 201, JSON.stringify(userC));
assert.equal(userD.status, 201, JSON.stringify(userD));
assert.equal((await a("GET", "/auth/me")).user.email, addressA);
assert.deepEqual(await a("GET", "/reminders/usage"), {
  status: 200, totalUsed: 0, totalLimit: 60, recipientLimit: 8,
  recipientUsage: {}, nextSlotAt: null, recipientLastSent: {},
});
assert.equal((await b("GET", "/auth/me")).user.emailVerified, true);
assert.equal((await a("GET", "/preferences")).emailReminders, true);
assert.equal((await a("PUT", "/preferences", { emailReminders: false })).emailReminders, false);
assert.equal((await a("GET", "/preferences")).emailReminders, false);

const created = await a("POST", "/communes", {
  name: `Local test ${suffix}`, kind: "household", currency: "GBP",
  address: "14 Park Street, London",
});
assert.equal(created.status, 201, JSON.stringify(created));
const id = created.id;
assert.equal((await b("GET", `/communes/${id}/snapshot`)).status, 404);
assert.equal((await outsider("POST", `/communes/${id}/funds`, {
  name: "Outsider fund", targetMinor: 100,
})).status, 403);

const invite = await a("POST", `/communes/${id}/invites`, {
  email: addressB, role: "member",
});
assert.equal(invite.status, 201, JSON.stringify(invite));
assert.match(invite.token, /^[0-9a-f]{64}$/);
assert.equal((await outsider("GET", `/invites/${invite.token}`)).invite, null);
assert.equal((await outsider("POST", `/invites/${invite.token}/accept`, {})).status, 403);
assert.equal((await b("GET", `/invites/${invite.token}`)).invite.communeName,
  `Local test ${suffix}`);
assert.equal((await b("POST", `/invites/${invite.token}/accept`, {})).communeId, id);
assert.equal((await b("POST", `/invites/${invite.token}/accept`, {})).status, 403);
const inviteD = await a("POST", `/communes/${id}/invites`, {
  email: addressD, role: "member",
});
assert.equal((await d("POST", `/invites/${inviteD.token}/accept`, {})).communeId, id);

let snap = await a("GET", `/communes/${id}/snapshot`);
assert.equal(snap.status, 200, JSON.stringify(snap));
assert.equal(snap.commune.address, "14 Park Street, London");
assert.equal(snap.commune.destination, "");
assert.equal((await a("GET", "/communes")).communes[0].address,
  "14 Park Street, London");
assert.deepEqual(snap.members.map((member) => member.email).sort(),
  [addressA, addressB, addressD].sort());
assert.equal((await outsider("GET", `/communes/${id}/snapshot`)).status, 404);
assert.equal((await a("PATCH", `/communes/${id}`, {
  name: "X".repeat(49), kind: "household", currency: "GBP",
})).status, 400);
const revised = { name: `Updated ${suffix}`, kind: "workspace", currency: "USD" };
assert.equal((await b("PATCH", `/communes/${id}`, {
  ...revised, address: "An unauthorized address",
})).status, 403);
assert.equal((await a("PATCH", `/communes/${id}`, revised)).status, 200);
snap = await b("GET", `/communes/${id}/snapshot`);
assert.equal(snap.commune.name, revised.name);
assert.equal(snap.commune.kind, "workspace");
assert.equal(snap.commune.currency, "USD");
assert.equal(snap.commune.address, "14 Park Street, London",
  "omitted location fields must retain their values");
assert.equal((await a("PATCH", `/communes/${id}`, {
  ...revised, address: "X".repeat(161),
})).status, 400);
assert.equal((await a("PATCH", `/communes/${id}`, {
  ...revised, destination: "Lisbon",
})).status, 400, "workspace cannot have trip-only location fields");
assert.equal((await a("GET", `/communes/${id}/snapshot`)).commune.address,
  "14 Park Street, London", "invalid updates must roll back");
assert.equal((await a("PATCH", `/communes/${id}`, {
  name: `Local test ${suffix}`, kind: "household", currency: "GBP",
})).status, 200);
const dueOn = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
const badSplit = await a("POST", `/communes/${id}/expenses`, {
  title: "Bad split", amountMinor: 1000, dueOn,
  shares: [{ userId: userA.user.id, amountMinor: 900 }],
});
assert.equal(badSplit.status, 400);
assert.equal((await a("POST", `/communes/${id}/expenses`, {
  title: "X".repeat(81), amountMinor: 1000, dueOn,
  shares: [
    { userId: userA.user.id, amountMinor: 500 },
    { userId: userB.user.id, amountMinor: 500 },
  ],
})).status, 400, "long expense names should be rejected at the API");
const expense = await a("POST", `/communes/${id}/expenses`, {
  title: "Shared groceries", amountMinor: 1000, dueOn,
  shares: [
    { userId: userA.user.id, amountMinor: 500 },
    { userId: userB.user.id, amountMinor: 500 },
  ],
});
assert.equal(expense.status, 201, JSON.stringify(expense));
assert.equal((await a("PATCH", `/communes/${id}`, {
  name: `Local test ${suffix}`, kind: "household", currency: "EUR",
})).status, 400, "currency must lock after an expense");
assert.equal((await a("PATCH", `/communes/${id}`, {
  name: `Retitled ${suffix}`, kind: "trip", currency: "GBP",
  destination: "Lisbon, Portugal", stayName: "Hotel Avenida",
  stayAddress: "2 Avenida da Liberdade, Lisbon",
})).status, 200);
snap = await a("GET", `/communes/${id}/snapshot`);
assert.equal(snap.commune.name, `Retitled ${suffix}`);
assert.equal(snap.commune.kind, "trip");
assert.equal(snap.commune.address, "", "kind switch clears the old address");
assert.equal(snap.commune.destination, "Lisbon, Portugal");
assert.equal(snap.commune.stayName, "Hotel Avenida");
assert.equal(snap.commune.stayAddress, "2 Avenida da Liberdade, Lisbon");
assert.equal((await a("PATCH", `/communes/${id}`, {
  name: `Retitled ${suffix}`, kind: "trip", currency: "GBP",
  stayName: "", stayAddress: "",
})).status, 200);
snap = await a("GET", `/communes/${id}/snapshot`);
assert.equal(snap.commune.destination, "Lisbon, Portugal",
  "trip area should remain when only the stay is cleared");
assert.equal(snap.commune.stayName, "");
assert.equal(snap.commune.stayAddress, "");
const share = snap.expenses[0].shares.find((part) => part.userId === userB.user.id);
assert.equal(share.amountMinor, 500);
assert.equal(snap.reminderTargets[0].kind, "nudge");
assert.equal((await b("POST", "/reminders", {
  kind: "nudge", sourceId: share.id,
})).status, 403);
const nudge = await a("POST", "/reminders", {
  kind: "nudge", sourceId: share.id,
});
assert.equal(nudge.status, 201, JSON.stringify(nudge));
assert.equal(nudge.delivery, "in-app");
assert.equal(nudge.email, "not-configured");
let usage = await a("GET", "/reminders/usage");
assert.equal(usage.totalUsed, 1);
assert.equal(usage.recipientUsage[userB.user.id], 1);
let bobSnap = await b("GET", `/communes/${id}/snapshot`);
assert.equal(bobSnap.notifications[0].kind, "nudge");
assert.equal(bobSnap.notifications[0].sourceId, share.id);
assert.equal((await b("POST", `/notifications/${bobSnap.notifications[0].id}/read`, {})).status, 200);
assert.equal((await b("POST", `/shares/${share.id}/confirm`, {})).status, 403);
assert.equal((await a("POST", `/shares/${share.id}/confirm`, {})).status, 200);
snap = await a("GET", `/communes/${id}/snapshot`);
assert.equal(snap.expenses[0].shares.find((part) => part.id === share.id).settledMinor, 500);

const fund = await a("POST", `/communes/${id}/funds`, {
  name: "Repair fund", targetMinor: 5000,
});
assert.equal(fund.status, 201, JSON.stringify(fund));
const pledge = await d("POST", `/funds/${fund.id}/pledges`, {
  amountMinor: 800, dueOn,
});
assert.equal(pledge.status, 201, JSON.stringify(pledge));
assert.equal((await d("POST", "/reminders", {
  kind: "chase", sourceId: pledge.id,
})).status, 403);
const chase = await a("POST", "/reminders", {
  kind: "chase", sourceId: pledge.id,
});
assert.equal(chase.status, 201, JSON.stringify(chase));
usage = await a("GET", "/reminders/usage");
assert.equal(usage.totalUsed, 2);
assert.equal(usage.recipientUsage[userD.user.id], 1);
const danaSnap = await d("GET", `/communes/${id}/snapshot`);
assert.equal(danaSnap.notifications.some((item) => item.kind === "chase"), true);
assert.equal((await d("POST", `/commitments/${pledge.id}/contributions`, {
  amountMinor: 400,
})).status, 403);
assert.equal((await a("POST", `/commitments/${pledge.id}/contributions`, {
  amountMinor: 400,
})).status, 201);
snap = await a("GET", `/communes/${id}/snapshot`);
assert.equal(snap.funds[0].commitments[0].contributedMinor, 400);

const note = await b("POST", `/communes/${id}/notes`, {
  title: "Wi-Fi", pill: "Info", kicker: "Everyone",
  lede: "Network", body: "Shared password in person",
  facts: [["Network", "Commune"]], requestId: randomUUID(),
});
assert.equal(note.status, 201, JSON.stringify(note));
assert.equal((await b("POST", `/communes/${id}/notes`, {
  title: "Too long", pill: "Info", kicker: "Everyone", lede: "Long",
  body: "X".repeat(2001), facts: [], requestId: randomUUID(),
})).status, 400, "long note bodies should be rejected at the API");
assert.equal((await a("GET", `/communes/${id}/snapshot`)).notes[0].title, "Wi-Fi");
assert.equal((await outsider("PUT", `/notes/${note.id}`, {
  title: "Altered", pill: "", kicker: "", lede: "", body: "", facts: [], expectedVersion: 1,
})).status, 403);

const operationDate = "2026-09-23";
const operation = await b("POST", `/communes/${id}/operations`, {
  kind: "task", category: "chore", title: "Bins", date: operationDate,
  time: "20:00", allDay: false, assigneeId: userB.user.id,
  rotationIds: [userB.user.id, userA.user.id], repeat: "weekly",
  notes: "Take outside", requestId: randomUUID(),
});
assert.equal(operation.status, 201, JSON.stringify(operation));
const operationSnapshot = await a("GET", `/communes/${id}/snapshot`);
assert.equal(operationSnapshot.operations[0].title, "Bins");
assert.equal(operationSnapshot.operations[0].date, operationDate,
  "Postgres DATE must survive API serialization without a timezone shift");
// An edit changes what, when and who. Only the occurrence commands mark a
// task done, so a status or completion sent with an edit changes nothing.
assert.equal((await b("PUT", `/operations/${operation.id}`, {
  kind: "task", category: "chore", title: "Bins", date: operationDate,
  time: "20:00", allDay: false, assigneeId: userA.user.id,
  rotationIds: [userB.user.id, userA.user.id], repeat: "weekly",
  status: "done", notes: "Done",
  lastDone: { by: "API Bob", date: dueOn }, expectedVersion: 1,
})).status, 200);
const edited = (await a("GET", `/communes/${id}/snapshot`)).operations[0];
assert.deepEqual([edited.assignee, edited.notes, edited.status, edited.lastDone], ["API Alice", "Done", "open", null]);
assert.equal((await b("DELETE", `/operations/${operation.id}`)).status, 200);
assert.equal((await b("DELETE", `/notes/${note.id}`)).status, 200);

assert.equal((await a("POST", "/auth/logout", {})).status, 200);
assert.equal((await a("GET", "/auth/me")).user, null);
assert.equal((await a("POST", "/auth/login", {
  email: addressA, password: "WrongPassword-2026!",
})).status, 401);
assert.equal((await a("POST", "/auth/login", {
  email: addressA, password,
})).status, 200);
assert.equal((await a("GET", "/communes")).communes[0].id, id);

console.log(`Local API smoke passed: 4 real users, invite, RLS, money, reminders, notes, operations (${id})`);
