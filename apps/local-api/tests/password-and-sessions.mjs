import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

// Change password and "sign out everywhere else": both keep the device that
// asked signed in and end the account's other sessions, never another
// account's. Creates accounts, so it refuses the normal application API.
const base = process.env.API_BASE;
if (!base) throw new Error("Set API_BASE to an isolated local test API, not the user's database.");
const url = new URL(base);
if (url.protocol !== "http:" || !["127.0.0.1", "localhost"].includes(url.hostname) || !url.port ||
    url.port === "3002" || url.pathname !== "/" || url.search || url.hash || url.username || url.password) {
  throw new Error("Password and session tests require an isolated loopback API port (not 3002).");
}
const suffix = randomUUID().slice(0, 8);
const password = "DisposablePasswordFixture-2026!";
const changed = "ChangedPasswordFixture-2026!";
// One browser or phone: its own session cookie.
function device() {
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
const signedIn = async (session, user) => {
  const me = await session("GET", "/auth/me");
  return me.status === 200 && me.user?.id === user.id && (await session("GET", "/communes")).status === 200;
};
const signedOut = async (session) =>
  (await session("GET", "/auth/me")).user === null && (await session("GET", "/communes")).status === 401;
const signIn = async (email, secret) => {
  const session = device();
  return { session, result: await session("POST", "/auth/login", { email, password: secret }) };
};

const emailA = `password-a-${suffix}@example.test`;
const emailB = `password-b-${suffix}@example.test`;
const laptop = device();
const avery = (await laptop("POST", "/auth/signup", { name: "Avery Password", email: emailA, password })).user;
const phone = (await signIn(emailA, password)).session;
const blakeLaptop = device();
const blake = (await blakeLaptop("POST", "/auth/signup", { name: "Blake Password", email: emailB, password })).user;
const blakePhone = (await signIn(emailB, password)).session;
assert.ok(await signedIn(phone, avery) && await signedIn(blakePhone, blake));

// Nothing changes without a sign-in, or for an account the tab isn't showing.
assert.equal((await device()("POST", "/auth/change-password", { currentPassword: password, newPassword: changed })).status, 401);
assert.equal((await device()("POST", "/auth/logout-others", {})).status, 401);
const otherViewer = await laptop("POST", "/auth/change-password", { currentPassword: password, newPassword: changed }, blake.id);
assert.equal(otherViewer.status, 401, JSON.stringify(otherViewer));

// A wrong current password and a short new one are refused, and nothing changes.
const wrong = await laptop("POST", "/auth/change-password", { currentPassword: "not-the-password-at-all", newPassword: changed });
assert.equal(wrong.status, 400, JSON.stringify(wrong));
assert.equal(wrong.error, "Your current password isn’t right. Nothing was changed.");
const short = await laptop("POST", "/auth/change-password", { currentPassword: password, newPassword: "elevenchars" });
assert.equal(short.status, 400, JSON.stringify(short));
assert.equal(short.error, "Password must contain 12–128 characters");
const long = await laptop("POST", "/auth/change-password", { currentPassword: password, newPassword: "x".repeat(129) });
assert.equal(long.status, 400, JSON.stringify(long));
assert.ok(await signedIn(phone, avery), "A refused change ended another session");
assert.equal((await signIn(emailA, password)).result.status, 200, "A refused change replaced the password");

// The change keeps this device and ends the account's others.
const extra = (await signIn(emailA, password)).session;
const done = await laptop("POST", "/auth/change-password", { currentPassword: password, newPassword: changed });
assert.equal(done.status, 200, JSON.stringify(done));
assert.deepEqual(done, { ok: true, status: 200 });
assert.ok(await signedIn(laptop, avery), "The device that changed the password was signed out");
assert.ok(await signedOut(phone), "Another session survived the password change");
assert.ok(await signedOut(extra), "Another session survived the password change");
assert.equal((await signIn(emailA, password)).result.status, 401, "The old password still signs in");
const tablet = await signIn(emailA, changed);
assert.equal(tablet.result.status, 200, JSON.stringify(tablet.result));

// Sign out everywhere else keeps this device and ends the others.
const desktop = (await signIn(emailA, changed)).session;
assert.ok(await signedIn(tablet.session, avery) && await signedIn(desktop, avery));
const elsewhere = await laptop("POST", "/auth/logout-others", {});
assert.deepEqual(elsewhere, { ok: true, status: 200 });
assert.ok(await signedIn(laptop, avery), "The device that signed out the others was signed out");
assert.ok(await signedOut(tablet.session) && await signedOut(desktop), "Another session survived");
assert.deepEqual(await laptop("POST", "/auth/logout-others", {}), { ok: true, status: 200 });
assert.ok(await signedIn(laptop, avery));

// Another account's sessions are untouched by all of it.
assert.ok(await signedIn(blakeLaptop, blake) && await signedIn(blakePhone, blake), "Another account was signed out");
assert.equal((await signIn(emailB, password)).result.status, 200, "Another account's password changed");

// Guessing the current password meets the sign-in limit, and that limit is
// shared: while it holds, the right password is refused here and at sign-in.
const emailC = `password-c-${suffix}@example.test`;
const casey = device();
assert.equal((await casey("POST", "/auth/signup", { name: "Casey Password", email: emailC, password })).status, 201);
let limited = null;
for (let attempt = 0; attempt < 30 && !limited; attempt++) {
  const guess = await casey("POST", "/auth/change-password", { currentPassword: `guess-${attempt}-wrong`, newPassword: changed });
  if (guess.status === 429) limited = guess;
  else assert.equal(guess.status, 400, JSON.stringify(guess));
}
assert.ok(limited, "Repeated wrong current passwords were never limited");
assert.equal((await casey("POST", "/auth/change-password", { currentPassword: password, newPassword: changed })).status, 429);
assert.equal((await signIn(emailC, password)).result.status, 429, "Sign-in ignored the guesses made here");
assert.ok(await signedIn(casey, { id: (await casey("GET", "/auth/me")).user.id }));
console.log("Password and sessions: a change or a sign-out elsewhere keeps this device, ends the account's others, and leaves other accounts alone.");
