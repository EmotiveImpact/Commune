import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

// The quick finder's dates (0040): each result carries its date on its own
// (date, YYYY-MM-DD or null) and its words without it (label), so the app
// writes dates the way every screen does; meta keeps the old text.
// Fixture writes must never run against the user's normal local API.
const base = process.env.API_BASE;
const origin = new URL(base ?? "http://invalid");
if (!base || origin.protocol !== "http:" || !["localhost", "127.0.0.1"].includes(origin.hostname) ||
  !origin.port || origin.port === "3002" || origin.pathname !== "/" || origin.username || origin.password || origin.search || origin.hash) {
  throw new Error("Search date tests require an isolated loopback API_BASE, not port 3002.");
}
const suffix = randomUUID().slice(0, 8);
let cookie = "";
async function call(method, path, input) {
  const response = await fetch(`${base}/api${path}`, { method,
    headers: { ...(input === undefined ? {} : { "Content-Type": "application/json" }), ...(cookie ? { Cookie: cookie } : {}) },
    body: input === undefined ? undefined : JSON.stringify(input) });
  const set = response.headers.get("set-cookie"); if (set) cookie = set.split(";")[0];
  return { status: response.status, ...await response.json() };
}
const day = (offset) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);

const owner = await call("POST", "/auth/signup", { name: "Quince owner", email: `quince-${suffix}@example.test`, password: "DisposableSearchFixture-2026!" });
assert.equal(owner.status, 201, JSON.stringify(owner));
const commune = await call("POST", "/communes", { name: `Quince ${suffix}`, kind: "household", currency: "USD" });
assert.equal(commune.status, 201, JSON.stringify(commune));
const bill = (title, nextDueOn, paused) => call("POST", `/communes/${commune.id}/recurring`, { title, amountMinor: 3210,
  paidByUserId: owner.user.id, allocations: [{ userId: owner.user.id, amountMinor: 3210 }], frequency: "monthly", nextDueOn, paused,
  requestId: randomUUID() });
const due = day(20);
assert.equal((await bill("Quince internet", due, false)).status, 201);
assert.equal((await bill("Quince water", day(25), true)).status, 201);
const taskDate = day(3);
const task = await call("POST", `/communes/${commune.id}/operations`, { kind: "task", category: "chore", title: "Quince bins",
  date: taskDate, allDay: true, repeat: "none", notes: "", requestId: randomUUID() });
assert.equal(task.status, 201, JSON.stringify(task));

const result = await call("GET", `/search?${new URLSearchParams({ q: "Quince", commune: commune.id, limit: "25" })}`);
assert.equal(result.status, 200, JSON.stringify(result));
const find = (title) => result.items.find((item) => item.title === title);
assert.deepEqual(
  ["Quince internet", "Quince water", "Quince bins"].map((title) => { const { label, date, meta } = find(title) ?? {}; return { label, date, meta }; }),
  [
    { label: "Due", date: due, meta: `Due ${due}` },
    { label: "Paused", date: null, meta: "Paused" },
    { label: "Task", date: taskDate, meta: `Task · ${taskDate}` },
  ],
);
// Everything else has no date, and its words are its old text.
const undated = result.items.filter((item) => !["recurring", "operation"].includes(item.kind));
assert.ok(undated.length >= 2, JSON.stringify(result));
for (const item of undated) {
  assert.equal(item.date, null, JSON.stringify(item));
  assert.equal(item.label, item.meta, JSON.stringify(item));
}
assert.equal(find(`Quince ${suffix}`)?.label, "Commune");
console.log("Search dates: dates arrive on their own, with the old text kept");
