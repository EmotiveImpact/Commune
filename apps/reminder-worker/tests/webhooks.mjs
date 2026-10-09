// Resend's bounce and complaint webhook, through the worker's own route.
// Disposable local test database only (migrations through 0033); nothing is
// sent and no real secret is used.
import assert from "node:assert/strict";
import { createHmac, randomBytes, randomUUID } from "node:crypto";
import { Pool } from "pg";

if (!process.env.DATABASE_URL?.includes("127.0.0.1")) throw new Error("Use a disposable local 127.0.0.1 database");
delete process.env.RESEND_WEBHOOK_SECRET;
const { default: worker } = await import("../src/index.ts");
const { verifyWebhookSignature, webhookSigningKey } = await import("../src/webhooks.ts");
const db = new Pool({ connectionString: process.env.DATABASE_URL });
const key = randomBytes(24);
const secret = `whsec_${key.toString("base64")}`;
const run = randomUUID().slice(0, 8);
const address = (name) => `${name}-${run}@example.test`;
const now = () => Math.floor(Date.now() / 1000);

function signature(body, id, timestamp, signingKey = key) {
  return `v1,${createHmac("sha256", signingKey).update(`${id}.${timestamp}.${body}`).digest("base64")}`;
}
function event(type, to) {
  return JSON.stringify({ type, created_at: new Date().toISOString(), data: { email_id: randomUUID(), from: "Commune <test@example.test>", to, subject: "Test" } });
}
async function deliver(body, { id = `msg_${randomUUID()}`, timestamp = now(), signed = signature(body, id, timestamp), method = "POST" } = {}) {
  const headers = { "Content-Type": "application/json", "svix-id": id, "svix-timestamp": String(timestamp), "svix-signature": signed };
  return worker.fetch(new Request("https://worker.example.test/webhooks/resend", { method, headers, body: method === "POST" ? body : undefined }));
}
async function suppression(email) {
  return (await db.query("SELECT email, reason, provider_event_id, created_at FROM public.email_suppressions WHERE email = $1", [email])).rows[0];
}

let exitCode = 0;
try {
  // Svix's own published example verifies, and is refused once stale.
  const vector = new Headers({ "svix-id": "msg_p5jXN8AQM9LWM0D4loKWxJek", "svix-timestamp": "1614265330",
    "svix-signature": "v1,g0hM9SsE+OTPJTGt/tmIKtSyZlE3uFJELVlNIOLJ1OE=" });
  const vectorKey = webhookSigningKey("whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw");
  assert.equal(verifyWebhookSignature(vectorKey, vector, Buffer.from('{"test": 2432232314}'), 1614265330_000), true);
  assert.equal(verifyWebhookSignature(vectorKey, vector, Buffer.from('{"test": 2432232314}'), 1614265630_001), false);
  assert.equal(verifyWebhookSignature(vectorKey, vector, Buffer.from('{"test": 2432232315}'), 1614265330_000), false);

  // Without its signing secret the route records nothing, even for a request
  // that looks signed.
  const bounced = event("email.bounced", [address("Bounced.Person").toUpperCase()]);
  assert.equal((await deliver(bounced)).status, 503);
  process.env.RESEND_WEBHOOK_SECRET = "not-a-signing-secret";
  assert.equal((await deliver(bounced)).status, 503, "a secret without whsec_ is not a secret");
  process.env.RESEND_WEBHOOK_SECRET = secret;
  assert.equal(await suppression(address("bounced.person")), undefined);

  // A correctly signed bounce records the address in lower case, once.
  const id = `msg_${randomUUID()}`;
  const timestamp = now();
  const response = await deliver(bounced, { id, timestamp });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { received: true });
  const recorded = await suppression(address("bounced.person"));
  assert.equal(recorded.reason, "bounce");
  assert.equal(recorded.provider_event_id, id);
  // The same event delivered again changes nothing.
  assert.equal((await deliver(bounced, { id, timestamp })).status, 200);
  assert.deepEqual(await suppression(address("bounced.person")), recorded);
  // Nor does a later complaint about an address already recorded.
  assert.equal((await deliver(event("email.complained", [address("bounced.person")]))).status, 200);
  assert.deepEqual(await suppression(address("bounced.person")), recorded);

  // A complaint is recorded too. The header may carry several signatures,
  // and "Name <address>" recipients are read by their address.
  const complained = event("email.complained", [`Someone <${address("complainer")}>`]);
  const complaintId = `msg_${randomUUID()}`;
  const complaintTime = now();
  const several = `v1,${randomBytes(32).toString("base64")} ${signature(complained, complaintId, complaintTime)}`;
  assert.equal((await deliver(complained, { id: complaintId, timestamp: complaintTime, signed: several })).status, 200);
  assert.equal((await suppression(address("complainer"))).reason, "complaint");

  // Refused: a signature made with another key, a body that was changed after
  // signing, a timestamp more than five minutes away, a missing header and an
  // unknown signature version.
  const refused = event("email.bounced", [address("refused")]);
  assert.equal((await deliver(refused, { signed: signature(refused, "msg_x", now(), randomBytes(24)) })).status, 401);
  const original = event("email.bounced", [address("original")]);
  const tamperId = `msg_${randomUUID()}`;
  const tamperTime = now();
  assert.equal((await deliver(refused, { id: tamperId, timestamp: tamperTime, signed: signature(original, tamperId, tamperTime) })).status, 401);
  const staleTime = now() - 6 * 60;
  assert.equal((await deliver(refused, { id: tamperId, timestamp: staleTime, signed: signature(refused, tamperId, staleTime) })).status, 401);
  const futureTime = now() + 6 * 60;
  assert.equal((await deliver(refused, { id: tamperId, timestamp: futureTime, signed: signature(refused, tamperId, futureTime) })).status, 401);
  assert.equal((await deliver(refused, { id: tamperId, timestamp: tamperTime, signed: "" })).status, 401);
  assert.equal((await deliver(refused, { id: tamperId, timestamp: tamperTime, signed: signature(refused, tamperId, tamperTime).replace("v1,", "v2,") })).status, 401);
  assert.equal(await suppression(address("refused")), undefined);
  assert.equal(await suppression(address("original")), undefined);

  // Other event types are acknowledged and ignored; other methods are refused.
  assert.equal((await deliver(event("email.delivered", [address("delivered")]))).status, 200);
  assert.equal(await suppression(address("delivered")), undefined);
  assert.equal((await deliver("", { method: "GET" })).status, 405);

  console.log("Resend webhook: signature, replay, timestamp window, event types and suppression records passed. Nothing sent.");
} catch (error) {
  console.error(error);
  exitCode = 1;
} finally {
  await db.query("DELETE FROM public.email_suppressions WHERE email LIKE $1", [`%-${run}@example.test`]);
  await db.end();
  // The worker keeps its module-scope pool open, as it does in production.
  process.exit(exitCode);
}
