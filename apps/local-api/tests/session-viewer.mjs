import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

// Every tab shares one sign-in, so each request names the account the tab is
// showing (X-Commune-Viewer) and the API refuses to act for anyone else.
// Creates accounts and a commune, so it refuses the normal application API.
const base = process.env.API_BASE;
if (!base) throw new Error("Set API_BASE to an isolated local test API, not the user's database.");
const url = new URL(base);
if (url.protocol !== "http:" || !["127.0.0.1", "localhost"].includes(url.hostname) || !url.port ||
    url.port === "3002" || url.pathname !== "/" || url.search || url.hash || url.username || url.password) {
  throw new Error("Session viewer tests require an isolated loopback API port (not 3002).");
}
const suffix = randomUUID().slice(0, 8);
const password = "DisposableViewerFixture-2026!";
function session() {
  let cookie = "";
  return async (method, path, input, viewer) => {
    const response = await fetch(`${base}/api${path}`, {
      method,
      headers: { ...(input === undefined ? {} : { "Content-Type": "application/json" }), ...(cookie ? { Cookie: cookie } : {}),
        ...(viewer === undefined ? {} : { "X-Commune-Viewer": viewer }) },
      body: input === undefined ? undefined : JSON.stringify(input),
    });
    const set = response.headers.get("set-cookie");
    if (set) cookie = set.split(";")[0];
    return { ...(await response.json()), status: response.status };
  };
}
const changed = "You signed out or changed account in another tab, so this wasn’t saved.";
const tab = session();
const avery = (await tab("POST", "/auth/signup", { name: "Avery Viewer", email: `viewer-a-${suffix}@example.test`, password })).user;
const home = await tab("POST", "/communes", { name: `Viewer ${suffix}`, kind: "household", currency: "GBP" }, avery.id);
assert.equal(home.status, 201, JSON.stringify(home));

// The same browser signs in as Blake; this tab still shows Avery.
const blake = (await tab("POST", "/auth/signup", { name: "Blake Viewer", email: `viewer-b-${suffix}@example.test`, password })).user;
const refused = await tab("POST", "/communes", { name: `Not Blake's ${suffix}`, kind: "household", currency: "GBP" }, avery.id);
assert.equal(refused.status, 401, JSON.stringify(refused));
assert.equal(refused.error, changed);
assert.equal((await tab("GET", `/communes/${home.id}/snapshot`, undefined, avery.id)).status, 401);
const listed = await tab("GET", "/communes", undefined, blake.id);
assert.equal(listed.status, 200, JSON.stringify(listed));
assert.ok(!listed.communes.some((commune) => commune.name === `Not Blake's ${suffix}`), "A refused request created a commune");

// Asking who is signed in still answers, so the tab can see what changed.
const me = await tab("GET", "/auth/me", undefined, avery.id);
assert.equal(me.status, 200);
assert.equal(me.user.id, blake.id);
// A request without the header (an older client) is served as before.
assert.equal((await tab("GET", "/communes")).status, 200);
console.log("Session viewer: a request for another account is refused, and the current account is still served.");
