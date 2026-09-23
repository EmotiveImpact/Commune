import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

const base = process.env.API_BASE ?? "http://127.0.0.1:3002";
if (!/^http:\/\/(127\.0\.0\.1|localhost):3002$/.test(base)) {
  throw new Error("Smoke tests only target a loopback API on port 3002");
}
const suffix = randomUUID().slice(0, 8);
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
assert.equal((await b("GET", "/auth/me")).user.emailVerified, true);
assert.equal((await a("GET", "/preferences")).emailReminders, true);
assert.equal((await a("PUT", "/preferences", { emailReminders: false })).emailReminders, false);
assert.equal((await a("GET", "/preferences")).emailReminders, false);

const created = await a("POST", "/communes", {
  name: `Local test ${suffix}`, kind: "household", currency: "GBP",
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
assert.deepEqual(snap.members.map((member) => member.email).sort(),
  [addressA, addressB, addressD].sort());
assert.equal((await outsider("GET", `/communes/${id}/snapshot`)).status, 404);
const dueOn = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
const badSplit = await a("POST", `/communes/${id}/expenses`, {
  title: "Bad split", amountMinor: 1000, dueOn,
  shares: [{ userId: userA.user.id, amountMinor: 900 }],
});
assert.equal(badSplit.status, 400);
const expense = await a("POST", `/communes/${id}/expenses`, {
  title: "Shared groceries", amountMinor: 1000, dueOn,
  shares: [
    { userId: userA.user.id, amountMinor: 500 },
    { userId: userB.user.id, amountMinor: 500 },
  ],
});
assert.equal(expense.status, 201, JSON.stringify(expense));
snap = await a("GET", `/communes/${id}/snapshot`);
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
  facts: [["Network", "Commune"]],
});
assert.equal(note.status, 201, JSON.stringify(note));
assert.equal((await a("GET", `/communes/${id}/snapshot`)).notes[0].title, "Wi-Fi");
assert.equal((await outsider("PUT", `/notes/${note.id}`, {
  title: "Altered", pill: "", kicker: "", lede: "", body: "", facts: [],
})).status, 404);

const operationDate = "2026-09-23";
const operation = await b("POST", `/communes/${id}/operations`, {
  kind: "task", category: "chore", title: "Bins", date: operationDate,
  time: "20:00", allDay: false, assignee: "API Bob",
  rotation: ["API Bob", "API Alice"], repeat: "weekly",
  status: "open", notes: "Take outside",
});
assert.equal(operation.status, 201, JSON.stringify(operation));
const operationSnapshot = await a("GET", `/communes/${id}/snapshot`);
assert.equal(operationSnapshot.operations[0].title, "Bins");
assert.equal(operationSnapshot.operations[0].date, operationDate,
  "Postgres DATE must survive API serialization without a timezone shift");
assert.equal((await b("PUT", `/operations/${operation.id}`, {
  kind: "task", category: "chore", title: "Bins", date: operationDate,
  time: "20:00", allDay: false, assignee: "API Alice",
  rotation: ["API Bob", "API Alice"], repeat: "weekly",
  status: "done", notes: "Done",
  lastDone: { by: "API Bob", date: dueOn },
})).status, 200);
assert.equal((await a("GET", `/communes/${id}/snapshot`)).operations[0].status, "done");
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
