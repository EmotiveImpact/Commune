import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

// Join codes (0044): a QR code with no email, the join setting, and an admin
// approving. Creates accounts and records, so it refuses the normal API.
const base = process.env.API_BASE;
if (!base) throw new Error("Set API_BASE to an isolated local test API, not the user's database.");
const url = new URL(base);
if (url.protocol !== "http:" || !["127.0.0.1", "localhost"].includes(url.hostname) || !url.port ||
    url.port === "3002" || url.pathname !== "/" || url.search || url.hash || url.username || url.password) {
  throw new Error("Join code tests require an isolated loopback API port (not 3002).");
}
const suffix = randomUUID().slice(0, 8);
const password = "DisposableJoinCodeFixture-2026!";
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
    return { ...(await response.json()), http: response.status };
  };
}
const ok = (result, status = 200) => { assert.equal(result.http, status, JSON.stringify(result)); return result; };
const admin = session(), priya = session(), sam = session();
for (const [index, call] of [admin, priya, sam].entries()) {
  ok(await call("POST", "/auth/signup", {
    name: ["Ada Join", "Priya Join", "Sam Join"][index], email: `join-codes-${index}-${suffix}@example.test`, password,
  }), 201);
}
const id = ok(await admin("POST", "/communes", { name: `Join codes ${suffix}`, kind: "household", currency: "GBP" }), 201).id;

// The default is approve; Priya previews and asks, and is not in until approved.
assert.equal(ok(await admin("GET", `/communes/${id}/join`)).joinMode, "approve");
const sticker = ok(await admin("POST", `/communes/${id}/join-codes`, { kind: "sticker" }), 201);
assert.match(sticker.url, new RegExp(`/j/${sticker.token}$`));
const preview = ok(await priya("GET", `/join/${sticker.token}`)).preview;
assert.deepEqual(Object.keys(preview).sort(), ["alreadyMember", "communeKind", "communeName", "joinMode", "memberCount", "waiting"]);
assert.equal(preview.memberCount, 1);
const asked = ok(await priya("POST", `/join/${sticker.token}`, { requestId: randomUUID() }));
assert.equal(asked.status, "pending");
assert.equal((await priya("GET", `/communes/${id}/join`)).http, 403);
assert.equal(ok(await priya("GET", "/join-requests")).requests.length, 1);

// Priya cannot approve herself; the admin can.
assert.equal((await priya("POST", `/join-requests/${asked.requestId}/approve`, {})).http, 403);
const waiting = ok(await admin("GET", `/communes/${id}/join`)).requests;
assert.equal(waiting.length, 1);
assert.equal(waiting[0].name, "Priya Join");
ok(await admin("POST", `/join-requests/${asked.requestId}/approve`, {}));
assert.equal(ok(await priya("POST", `/join/${sticker.token}`, {})).status, "already_member");

// Join straight away: Sam is in at once.
assert.equal((await priya("POST", `/communes/${id}/join-mode`, { mode: "instant" })).http, 403);
ok(await admin("POST", `/communes/${id}/join-mode`, { mode: "instant" }));
const joined = ok(await sam("POST", `/join/${sticker.token}`, {}));
assert.equal(joined.status, "joined");
assert.equal(joined.communeId, id);

// Off: the code stops working.
ok(await admin("POST", `/communes/${id}/join-mode`, { mode: "off" }));
assert.equal(ok(await sam("GET", `/join/${sticker.token}`)).preview, null);
assert.equal((await admin("POST", `/communes/${id}/join-codes`, { kind: "now" })).http, 409);
console.log("join codes: ok");
