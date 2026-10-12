import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

// Notes keep history and refuse silent overwrites (migrations 0023 and
// 0027). Creates accounts, so it refuses the normal application API.
const base = process.env.API_BASE;
if (!base) throw new Error("Set API_BASE to an isolated local test API, not the user's database.");
const url = new URL(base);
if (url.protocol !== "http:" || !["127.0.0.1", "localhost"].includes(url.hostname) || !url.port ||
    url.port === "3002" || url.pathname !== "/" || url.search || url.hash || url.username || url.password) {
  throw new Error("Note revision tests require an isolated loopback API port (not 3002).");
}
// Letters only, so a commune name that carries it never holds a phone-like run of digits.
const suffix = randomUUID().slice(0, 8).replace(/[0-9]/g, (digit) => "ghijklmnop"[digit]);
const password = "DisposableNotesFixture-2026!";
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
    return { status: response.status, ...(await response.json()) };
  };
}
const ok = (result, status = 200) => { assert.equal(result.status, status, JSON.stringify(result)); return result; };
const a = session(), b = session(), outsider = session();
const users = [];
for (const [index, call] of [a, b, outsider].entries()) {
  users.push(ok(await call("POST", "/auth/signup", {
    name: ["Avery Notes", "Blake Notes", "Outsider"][index], email: `notes-${index}-${suffix}@example.test`, password,
  }), 201).user);
}
const [avery, blake] = users;
const id = ok(await a("POST", "/communes", { name: `Notes ${suffix}`, kind: "household", currency: "GBP" }), 201).id;
const invite = ok(await a("POST", `/communes/${id}/invites`, { email: blake.email, role: "member" }), 201);
ok(await b("POST", `/invites/${invite.token}/accept`, {}));
const note = async (noteId, call = a) => ok(await call("GET", `/communes/${id}/snapshot`)).notes.find(item => item.id === noteId);
const card = (title, body) => ({ title, pill: "Wi-Fi", kicker: "Everyone", lede: body.slice(0, 200), body, facts: [["Network", "Home_5G"]] });

const wifi = ok(await a("POST", `/communes/${id}/notes`, { ...card("Wi-Fi", "Router in the hall"), requestId: randomUUID() }), 201).id;
let saved = await note(wifi);
assert.deepEqual([saved.version, saved.createdBy, saved.updatedBy, saved.revisions], [1, avery.id, avery.id, []]);

// Two people open version 1. The first save wins; the second is refused, not merged or lost.
ok(await b("PUT", `/notes/${wifi}`, { ...card("Wi-Fi", "Router moved to the lounge"), expectedVersion: 1 }));
const stale = await a("PUT", `/notes/${wifi}`, { ...card("Wi-Fi", "Password changed"), expectedVersion: 1 });
assert.equal(stale.status, 409);
assert.match(stale.error, /This note was changed by someone else/);
saved = await note(wifi);
assert.deepEqual([saved.version, saved.body, saved.updatedBy], [2, "Router moved to the lounge", blake.id]);
assert.deepEqual(saved.revisions.map(item => [item.version, item.editedBy, item.replacedBy]), [[1, avery.id, blake.id]]);

// Saving on top of the newest version keeps theirs in history.
const v3 = ok(await a("PUT", `/notes/${wifi}`, { ...card("Wi-Fi", "Password changed"), expectedVersion: 2 }));
assert.equal(v3.version, 3);
saved = await note(wifi);
assert.deepEqual(saved.revisions.map(item => item.version), [2, 1]);

// An unchanged save makes no new version. Every edit names the version it
// was based on: one without a version is refused, not saved over the top.
assert.equal(ok(await a("PUT", `/notes/${wifi}`, { ...card("Wi-Fi", "Password changed"), expectedVersion: 3 })).version, 3);
assert.equal((await a("PUT", `/notes/${wifi}`, card("Wi-Fi", "Saved without a version"))).status, 400);
assert.equal((await a("PUT", `/notes/${wifi}`, { ...card("Wi-Fi", "x"), expectedVersion: 0 })).status, 400);
assert.equal((await note(wifi)).version, 3);

// Any member can read an earlier version; outsiders cannot.
const first = (await note(wifi)).revisions.find(item => item.version === 1);
const read = ok(await b("GET", `/notes/${wifi}/revisions/${first.id}`)).revision;
assert.deepEqual([read.version, read.body, read.editedBy, read.facts], [1, "Router in the hall", avery.id, [["Network", "Home_5G"]]]);
assert.equal((await outsider("GET", `/notes/${wifi}/revisions/${first.id}`)).status, 404);
assert.equal((await a("GET", `/notes/${wifi}/revisions/${randomUUID()}`)).status, 404);

// Restoring is an ordinary save of old content: a new version, nothing deleted.
ok(await a("PUT", `/notes/${wifi}`, { title: read.title, pill: read.pill, kicker: read.kicker, lede: read.lede, body: read.body, facts: read.facts, expectedVersion: 3 }));
saved = await note(wifi);
assert.deepEqual([saved.version, saved.body, saved.revisions.length], [4, "Router in the hall", 3]);

// Many people saving at once: every save that names the current version
// either wins once or is refused; versions never skip or repeat.
{
  const current = (await note(wifi)).version;
  const results = await Promise.all(Array.from({ length: 6 }, (_, index) =>
    (index % 2 ? b : a)("PUT", `/notes/${wifi}`, { ...card("Wi-Fi", `Race ${index}`), expectedVersion: current })));
  assert.equal(results.filter(item => item.status === 200).length, 1, JSON.stringify(results.map(item => item.status)));
  assert.equal(results.filter(item => item.status === 409).length, 5);
  saved = await note(wifi);
  assert.equal(saved.version, current + 1);
  assert.deepEqual(saved.revisions.map(item => item.version), [4, 3, 2, 1]);
}

// Removing a note takes it and its earlier versions out of the commune. The
// database keeps them, but nobody reads them afterwards: not its members,
// and not someone who joins later.
ok(await a("DELETE", `/notes/${wifi}`));
assert.equal(await note(wifi), undefined);
const joining = ok(await a("POST", `/communes/${id}/invites`, { email: users[2].email, role: "member" }), 201);
ok(await outsider("POST", `/invites/${joining.token}/accept`, {}));
for (const call of [a, b, outsider]) {
  assert.deepEqual(await call("GET", `/notes/${wifi}/revisions/${first.id}`), { status: 404, error: "Revision not found" });
}
console.log(`note revision integration passed (${base})`);
