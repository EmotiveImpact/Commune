import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

// The commune's WhatsApp group link: who can set it and who sees it.
// Creates accounts and records, so it refuses the normal application API.
const base = process.env.API_BASE;
if (!base) throw new Error("Set API_BASE to an isolated local test API, not the user's database.");
const url = new URL(base);
if (url.protocol !== "http:" || !["127.0.0.1", "localhost"].includes(url.hostname) || !url.port ||
    url.port === "3002" || url.pathname !== "/" || url.search || url.hash || url.username || url.password) {
  throw new Error("Group chat link tests require an isolated loopback API port (not 3002).");
}
const suffix = randomUUID().slice(0, 8);
const password = "DisposableChatLinkFixture-2026!";
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
    name: ["Avery Chat", "Blake Chat", "Outsider"][index], email: `chat-link-${index}-${suffix}@example.test`, password,
  }), 201).user);
}
const [, blake] = users;
const id = ok(await a("POST", "/communes", { name: `Chat link ${suffix}`, kind: "household", currency: "GBP" }), 201).id;
const invite = ok(await a("POST", `/communes/${id}/invites`, { email: blake.email, role: "member" }), 201);
ok(await b("POST", `/invites/${invite.token}/accept`, {}));


const listed = async (call) => ok(await call("GET", "/communes")).communes.find((item) => item.id === id);
assert.equal((await listed(a)).chatLink, "");

// Only a WhatsApp group invite link is accepted, and a pasted one is tidied.
assert.equal((await a("PUT", `/communes/${id}/chat-link`, { link: "https://example.com/AbCdEfGhIjKlMnOpQrStUv" })).status, 400);
assert.equal((await a("PUT", `/communes/${id}/chat-link`, { link: 42 })).status, 400);
const saved = ok(await a("PUT", `/communes/${id}/chat-link`, { link: " https://chat.whatsapp.com/AbCdEfGhIjKlMnOpQrStUv?mode=ems_copy_t" }));
assert.equal(saved.link, "https://chat.whatsapp.com/AbCdEfGhIjKlMnOpQrStUv");

// Blake, a member, sees it but cannot change it; the outsider can do neither.
assert.equal((await listed(b)).chatLink, "https://chat.whatsapp.com/AbCdEfGhIjKlMnOpQrStUv");
assert.equal((await b("PUT", `/communes/${id}/chat-link`, { link: "" })).status, 403);
assert.equal((await outsider("PUT", `/communes/${id}/chat-link`, { link: "" })).status, 403);
assert.equal(await listed(outsider), undefined);

// Avery removes it.
assert.equal(ok(await a("PUT", `/communes/${id}/chat-link`, { link: "" })).link, "");
assert.equal((await listed(b)).chatLink, "");

console.log("Group chat link tests passed");
