import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

// Notes and tasks change only through database commands (migration 0027): an
// add is safe to retry, an edit names its version, and only the person who
// added a record or an admin removes it. Creates accounts and records, so it
// refuses the normal application API.
const base = process.env.API_BASE;
if (!base) throw new Error("Set API_BASE to an isolated local test API, not the user's database.");
const url = new URL(base);
if (url.protocol !== "http:" || !["127.0.0.1", "localhost"].includes(url.hostname) || !url.port ||
    url.port === "3002" || url.pathname !== "/" || url.search || url.hash || url.username || url.password) {
  throw new Error("Note and task command tests require an isolated loopback API port (not 3002).");
}
// Letters only, so a commune name that carries it never holds a phone-like run of digits.
const suffix = randomUUID().slice(0, 8).replace(/[0-9]/g, (digit) => "ghijklmnop"[digit]);
const password = "DisposableCommandsFixture-2026!";
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
    name: ["Avery Commands", "Blake Commands", "Casey Commands", "Outsider"][index], email: `commands-${index}-${suffix}@example.test`, password,
  }), 201).user);
}
const [, blake, casey] = users;
// Avery adds the commune and is its admin; Blake and Casey are plain members.
const id = ok(await a("POST", "/communes", { name: `Commands ${suffix}`, kind: "household", currency: "GBP" }), 201).id;
for (const [user, call] of [[blake, b], [casey, c]]) {
  const invite = ok(await a("POST", `/communes/${id}/invites`, { email: user.email, role: "member" }), 201);
  ok(await call("POST", `/invites/${invite.token}/accept`, {}));
}
const snapshot = async () => ok(await a("GET", `/communes/${id}/snapshot`));
const events = async (entityId) => (await snapshot()).activityEvents.filter(item => item.entityId === entityId).map(item => item.description).sort();
const iso = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const today = iso(new Date());

// ------------------------------------------------------------------ notes
const card = { title: "Bins", pill: "House", kicker: "Everyone", lede: "Collection day", body: "Black bin on Tuesday", facts: [["Day", "Tuesday"]] };
const noteRequest = randomUUID();
const note = ok(await b("POST", `/communes/${id}/notes`, { ...card, requestId: noteRequest }), 201);
assert.deepEqual([note.version, note.duplicate], [1, false]);
// A retry of the same add returns the note it already added.
const retried = ok(await b("POST", `/communes/${id}/notes`, { ...card, requestId: noteRequest }));
assert.deepEqual([retried.id, retried.duplicate], [note.id, true]);
const reused = await b("POST", `/communes/${id}/notes`, { ...card, title: "Recycling", requestId: noteRequest });
assert.equal(reused.status, 400);
assert.match(reused.error, /already used for a different change/);
assert.equal((await b("POST", `/communes/${id}/notes`, card)).status, 400);
assert.equal((await snapshot()).notes.length, 1);

// Two people edit version 1. The first save wins; the second is a 409 and
// saves nothing.
assert.equal(ok(await c("PUT", `/notes/${note.id}`, { ...card, body: "Black bin on Wednesday", expectedVersion: 1 })).version, 2);
const stale = await a("PUT", `/notes/${note.id}`, { ...card, body: "Black bin moved", expectedVersion: 1 });
assert.equal(stale.status, 409);
assert.match(stale.error, /This note was changed by someone else/);
assert.equal((await snapshot()).notes[0].body, "Black bin on Wednesday");

// Casey edited the note but did not add it, so Casey cannot remove it.
const refused = await c("DELETE", `/notes/${note.id}`);
assert.equal(refused.status, 403);
assert.match(refused.error, /Only the person who added this note or an admin can remove it/);
assert.equal((await outsider("DELETE", `/notes/${note.id}`)).status, 403);
assert.equal(ok(await b("DELETE", `/notes/${note.id}`)).duplicate, false);
assert.equal(ok(await b("DELETE", `/notes/${note.id}`)).duplicate, true);
assert.equal((await snapshot()).notes.length, 0);
// A late retry of the add is refused, rather than handing back the removed note.
const lateNote = await b("POST", `/communes/${id}/notes`, { ...card, requestId: noteRequest });
assert.deepEqual([lateNote.status, lateNote.error], [409, "This note has been removed"]);
assert.equal((await c("PUT", `/notes/${note.id}`, { ...card, expectedVersion: 2 })).status, 409);
assert.deepEqual(await events(note.id), ["Created", "Removed", "Updated"]);
// An admin removes a note someone else added.
const key = ok(await c("POST", `/communes/${id}/notes`, { ...card, title: "Spare key", requestId: randomUUID() }), 201);
ok(await a("DELETE", `/notes/${key.id}`));
assert.equal((await snapshot()).notes.length, 0);

// ------------------------------------------------------------------ tasks
const chore = { kind: "task", category: "chore", title: "Hoover the stairs", date: today, allDay: true,
  assigneeId: blake.id, rotationIds: [blake.id, casey.id], repeat: "weekly", notes: "" };
const taskRequest = randomUUID();
// Status and completion are not part of an add: a new task is open.
const task = ok(await b("POST", `/communes/${id}/operations`, { ...chore, status: "done", lastDone: { by: blake.name, date: today }, requestId: taskRequest }), 201);
assert.equal(ok(await b("POST", `/communes/${id}/operations`, { ...chore, requestId: taskRequest })).id, task.id);
let row = (await snapshot()).operations.find(item => item.id === task.id);
assert.deepEqual([row.version, row.status, row.lastDone, row.createdBy], [1, "open", null, blake.id]);

// Blake opens the task to edit it; meanwhile Casey marks it done for him. Blake's
// save would put the task back, so it is refused and the completion stays.
ok(await c("POST", `/operations/${task.id}/occurrences`, { action: "completed", expectedDate: today, today, requestId: randomUUID(), doneBy: "assignee" }), 201);
const staleTask = await b("PUT", `/operations/${task.id}`, { ...chore, title: "Hoover the stairs and hall", expectedVersion: 1 });
assert.equal(staleTask.status, 409);
assert.match(staleTask.error, /This task was changed by someone else/);
row = (await snapshot()).operations.find(item => item.id === task.id);
assert.deepEqual([row.version, row.title, row.assigneeId, row.lastDone], [2, "Hoover the stairs", casey.id, { by: blake.name, date: today, markedBy: casey.name }]);
// Saved on top of the latest version, an edit changes what, when and who,
// and leaves the completion as it is.
const edited = ok(await b("PUT", `/operations/${task.id}`, { ...chore, title: "Hoover the stairs and hall", date: row.date,
  assigneeId: row.assigneeId, status: "done", lastDone: null, expectedVersion: row.version }));
assert.deepEqual([edited.version, edited.duplicate], [3, false]);
row = (await snapshot()).operations.find(item => item.id === task.id);
assert.deepEqual([row.title, row.status, row.lastDone], ["Hoover the stairs and hall", "open", { by: blake.name, date: today, markedBy: casey.name }]);

// Casey cannot remove a task Blake added; Avery, an admin, can. It leaves
// the calendar, keeps its history and takes no further actions; a late retry
// of its add is refused.
const refusedTask = await c("DELETE", `/operations/${task.id}`);
assert.equal(refusedTask.status, 403);
assert.match(refusedTask.error, /Only the person who added this or an admin can remove it/);
ok(await a("DELETE", `/operations/${task.id}`));
assert.equal((await snapshot()).operations.some(item => item.id === task.id), false);
const late = await c("POST", `/operations/${task.id}/occurrences`, { action: "completed", expectedDate: row.date, today, requestId: randomUUID() });
assert.equal(late.status, 409);
assert.match(late.error, /This task has been removed/);
const lateAdd = await b("POST", `/communes/${id}/operations`, { ...chore, requestId: taskRequest });
assert.deepEqual([lateAdd.status, lateAdd.error], [409, "This task has been removed"]);
assert.deepEqual(await events(task.id), ["Created", "Marked done for Blake Commands. Next: Casey Commands", "Removed", "Updated"]);
// The person who added a task can remove it too.
const visit = ok(await c("POST", `/communes/${id}/operations`, { kind: "event", category: "visit", title: "Gas safety check", date: today,
  allDay: true, repeat: "none", notes: "", requestId: randomUUID() }), 201);
ok(await c("DELETE", `/operations/${visit.id}`));
assert.equal((await snapshot()).operations.length, 0);
console.log(`note and task command integration passed (${base})`);
