import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

// Task occurrences: completion, skip, reopen, undo, rotation and repeats.
// Creates accounts and records, so it refuses the normal application API.
const base = process.env.API_BASE;
if (!base) throw new Error("Set API_BASE to an isolated local test API, not the user's database.");
const url = new URL(base);
if (url.protocol !== "http:" || !["127.0.0.1", "localhost"].includes(url.hostname) || !url.port ||
    url.port === "3002" || url.pathname !== "/" || url.search || url.hash || url.username || url.password) {
  throw new Error("Operation history tests require an isolated loopback API port (not 3002).");
}
const suffix = randomUUID().slice(0, 8);
const password = "DisposableOperationsFixture-2026!";
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
    // An occurrence result has its own "status" (the task's); keep both.
    const data = await response.json();
    return { ...data, taskStatus: data.status, status: response.status };
  };
}
const ok = (result, status = 200) => { assert.equal(result.status, status, JSON.stringify(result)); return result; };
const a = session(), b = session(), outsider = session();
const users = [];
for (const [index, call] of [a, b, outsider].entries()) {
  users.push(ok(await call("POST", "/auth/signup", {
    name: ["Avery Rota", "Blake Rota", "Outsider"][index], email: `operations-${index}-${suffix}@example.test`, password,
  }), 201).user);
}
const [avery, blake] = users;
const id = ok(await a("POST", "/communes", { name: `Operations ${suffix}`, kind: "household", currency: "GBP" }), 201).id;
const invite = ok(await a("POST", `/communes/${id}/invites`, { email: blake.email, role: "member" }), 201);
ok(await b("POST", `/invites/${invite.token}/accept`, {}));

const iso = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const day = (offset) => { const date = new Date(); date.setDate(date.getDate() + offset); return iso(date); };
const today = day(0);
const addMonth = (value) => {
  const [year, month, dayOfMonth] = value.split("-").map(Number);
  const last = new Date(year, month + 1, 0).getDate();
  return iso(new Date(year, month, Math.min(dayOfMonth, last)));
};
const rotation = [avery.name, blake.name, "Casey Guest"];
const task = { kind: "task", category: "chore", allDay: true, notes: "", status: "open", repeat: "none" };
const create = async (input) => ok(await a("POST", `/communes/${id}/operations`, { ...task, ...input }), 201).id;
const read = async (operationId, call = a) => ok(await call("GET", `/communes/${id}/snapshot`)).operations.find(item => item.id === operationId);
const act = (operationId, action, expectedDate, call = a, extra = {}) =>
  call("POST", `/operations/${operationId}/occurrences`, { action, expectedDate, today, requestId: randomUUID(), ...extra });

// ------------------------------------------ weekly rotation, retry and undo
const bins = await create({ title: "Put the bins out", date: today, assignee: avery.name, rotation, repeat: "weekly" });
assert.equal((await read(bins)).undoOccurrenceId, null);
assert.deepEqual((await read(bins)).history, []);
// Permission and validation live on the server.
assert.equal((await act(bins, "completed", today, outsider)).status, 403);
assert.equal((await act(bins, "finished", today)).status, 400);
assert.equal((await act(bins, "completed", today, a, { today: day(-5) })).status, 400);
assert.equal((await act(bins, "completed", today, a, { requestId: undefined })).status, 400);

const requestId = randomUUID();
const done = ok(await act(bins, "completed", today, a, { requestId }), 201);
assert.deepEqual([done.duplicate, done.date, done.assignee, done.taskStatus], [false, day(7), blake.name, "open"]);
// The same click sent again changes nothing.
const again = ok(await act(bins, "completed", today, a, { requestId }), 200);
assert.deepEqual([again.id, again.duplicate, again.date, again.assignee], [done.id, true, day(7), blake.name]);
// A second person's stale click cannot advance the rotation twice.
const stale = await act(bins, "completed", today, b);
assert.equal(stale.status, 409);
assert.match(stale.error, /already moved on/);
let saved = await read(bins, b);
assert.deepEqual([saved.date, saved.assignee, saved.status, saved.lastDone, saved.undoOccurrenceId],
  [day(7), blake.name, "open", { by: avery.name, date: today }, done.id]);
assert.deepEqual([saved.history.length, saved.history[0].action, saved.history[0].dueOn, saved.history[0].assignee, saved.history[0].actorId,
  saved.history[0].nextDate, saved.history[0].nextAssignee, saved.history[0].undoneAt],
  [1, "completed", today, avery.name, avery.id, day(7), blake.name, null]);

// Undo restores the date, the person and the last-done record exactly.
assert.equal((await outsider("POST", `/occurrences/${done.id}/undo`, {})).status, 403);
const undone = ok(await b("POST", `/occurrences/${done.id}/undo`, {}));
assert.deepEqual([undone.duplicate, undone.date, undone.assignee, undone.taskStatus], [false, today, avery.name, "open"]);
assert.equal(ok(await b("POST", `/occurrences/${done.id}/undo`, {})).duplicate, true);
saved = await read(bins);
assert.deepEqual([saved.date, saved.assignee, saved.lastDone, saved.undoOccurrenceId], [today, avery.name, null, null]);
assert.equal(saved.history[0].undoneBy, blake.id);
assert.ok(saved.history[0].undoneAt);

// Six people-at-once completions of one occurrence: exactly one counts.
const burst = await Promise.all(Array.from({ length: 6 }, (_, index) => act(bins, "completed", today, index % 2 ? b : a)));
assert.equal(burst.filter(result => result.status === 201).length, 1, JSON.stringify(burst));
assert.equal(burst.filter(result => result.status === 409).length, 5);
saved = await read(bins);
assert.deepEqual([saved.date, saved.assignee], [day(7), blake.name]);
const first = saved.undoOccurrenceId;
// Once the next person has completed their turn, the earlier one is history.
const second = ok(await act(bins, "completed", day(7), b), 201);
assert.deepEqual([second.date, second.assignee], [day(14), "Casey Guest"]);
const tooLate = await a("POST", `/occurrences/${first}/undo`, {});
assert.equal(tooLate.status, 409);
assert.match(tooLate.error, /can no longer be undone/);
// A manual edit after completion also closes the undo, rather than being overwritten.
saved = await read(bins);
ok(await a("PUT", `/operations/${bins}`, { ...task, title: "Put the bins out", date: day(15), assignee: saved.assignee, rotation, repeat: "weekly", lastDone: saved.lastDone }));
assert.equal((await read(bins)).undoOccurrenceId, null);
assert.equal((await a("POST", `/occurrences/${second.id}/undo`, {})).status, 409);
assert.deepEqual([(await read(bins)).date, (await read(bins)).assignee], [day(15), "Casey Guest"]);
// The rotation wraps round to the first person.
const wrapped = ok(await act(bins, "completed", day(15)), 201);
assert.equal(wrapped.assignee, avery.name);

// ------------------------------------------------- monthly, overdue, skip
const late = await create({ title: "Deep clean", date: day(-40), assignee: blake.name, repeat: "monthly" });
let expected = day(-40);
do { expected = addMonth(expected); } while (expected <= today);
const monthly = ok(await act(late, "completed", day(-40)), 201);
assert.deepEqual([monthly.date, monthly.assignee, monthly.taskStatus], [expected, blake.name, "open"]);
// The assignee, not whoever ticked the box, is credited for a repeating task.
assert.deepEqual((await read(late)).lastDone, { by: blake.name, date: today });
ok(await a("POST", `/occurrences/${monthly.id}/undo`, {}));
assert.deepEqual([(await read(late)).date, (await read(late)).lastDone], [day(-40), null]);
const skipped = ok(await act(late, "skipped", day(-40)), 201);
assert.deepEqual([skipped.date, skipped.assignee, skipped.taskStatus], [day(7), blake.name, "open"]);
assert.equal((await read(late)).history[0].action, "skipped");
ok(await a("POST", `/occurrences/${skipped.id}/undo`, {}));
assert.equal((await read(late)).date, day(-40));

// ------------------------------------- monthly anchor survives short months
{
  // A task set for the 31st steps to the last day of short months and back
  // to the 31st, rather than drifting to the 28th for good.
  const end = await create({ title: "Month-end meter reading", date: "2026-01-31", assignee: avery.name, repeat: "monthly" });
  assert.equal((await read(end)).anchorDay, 31);
  // Completing from a date long in the past steps month by month from the
  // anchor, through February, and lands on that month's own last day.
  const advanced = ok(await act(end, "completed", "2026-01-31"), 201);
  const day = Number(advanced.date.slice(8, 10));
  const [year, month] = advanced.date.split("-").map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  assert.equal(day, Math.min(31, lastDay), `monthly step kept the anchor: ${advanced.date}`);
  // Editing the date by hand resets the anchor.
  ok(await a("PUT", `/operations/${end}`, { ...task, title: "Month-end meter reading", date: "2026-02-14", assignee: avery.name, repeat: "monthly", lastDone: null }));
  assert.equal((await read(end)).anchorDay, 14);
  console.log("monthly anchor: ok");
}

// ---------------------------------------- one-off tasks, reopen, and events
const key = await create({ title: "Return the spare key", date: today, assignee: blake.name });
assert.equal((await act(key, "skipped", today)).status, 409);
const finished = ok(await act(key, "completed", today), 201);
assert.deepEqual([finished.taskStatus, finished.date], ["done", today]);
assert.deepEqual((await read(key)).lastDone, { by: avery.name, date: today });
assert.equal((await act(key, "completed", today, b)).status, 409);
ok(await b("POST", `/occurrences/${finished.id}/undo`, {}));
assert.deepEqual([(await read(key)).status, (await read(key)).lastDone], ["open", null]);
// A task marked done before occurrences existed has nothing to undo: reopen it.
const legacy = await create({ title: "Old finished job", date: day(-3), status: "done", lastDone: { by: blake.name, date: day(-3) } });
assert.equal((await read(legacy)).undoOccurrenceId, null);
assert.equal((await act(legacy, "completed", day(-3))).status, 409);
const reopened = ok(await act(legacy, "reopened", day(-3)), 201);
assert.equal(reopened.taskStatus, "open");
assert.equal((await act(legacy, "reopened", day(-3))).status, 409);
ok(await a("POST", `/occurrences/${reopened.id}/undo`, {}));
assert.equal((await read(legacy)).status, "done");
const visit = ok(await a("POST", `/communes/${id}/operations`, { kind: "event", category: "visit", title: "Boiler engineer", date: today, allDay: true, repeat: "none", notes: "", status: "open" }), 201).id;
assert.equal((await act(visit, "completed", today)).status, 400);

// History says what happened, without a vague extra "Updated" per action.
const events = ok(await a("GET", `/communes/${id}/snapshot`)).activityEvents.filter(item => item.entityId === bins).map(item => item.description);
assert.ok(events.includes(`Completed. Next: ${blake.name}`), JSON.stringify(events));
assert.ok(events.includes("Completion undone"));
assert.equal(events.filter(item => item === "Updated").length, 1, JSON.stringify(events));
// Removing a task removes its occurrences with it.
ok(await a("DELETE", `/operations/${bins}`));
assert.equal(await read(bins), undefined);
console.log(`operation occurrence integration passed (${base})`);
