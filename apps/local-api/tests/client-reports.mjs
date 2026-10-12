import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

// Migration 0038: the web app's error reports and sampled speed figures are
// kept for a signed-in account, naming pages by pattern and never a record,
// and once an account reaches its limit further reports are dropped rather
// than refused. Creates accounts and records, so it refuses the normal
// application API.
const base = process.env.API_BASE;
if (!base) throw new Error("Set API_BASE to an isolated local test API, not the user's database.");
const url = new URL(base);
if (url.protocol !== "http:" || !["127.0.0.1", "localhost"].includes(url.hostname) || !url.port ||
    url.port === "3002" || url.pathname !== "/" || url.search || url.hash || url.username || url.password) {
  throw new Error("Client report tests require an isolated loopback API port (not 3002).");
}
const suffix = randomUUID().slice(0, 8);
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
    return { status: response.status, ...(await response.json()) };
  };
}
const ok = (result, status = 200) => { assert.equal(result.status, status, JSON.stringify(result)); return result; };
const reporter = session(), guest = session();
ok(await reporter("POST", "/auth/signup", {
  name: "Reporter", email: `client-reports-${suffix}@example.test`, password: "DisposableClientReports-2026!",
}), 201);
const report = (input) => reporter("POST", "/client-reports", input);

const error = { kind: "error", release: "local", route: "/expenses/:id", browser: "chrome",
  message: "TypeError: Cannot read properties of undefined", stack: "    at render (/assets/index.js:1:2)" };
const speed = { kind: "speed", release: "local", route: "/", browser: "safari", lcpMs: 2300, inpMs: 180, cls: 0.05 };
assert.deepEqual(ok(await report(error)), { status: 200, stored: true });
assert.deepEqual(ok(await report(speed)), { status: 200, stored: true });

// A route that names a record or carries a query is refused, as is anything
// of the wrong kind, rather than becoming a server error.
for (const route of ["/expenses/0f8fe1a5-1234-4abc-9def-0123456789ab", "/expenses?commune=home", "https://evil.example/", "/notes/note1"]) {
  assert.equal((await report({ ...error, route })).status, 400, route);
}
for (const input of [{ ...error, kind: 7 }, { ...error, message: undefined }, { ...speed, lcpMs: "fast" }, { ...speed, lcpMs: 1e12 },
  { ...speed, lcpMs: 12.5 }, { ...speed, cls: -1 }, { ...speed, message: "Slow" }, { kind: "speed", release: "local", route: "/", browser: "chrome" }]) {
  assert.equal((await report(input)).status, 400, JSON.stringify(input));
}

// Only a signed-in account can report.
assert.equal((await guest("POST", "/client-reports", error)).status, 401);

// 20 an hour: two are kept already, so 18 more are, and the rest are dropped.
const kept = [];
for (let index = 0; index < 20; index += 1) kept.push(ok(await report({ ...error, message: `Error ${index}` })).stored);
assert.deepEqual([kept.filter(Boolean).length, kept.at(-1)], [18, false]);

console.log("Client report tests passed");
