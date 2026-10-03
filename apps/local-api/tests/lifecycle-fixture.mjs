import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

// Opt-in browser fixture for the money-lifecycle and operations journeys.
// Creates new synthetic accounts and one private commune on an ISOLATED test
// API. It refuses port 3002 so it can never write to the normal app database.
const base = process.env.API_BASE;
if (process.env.SEED_LIFECYCLE_FIXTURE !== "yes" || !base) {
  throw new Error("Set SEED_LIFECYCLE_FIXTURE=yes and API_BASE to an isolated loopback API (not port 3002).");
}
const url = new URL(base);
if (url.protocol !== "http:" || !["127.0.0.1", "localhost"].includes(url.hostname) || !url.port || url.port === "3002") {
  throw new Error("The lifecycle fixture requires an isolated loopback API port (not 3002).");
}
const suffix = randomUUID().slice(0, 6);
// Test-only. Never reuse for a real account.
const password = "DisposableLifecycleFixture-2026!";
function client() {
  let cookie = "";
  return async (method, path, input) => {
    const response = await fetch(`${base}/api${path}`, {
      method,
      headers: { ...(input === undefined ? {} : { "Content-Type": "application/json" }), ...(cookie ? { Cookie: cookie } : {}) },
      body: input === undefined ? undefined : JSON.stringify(input),
    });
    const set = response.headers.get("set-cookie");
    if (set) cookie = set.split(";")[0];
    const data = await response.json();
    assert.ok(response.ok, `${method} ${path}: ${JSON.stringify(data)}`);
    return data;
  };
}
const day = (offset) => {
  const date = new Date(); date.setDate(date.getDate() + offset);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};
const people = [["Avery Payer", "avery"], ["Blake Debtor", "blake"], ["Casey Member", "casey"]];
const calls = [], users = [];
for (const [name, slug] of people) {
  const call = client();
  const account = await call("POST", "/auth/signup", { name, email: `qa-${slug}-${suffix}@example.test`, password });
  calls.push(call); users.push(account.user);
}
const [a, b] = calls;
const [avery, blake, casey] = users;
const commune = await a("POST", "/communes", { name: "Lifecycle QA House", kind: "household", currency: "GBP", address: "Synthetic address · local test only" });
for (const [index, user] of [blake, casey].entries()) {
  const invite = await a("POST", `/communes/${commune.id}/invites`, { email: user.email, role: "member" });
  await calls[index + 1]("POST", `/invites/${invite.token}/accept`, {});
}
// The roadmap acceptance example: 120.00 paid by Avery, 40.00 / 80.00.
await a("POST", `/communes/${commune.id}/expenses`, { title: "Electricity bill", amountMinor: 12000, category: "Bills", dueOn: day(-7),
  shares: [{ userId: avery.id, amountMinor: 4000 }, { userId: blake.id, amountMinor: 8000 }] });
await a("POST", `/communes/${commune.id}/expenses`, { title: "Cleaning supplies", amountMinor: 3600, category: "Groceries", dueOn: day(-2),
  shares: [avery, blake, casey].map(user => ({ userId: user.id, amountMinor: 1200 })) });
await a("POST", `/communes/${commune.id}/expenses`, { title: "Window cleaner", amountMinor: 3000, category: "Other",
  shares: [{ userId: avery.id, amountMinor: 1500 }, { userId: casey.id, amountMinor: 1500 }] });
await b("POST", `/communes/${commune.id}/expenses`, { title: "Broadband", amountMinor: 4500, category: "Bills", dueOn: day(5),
  shares: [avery, blake, casey].map(user => ({ userId: user.id, amountMinor: 1500 })) });
const fund = await a("POST", `/communes/${commune.id}/funds`, { name: "Boiler repair fund", targetMinor: 30000 });
await b("POST", `/funds/${fund.id}/pledges`, { amountMinor: 10000, dueOn: day(-3) });
const rotation = [avery.name, blake.name, casey.name];
const task = { kind: "task", category: "chore", allDay: true, notes: "", status: "open" };
await a("POST", `/communes/${commune.id}/operations`, { ...task, title: "Put the bins out", date: day(0), assignee: avery.name, rotation, repeat: "weekly" });
await a("POST", `/communes/${commune.id}/operations`, { ...task, title: "Kitchen deep clean", date: day(-2), assignee: avery.name, rotation, repeat: "monthly" });
await a("POST", `/communes/${commune.id}/operations`, { ...task, title: "Return the spare key", date: day(0), assignee: avery.name, repeat: "none" });
await a("POST", `/communes/${commune.id}/operations`, { kind: "event", category: "visit", title: "Boiler engineer", date: day(2), time: "10:30", allDay: false, repeat: "none", notes: "", status: "open" });
// A second, empty commune for the empty states.
await a("POST", "/communes", { name: "QA Empty Trip", kind: "trip", currency: "EUR" });
console.log(JSON.stringify({ api: base, commune: commune.id, accounts: users.map(user => user.email), passwordSource: "apps/local-api/tests/lifecycle-fixture.mjs" }, null, 2));
