// Dedicated local test database only. Provider is mocked; no emails leave.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { sendInvitationEmail, renderInvitationEmail } from "../src/invitations.ts";

if (!process.env.DATABASE_URL?.includes("127.0.0.1") || !process.env.DATABASE_URL.includes("invite_email_test")) throw new Error("Use the isolated invite_email_test database");
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const actor = randomUUID(), outsider = randomUUID();
const config = { apiKey: "test-only", from: "Commune <test@example.test>", appUrl: "https://example.test" };
const calls = [];
let providerStatus = 200;
globalThis.fetch = async (url, init) => {
  assert.equal(url, "https://api.resend.com/emails");
  calls.push({ body: init.body, key: init.headers["Idempotency-Key"] });
  return Response.json(providerStatus === 200 ? { id: "test-provider-id" } : { error: "outage" }, { status: providerStatus });
};
async function asActor(fn) {
  const c = await pool.connect();
  try { await c.query("BEGIN"); await c.query("SELECT set_config('request.jwt.claims',json_build_object('sub',$1::text)::text,true)", [actor]); const result = await fn(c); await c.query("COMMIT"); return result; }
  catch (e) { await c.query("ROLLBACK"); throw e; } finally { c.release(); }
}
let commune;
try {
  await pool.query('INSERT INTO neon_auth."user" (id,name,email,"emailVerified") VALUES ($1,\'Admin\',$2,true)', [actor, `${actor}@example.test`]);
  commune = (await asActor(c => c.query("SELECT public.create_commune('Invitation test','household','GBP') AS id"))).rows[0].id;
  const create = async (recipient) => (await asActor(c => c.query("SELECT public.create_commune_invite($1,$2,'member') AS token", [commune, recipient]))).rows[0].token;
  const token = await create("recipient@example.test");
  await assert.rejects(sendInvitationEmail(pool, actor, token, null), e => e.status === 503);
  await assert.rejects(sendInvitationEmail(pool, outsider, token, config), e => e.status === 404);
  assert.equal(calls.length, 0);
  assert.deepEqual(await sendInvitationEmail(pool, actor, token, config), { status: "sent" });
  assert.equal(calls.length, 1);
  assert.ok(calls[0].body.includes(token));
  const ledger = (await pool.query("SELECT * FROM public.invitation_email_deliveries WHERE commune_id=$1", [commune])).rows[0];
  assert.equal(JSON.stringify(ledger).includes(token), false, "raw token not stored in the ledger");
  assert.equal(ledger.status, "sent");
  await sendInvitationEmail(pool, actor, token, config);
  assert.equal(calls.length, 1, "repeated clicks do not send again");
  const newToken = await create("recipient@example.test");
  await assert.rejects(sendInvitationEmail(pool, actor, newToken, config), e => e.status === 429);
  await assert.rejects(sendInvitationEmail(pool, actor, token, config), e => e.status === 404, "superseded invite cannot send");
  providerStatus = 503;
  const retryToken = await create("retry@example.test");
  await assert.rejects(sendInvitationEmail(pool, actor, retryToken, config), e => e.status === 502);
  const first = calls.at(-1);
  await assert.rejects(sendInvitationEmail(pool, actor, retryToken, config), e => e.status === 429);
  await pool.query("UPDATE public.invitation_email_deliveries SET updated_at=now()-interval '2 minutes' WHERE status='failed' AND commune_id=$1", [commune]);
  await pool.query("UPDATE public.communes SET name='Changed name' WHERE id=$1", [commune]);
  providerStatus = 200;
  await sendInvitationEmail(pool, actor, retryToken, config);
  assert.deepEqual(calls.at(-1), first, "retry uses identical frozen payload and idempotency key");
  const expired = await create("expired@example.test");
  await pool.query("UPDATE public.commune_invites SET expires_at=now()-interval '1 second' WHERE token_hash=digest($1,'sha256')", [expired]);
  await assert.rejects(sendInvitationEmail(pool, actor, expired, config), e => e.status === 404);
  const access = (await pool.query("SELECT has_table_privilege('authenticated','public.invitation_email_deliveries','SELECT') AS allowed")).rows[0];
  assert.equal(access.allowed, false);
  const rendered = renderInvitationEmail({ commune: '<script>Bad</script>\r\nName', role: 'member', expires: '2026-10-04', appUrl: 'https://example.test' });
  assert.equal(rendered.html.includes('<script>'), false);
  assert.equal(rendered.subject.includes('\n'), false);
  const parallelToken = await create("parallel@example.test");
  const before = calls.length;
  const parallel = await Promise.allSettled(Array.from({ length: 4 }, () => sendInvitationEmail(pool, actor, parallelToken, config)));
  assert.ok(parallel.some(result => result.status === "fulfilled"));
  assert.equal(calls.length, before + 1, "simultaneous sends dispatch only once");
  await asActor(c => c.query("UPDATE public.commune_members SET role='member' WHERE commune_id=$1 AND user_id=$2", [commune, actor]));
  await assert.rejects(sendInvitationEmail(pool, actor, parallelToken, config), e => e.status === 404, "former admins cannot send");
  console.log('Invitation email: authorization, provider failure/retry, deduplication, rate limit, expiry, token privacy and HTML escaping passed. No real email sent.');
} finally {
  if (commune) await pool.query("DELETE FROM public.communes WHERE id=$1", [commune]);
  await pool.query('DELETE FROM neon_auth."user" WHERE id=$1', [actor]);
  await pool.end();
}
