import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

// The Settings switch for reminder emails: reading, saving and validation.
// Creates accounts, so it refuses the normal application API.
const base = process.env.API_BASE;
if (!base) throw new Error("Set API_BASE to an isolated local test API, not the user's database.");
const url = new URL(base);
if (url.protocol !== "http:" || !["127.0.0.1", "localhost"].includes(url.hostname) || !url.port ||
    url.port === "3002" || url.pathname !== "/" || url.search || url.hash || url.username || url.password) {
  throw new Error("Email reminder tests require an isolated loopback API port (not 3002).");
}
const suffix = randomUUID().slice(0, 8);
const password = "DisposableEmailSettingFixture-2026!";
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
const a = session(), b = session(), anonymous = session();
for (const [index, call] of [a, b].entries()) {
  ok(await call("POST", "/auth/signup", {
    name: ["Avery Email", "Blake Email"][index], email: `email-setting-${index}-${suffix}@example.test`, password,
  }), 201);
}

// Reminder emails are on until someone turns them off.
assert.equal(ok(await a("GET", "/preferences")).emailReminders, true);
assert.equal(ok(await a("PUT", "/preferences", { emailReminders: false })).emailReminders, false);
assert.equal(ok(await a("GET", "/preferences")).emailReminders, false);
assert.equal(ok(await a("PUT", "/preferences", { emailReminders: false })).emailReminders, false, "Saving the same choice twice is fine");

// One person's choice is theirs alone.
assert.equal(ok(await b("GET", "/preferences")).emailReminders, true);
assert.equal(ok(await a("PUT", "/preferences", { emailReminders: true })).emailReminders, true);
assert.equal(ok(await a("GET", "/preferences")).emailReminders, true);

// Bad input and signed-out requests change nothing.
assert.equal((await a("PUT", "/preferences", { emailReminders: "no" })).status, 400);
assert.equal((await anonymous("PUT", "/preferences", { emailReminders: false })).status, 401);
assert.equal(ok(await a("GET", "/preferences")).emailReminders, true);
console.log("email reminder setting ok");
