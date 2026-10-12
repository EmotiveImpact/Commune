import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

// Ten wrong passwords lock that email out of signing in for 15 minutes, and
// failures for other addresses never lift the lock early. Creates an account,
// so it refuses the normal application API. About 1,000 failed sign-ins, each
// a password hash, so it takes half a minute or so.
const base = process.env.API_BASE;
if (!base) throw new Error("Set API_BASE to an isolated local test API, not the user's database.");
const url = new URL(base);
if (url.protocol !== "http:" || !["127.0.0.1", "localhost"].includes(url.hostname) || !url.port ||
    url.port === "3002" || url.pathname !== "/" || url.search || url.hash || url.username || url.password) {
  throw new Error("Sign-in lockout tests require an isolated loopback API port (not 3002).");
}
const suffix = randomUUID().slice(0, 8);
const password = "DisposableLockoutFixture-2026!";
async function call(path, input) {
  const response = await fetch(`${base}/api${path}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input),
  });
  return { status: response.status, ...(await response.json()) };
}
const signIn = (email, attempt = password) => call("/auth/login", { email, password: attempt });

const avery = `lockout-avery-${suffix}@example.test`;
assert.equal((await call("/auth/signup", { name: "Avery Lockout", email: avery, password })).status, 201);
for (let attempt = 1; attempt <= 10; attempt += 1) {
  assert.equal((await signIn(avery, `Wrong-guess-${attempt}`)).status, 401, `wrong password ${attempt}`);
}
// Locked: even the right password is refused without being checked.
const locked = await signIn(avery);
assert.equal(locked.status, 429, JSON.stringify(locked));
assert.equal(locked.error, "Try signing in again later");

// The lockout list used to be emptied once it held more than 1,000 entries,
// so 1,001 failures for other addresses gave Avery's guesser ten more tries.
const others = Array.from({ length: 1001 }, (_, index) => `lockout-other-${index}-${suffix}@example.test`);
for (let start = 0; start < others.length; start += 8) {
  const statuses = await Promise.all(others.slice(start, start + 8).map(async (email) => (await signIn(email)).status));
  assert.ok(statuses.every((status) => status === 401), `other addresses: ${statuses.join(", ")}`);
}
assert.equal((await signIn(avery)).status, 429, "Failures for other addresses lifted the lockout");

// Other people sign in as usual.
const blake = `lockout-blake-${suffix}@example.test`;
assert.equal((await call("/auth/signup", { name: "Blake Lockout", email: blake, password })).status, 201);
assert.equal((await signIn(blake, "Wrong-guess-1")).status, 401);
assert.equal((await signIn(blake)).status, 200);
console.log("Sign-in lockout: ten failures lock an address out, and failures for 1,001 other addresses leave it locked.");
