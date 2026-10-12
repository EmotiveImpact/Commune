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
// Letters only, so a commune name that carries it never holds a phone-like run of digits.
const suffix = randomUUID().slice(0, 8).replace(/[0-9]/g, (digit) => "ghijklmnop"[digit]);
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
const a = session(), b = session(), c = session(), outsider = session();
const users = [];
for (const [index, call] of [a, b, c, outsider].entries()) {
  users.push(ok(await call("POST", "/auth/signup", {
    name: ["Avery Rota", "Blake Rota", "Casey Rota", "Outsider"][index], email: `operations-${index}-${suffix}@example.test`, password,
  }), 201).user);
}
const [avery, blake, casey] = users;
const id = ok(await a("POST", "/communes", { name: `Operations ${suffix}`, kind: "household", currency: "GBP" }), 201).id;
const invite = ok(await a("POST", `/communes/${id}/invites`, { email: blake.email, role: "member" }), 201);
ok(await b("POST", `/invites/${invite.token}/accept`, {}));
const inviteCasey = ok(await a("POST", `/communes/${id}/invites`, { email: casey.email, role: "member" }), 201);
ok(await c("POST", `/invites/${inviteCasey.token}/accept`, {}));

const iso = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const day = (offset) => { const date = new Date(); date.setDate(date.getDate() + offset); return iso(date); };
const today = day(0);
const addMonth = (value) => {
  const [year, month, dayOfMonth] = value.split("-").map(Number);
  const last = new Date(year, month + 1, 0).getDate();
  return iso(new Date(year, month, Math.min(dayOfMonth, last)));
};
// People are named by member id; names are read back live.
const rotationIds = [avery.id, blake.id, casey.id];
const task = { kind: "task", category: "chore", allDay: true, notes: "", repeat: "none" };
const create = async (input) => ok(await a("POST", `/communes/${id}/operations`, { ...task, requestId: randomUUID(), ...input }), 201).id;
const read = async (operationId, call = a) => ok(await call("GET", `/communes/${id}/snapshot`)).operations.find(item => item.id === operationId);
const act = (operationId, action, expectedDate, call = a, extra = {}) =>
  call("POST", `/operations/${operationId}/occurrences`, { action, expectedDate, today, requestId: randomUUID(), ...extra });

// ------------------------------------------ weekly rotation, retry and undo
const bins = await create({ title: "Put the bins out", date: today, assigneeId: avery.id, rotationIds, repeat: "weekly" });
{
  const created = await read(bins);
  assert.deepEqual([created.assigneeId, created.assignee, created.rotationIds, created.rotation],
    [avery.id, avery.name, rotationIds, [avery.name, blake.name, casey.name]]);
  // Only current members of this commune, each once, and the holder in the rotation.
  const outsiderId = users[3].id;
  for (const bad of [{ assigneeId: outsiderId }, { assigneeId: avery.id, rotationIds: [avery.id, outsiderId] },
      { assigneeId: blake.id, rotationIds: [avery.id] }, { rotationIds: [avery.id, avery.id] }]) {
    assert.equal((await a("POST", `/communes/${id}/operations`, { ...task, requestId: randomUUID(), title: "Bad", date: today, repeat: "weekly", ...bad })).status, 400, JSON.stringify(bad));
  }
}
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
assert.deepEqual([second.date, second.assignee, second.assigneeId], [day(14), casey.name, casey.id]);
const tooLate = await a("POST", `/occurrences/${first}/undo`, {});
assert.equal(tooLate.status, 409);
assert.match(tooLate.error, /can no longer be undone/);
// A manual edit after completion also closes the undo, rather than being overwritten.
saved = await read(bins);
ok(await a("PUT", `/operations/${bins}`, { ...task, title: "Put the bins out", date: day(15), assigneeId: saved.assigneeId, rotationIds, repeat: "weekly", expectedVersion: saved.version }));
assert.equal((await read(bins)).undoOccurrenceId, null);
assert.equal((await a("POST", `/occurrences/${second.id}/undo`, {})).status, 409);
assert.deepEqual([(await read(bins)).date, (await read(bins)).assignee], [day(15), casey.name]);
// The rotation wraps round to the first person.
const wrapped = ok(await act(bins, "completed", day(15)), 201);
assert.equal(wrapped.assignee, avery.name);


// ------------------------------------------------- monthly, overdue, skip
const late = await create({ title: "Deep clean", date: day(-40), assigneeId: blake.id, repeat: "monthly" });
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
  const end = await create({ title: "Month-end meter reading", date: "2026-01-31", assigneeId: avery.id, repeat: "monthly" });
  assert.equal((await read(end)).anchorDay, 31);
  // Completing from a date long in the past steps month by month from the
  // anchor, through February, and lands on that month's own last day.
  const advanced = ok(await act(end, "completed", "2026-01-31"), 201);
  const day = Number(advanced.date.slice(8, 10));
  const [year, month] = advanced.date.split("-").map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  assert.equal(day, Math.min(31, lastDay), `monthly step kept the anchor: ${advanced.date}`);
  // Editing the date by hand resets the anchor.
  ok(await a("PUT", `/operations/${end}`, { ...task, title: "Month-end meter reading", date: "2026-02-14", assigneeId: avery.id, repeat: "monthly",
    expectedVersion: (await read(end)).version }));
  assert.equal((await read(end)).anchorDay, 14);
  console.log("monthly anchor: ok");
}

// ---------------------------------------- one-off tasks, reopen, and events
const key = await create({ title: "Return the spare key", date: today, assigneeId: blake.id });
assert.equal((await act(key, "skipped", today)).status, 409);
const finished = ok(await act(key, "completed", today), 201);
assert.deepEqual([finished.taskStatus, finished.date], ["done", today]);
assert.deepEqual((await read(key)).lastDone, { by: avery.name, date: today });
assert.equal((await act(key, "completed", today, b)).status, 409);
ok(await b("POST", `/occurrences/${finished.id}/undo`, {}));
assert.deepEqual([(await read(key)).status, (await read(key)).lastDone], ["open", null]);
// Status and completion cannot be sent with an add or an edit: a new task
// is open and not yet done, and an edit leaves both as they are.
const legacy = await create({ title: "Old finished job", date: day(-3), status: "done", lastDone: { by: blake.name, date: day(-3) } });
assert.deepEqual([(await read(legacy)).status, (await read(legacy)).lastDone, (await read(legacy)).undoOccurrenceId], ["open", null, null]);
ok(await act(legacy, "completed", day(-3)), 201);
const closed = await read(legacy);
ok(await a("PUT", `/operations/${legacy}`, { ...task, title: "Old finished job, checked", date: day(-3), status: "open", lastDone: null, expectedVersion: closed.version }));
assert.deepEqual([(await read(legacy)).title, (await read(legacy)).status, (await read(legacy)).lastDone], ["Old finished job, checked", "done", closed.lastDone]);
assert.equal((await act(legacy, "completed", day(-3))).status, 409);
// A finished task is reopened as a recorded action, which can be undone.
const reopened = ok(await act(legacy, "reopened", day(-3)), 201);
assert.equal(reopened.taskStatus, "open");
assert.equal((await act(legacy, "reopened", day(-3))).status, 409);
ok(await a("POST", `/occurrences/${reopened.id}/undo`, {}));
assert.equal((await read(legacy)).status, "done");
const visit = ok(await a("POST", `/communes/${id}/operations`, { kind: "event", category: "visit", title: "Boiler engineer", date: today, allDay: true, repeat: "none", notes: "", requestId: randomUUID() }), 201).id;
assert.equal((await act(visit, "completed", today)).status, 400);

// History says what happened, without a vague extra "Updated" per action.
const events = ok(await a("GET", `/communes/${id}/snapshot`)).activityEvents.filter(item => item.entityId === bins).map(item => item.description);
assert.ok(events.includes(`Completed. Next: ${blake.name}`), JSON.stringify(events));
assert.ok(events.includes("Completion undone"));
assert.equal(events.filter(item => item === "Updated").length, 1, JSON.stringify(events));
// Removing a task hides it; its history is kept and says who removed it.
ok(await a("DELETE", `/operations/${bins}`));
assert.equal(await read(bins), undefined);
assert.ok(ok(await a("GET", `/communes/${id}/snapshot`)).activityEvents.some(item => item.entityId === bins && item.description === "Removed"));
// ------------------------------------------- handovers and skip reasons
{
  // Avery's turn on the recycling; Casey covers it. Casey is credited, and
  // the turn passes to Blake (after Avery), not to whoever follows Casey.
  const recycling = await create({ title: "Recycling", date: today, assigneeId: avery.id, rotationIds: [avery.id, blake.id], repeat: "weekly" });
  const handover = (call, input) => call("POST", `/operations/${recycling}/handovers`,
    { expectedDate: today, expectedAssigneeId: avery.id, today, requestId: randomUUID(), ...input });
  assert.equal((await handover(outsider, { toMemberId: casey.id })).status, 403);
  assert.equal((await handover(b, { toMemberId: users[3].id })).status, 400);
  assert.equal((await handover(b, { toMemberId: avery.id })).status, 400);
  assert.equal((await handover(b, { toMemberId: casey.id, expectedAssigneeId: blake.id })).status, 409);
  assert.equal((await handover(b, { toMemberId: casey.id, reason: "x".repeat(201) })).status, 400);
  const requestId = randomUUID();
  const handed = ok(await handover(b, { toMemberId: casey.id, reason: "Avery is away", requestId }), 201);
  assert.deepEqual([handed.assigneeId, handed.turnOwnerId, handed.date], [casey.id, avery.id, today]);
  // A retry returns the same handover.
  const again = ok(await handover(b, { toMemberId: casey.id, requestId }));
  assert.deepEqual([again.id, again.duplicate], [handed.id, true]);
  const covered = await read(recycling);
  assert.deepEqual([covered.assignee, covered.turnOwner, covered.undoOccurrenceId], [casey.name, avery.name, handed.id]);
  assert.deepEqual([covered.history[0].action, covered.history[0].reason, covered.history[0].nextAssigneeId], ["handed_over", "Avery is away", casey.id]);
  const done = ok(await act(recycling, "completed", today, c), 201);
  assert.deepEqual([done.assigneeId, done.turnOwnerId], [blake.id, null]);
  assert.equal((await read(recycling)).lastDone.by, casey.name);
  // Undoing the completion brings the cover back exactly.
  ok(await c("POST", `/occurrences/${done.id}/undo`, {}));
  assert.deepEqual([(await read(recycling)).assigneeId, (await read(recycling)).turnOwnerId], [casey.id, avery.id]);
  // A skip may say why; only a skip or a handover takes a reason.
  assert.equal((await act(recycling, "completed", today, a, { reason: "Why" })).status, 400);
  const skippedWithReason = ok(await act(recycling, "skipped", today, a, { reason: "Collection cancelled" }), 201);
  assert.equal((await read(recycling)).history[0].reason, "Collection cancelled");
  assert.equal((await act(recycling, "skipped", skippedWithReason.date, a, { reason: 42 })).status, 400);
  const lines = ok(await a("GET", `/communes/${id}/snapshot`)).activityEvents.filter(item => item.entityId === recycling).map(item => item.description);
  assert.ok(lines.includes(`Handed to ${casey.name}, covering for ${avery.name}: Avery is away`), JSON.stringify(lines));
  assert.ok(lines.some(line => line.startsWith("Skipped to ") && line.endsWith(": Collection cancelled")), JSON.stringify(lines));
  ok(await a("DELETE", `/operations/${recycling}`));
  console.log("handovers and skip reasons: ok");
}
// ------------------------------------------- older clients and departures
{
  // People are member ids; a name alone is not a person.
  const legacyNames = await create({ title: "Water the plants", date: today, assigneeId: blake.id, rotationIds: [blake.id, casey.id], repeat: "weekly" });
  assert.deepEqual([(await read(legacyNames)).assignee, (await read(legacyNames)).rotation], [blake.name, [blake.name, casey.name]]);
  assert.equal((await a("POST", `/communes/${id}/operations`, { ...task, requestId: randomUUID(), title: "Ghost", date: today, assigneeId: "nobody-here" })).status, 400);
  // Casey's turn on the plants, then Casey leaves: it passes on, and Casey leaves every rotation.
  ok(await a("PUT", `/operations/${legacyNames}`, { ...task, title: "Water the plants", date: today, assigneeId: casey.id, rotationIds: [blake.id, casey.id], repeat: "weekly",
    expectedVersion: (await read(legacyNames)).version }));
  ok(await c("POST", `/communes/${id}/members/${casey.id}`, { action: "leave" }));
  const plants = await read(legacyNames);
  assert.deepEqual([plants.assigneeId, plants.assignee, plants.rotationIds], [blake.id, blake.name, [blake.id]]);
  const notes = ok(await a("GET", `/communes/${id}/snapshot`)).activityEvents.filter(item => item.entityId === legacyNames).map(item => item.description);
  assert.ok(notes.includes(`${casey.name} left. Now with ${blake.name}`), JSON.stringify(notes));
  // A task held by someone outside any rotation becomes unassigned.
  const solo = await create({ title: "Return library books", date: today, assigneeId: blake.id });
  ok(await a("POST", `/communes/${id}/members/${blake.id}`, { action: "remove" }));
  assert.deepEqual([(await read(solo)).assigneeId, (await read(solo)).assignee], [null, null]);
  assert.deepEqual([(await read(legacyNames)).assigneeId, (await read(legacyNames)).rotationIds], [null, null]);
  console.log("member ids and departures: ok");
}
console.log(`operation occurrence integration passed (${base})`);
