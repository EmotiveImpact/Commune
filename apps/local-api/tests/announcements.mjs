import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

// Announcements: posting, confirming, taking down and permissions.
// Creates accounts and records, so it refuses the normal application API.
const base = process.env.API_BASE;
if (!base) throw new Error("Set API_BASE to an isolated local test API, not the user's database.");
const url = new URL(base);
if (url.protocol !== "http:" || !["127.0.0.1", "localhost"].includes(url.hostname) || !url.port ||
    url.port === "3002" || url.pathname !== "/" || url.search || url.hash || url.username || url.password) {
  throw new Error("Announcement tests require an isolated loopback API port (not 3002).");
}
const suffix = randomUUID().slice(0, 8);
const password = "DisposableAnnouncementFixture-2026!";
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
    return { ...(await response.json()), status: response.status };
  };
}
const ok = (result, status = 200) => { assert.equal(result.status, status, JSON.stringify(result)); return result; };
const a = session(), b = session(), outsider = session();
const users = [];
for (const [index, call] of [a, b, outsider].entries()) {
  users.push(ok(await call("POST", "/auth/signup", {
    name: ["Avery Notice", "Blake Notice", "Outsider"][index], email: `announcements-${index}-${suffix}@example.test`, password,
  }), 201).user);
}
const [, blake] = users;
const id = ok(await a("POST", "/communes", { name: `Announcements ${suffix}`, kind: "household", currency: "GBP" }), 201).id;
const invite = ok(await a("POST", `/communes/${id}/invites`, { email: blake.email, role: "member" }), 201);
ok(await b("POST", `/invites/${invite.token}/accept`, {}));
const snapshot = async (call = a) => ok(await call("GET", `/communes/${id}/snapshot`));
const postIt = (call, input) => call("POST", `/communes/${id}/announcements`,
  { title: "Boiler service Thursday", body: "Please be in from 8.", needsAcknowledgement: true, requestId: randomUUID(), ...input });

// Validation and permissions.
assert.equal((await postIt(a, { title: "" })).status, 400);
assert.equal((await postIt(a, { title: "x".repeat(81) })).status, 400);
assert.equal((await postIt(a, { needsAcknowledgement: "yes" })).status, 400);
assert.equal((await postIt(a, { requestId: undefined })).status, 400);
assert.equal((await postIt(b)).status, 403);
assert.equal((await postIt(outsider)).status, 403);

// Posting is retry-safe.
const requestId = randomUUID();
const posted = ok(await postIt(a, { requestId }), 201);
const again = ok(await postIt(a, { requestId }));
assert.deepEqual([again.id, again.duplicate], [posted.id, true]);
assert.equal((await snapshot()).announcements.length, 1);

// A member confirms once; an outsider cannot; only the author or an admin takes it down.
ok(await b("POST", `/announcements/${posted.id}/acknowledge`, {}));
assert.equal(ok(await b("POST", `/announcements/${posted.id}/acknowledge`, {})).duplicate, true);
assert.equal((await outsider("POST", `/announcements/${posted.id}/acknowledge`, {})).status, 403);
assert.equal((await b("POST", `/announcements/${posted.id}/archive`, {})).status, 403);
const seen = (await snapshot(b)).announcements[0];
assert.deepEqual(seen.acknowledgements.map(entry => entry.userId), [blake.id]);
assert.equal((await outsider("GET", `/communes/${id}/snapshot`)).status, 404);

// A plain notice cannot be confirmed.
const plain = ok(await postIt(a, { title: "Window cleaner Friday", body: "", needsAcknowledgement: false }), 201);
assert.equal((await b("POST", `/announcements/${plain.id}/acknowledge`, {})).status, 400);

// Taking it down removes it from This Hub but keeps the history.
ok(await a("POST", `/announcements/${posted.id}/archive`, {}));
assert.equal((await b("POST", `/announcements/${posted.id}/acknowledge`, {})).status, 409);
const after = await snapshot();
assert.deepEqual(after.announcements.map(item => item.id), [plain.id]);
const lines = after.activityEvents.filter(item => item.entityId === posted.id).map(item => item.description);
assert.deepEqual(lines.sort(), ["Posted. Please confirm you have seen it", "Taken down"]);
console.log(`announcement integration passed (${base})`);
