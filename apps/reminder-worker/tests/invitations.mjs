// Dedicated local test database only. Provider is mocked; no emails leave.
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { Pool } from "pg";
import { INVITATION_LIMITS_QUERY, inviterName, looksLikeContact, renderInvitationEmail, sendInvitationEmail } from "../src/invitations.ts";

if (!process.env.DATABASE_URL?.includes("127.0.0.1") || !process.env.DATABASE_URL.includes("invite_email_test")) throw new Error("Use the isolated invite_email_test database");
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
// The sender runs with nothing but pg_catalog on its search path, so it cannot
// lean on an extension: pgcrypto's digest() lives in public.
const senderPool = new Pool({ connectionString: process.env.DATABASE_URL, options: "-c search_path=pg_catalog" });
const send = (actorId, token, mail = config) => sendInvitationEmail(senderPool, actorId, token, mail);
const tokenHash = (token) => createHash("sha256").update(token).digest();
const actor = randomUUID(), outsider = randomUUID(), bulkSender = randomUUID();
const config = { apiKey: "test-only", from: "Commune <test@example.test>", appUrl: "https://example.test" };
const calls = [];
let providerStatus = 200;
globalThis.fetch = async (url, init) => {
  assert.equal(url, "https://api.resend.com/emails");
  calls.push({ body: init.body, key: init.headers["Idempotency-Key"] });
  return Response.json(providerStatus === 200 ? { id: "test-provider-id" } : { error: "outage" }, { status: providerStatus });
};
async function asUser(userId, fn) {
  const c = await pool.connect();
  try { await c.query("BEGIN"); await c.query("SELECT set_config('request.jwt.claims',json_build_object('sub',$1::text)::text,true)", [userId]); const result = await fn(c); await c.query("COMMIT"); return result; }
  catch (e) { await c.query("ROLLBACK"); throw e; } finally { c.release(); }
}
const asActor = (fn) => asUser(actor, fn);
const refusal = (status, message) => (e) => e.status === status && (!message || e.message === message);
const NAME_REFUSAL = "This invitation can't be emailed because a name in it looks like a link or phone number. Copy the link and share it yourself.";
const SUPPRESSED = "This address can't receive Commune emails. Share the link another way.";
const NEW_ACCOUNT = "New accounts can email up to 5 invitations a day. Copy the link and share it yourself.";
const PAUSED = "Invitation emails are paused for today. Copy the link and share it yourself.";
const deliveries = async () => +(await pool.query("SELECT count(*) FROM public.invitation_email_deliveries WHERE sender_id=$1", [actor])).rows[0].count;
let commune, bulkCommune;
try {
  // The email names its inviter, quotes the commune and offers a report link
  // that names the invitation by id, never by token.
  const inviteId = randomUUID();
  const sample = renderInvitationEmail({ commune: "Park House", inviter: "Alice Example", role: "member", expires: "2026-10-04", appUrl: "https://example.test", inviteId });
  const report = `mailto:support@ourcommune.io?subject=Report%20invitation%20${inviteId}`;
  assert.equal(sample.subject, "Alice Example invited you to join “Park House” on Commune");
  assert.ok(sample.text.startsWith("Alice Example has invited you to join “Park House” as a member."));
  assert.ok(sample.html.includes("Alice Example has invited you to join “Park House” as a member."));
  assert.ok(sample.html.includes(">Join “Park House”</h1>"));
  assert.ok(sample.text.includes(`If you weren't expecting this, you can ignore this email or report it: ${report}`));
  assert.ok(sample.html.includes(`<a href="${report}"`) && sample.html.includes(">report it</a>."));
  assert.ok(renderInvitationEmail({ commune: "Park House", inviter: "Alice", role: "admin", expires: "2026-10-04", appUrl: "https://example.test", inviteId })
    .text.startsWith("Alice has invited you to join “Park House” as an admin."));
  assert.throws(() => renderInvitationEmail({ commune: "Park House", inviter: "Alice", role: "member", expires: "2026-10-04", appUrl: "https://example.test", inviteId: "a".repeat(64) }),
    /Invalid invitation id/, "a report link never carries a token");
  // The inviter's account name: one line, trimmed, at most 60 characters.
  assert.equal(inviterName("  Alice\r\n\tExample \u0007"), "Alice Example");
  assert.equal(inviterName("x".repeat(80)), "x".repeat(60));
  assert.equal(inviterName(`${"🏠".repeat(59)}ab`), `${"🏠".repeat(59)}a`, "the cap counts characters, not UTF-16 units");
  assert.equal(inviterName(`${"y".repeat(59)} z`), "y".repeat(59), "no trailing space after the cap");
  for (const blank of ["", "   ", "\r\n", null, undefined]) assert.equal(inviterName(blank), "A Commune member");
  assert.equal(inviterName("\u202eAlice"), "Alice", "marks that reorder text are dropped");
  const long = renderInvitationEmail({ commune: "🏠".repeat(100), inviter: `${"🏠".repeat(59)}a`, role: "member", expires: "2026-10-04", appUrl: "https://example.test", inviteId });
  assert.equal(Array.from(long.subject).length, 180);
  assert.equal(long.subject.isWellFormed(), true, "the subject cap never cuts a character in half");
  const escaped = renderInvitationEmail({ commune: "<script>Bad</script>\r\nName", inviter: "<b>Eve</b>", role: "member", expires: "2026-10-04", appUrl: "https://example.test", inviteId });
  assert.equal(escaped.html.includes("<script>"), false);
  assert.equal(escaped.html.includes("<b>"), false);
  assert.equal(escaped.subject.includes("\n"), false);

  // The worker's name rule matches the database's, case by case.
  const ordinary = ["12 Park Street", "Flat 3B, 2026", "St. Mary's House", "No.5 Studio", "Smith & Co.", "Tom @ Home", "Flat 2, 14-16 Park Road", "123456", "example.company",
    "Ski trip 2025-2026", "Flat 12345678"];
  const contact = ["Bank: card locked, call 020 7946 0000", "+44 (0)20 7946 0000", "Call 07700-900-123", "020–7946–0000", "０２０ ７９４６ ００００",
    "020\u200b7946\u200b0000", "example.com", "Visit EXAMPLE.CO.UK", "paypal-help.net/login", "bit.ly/abc", "www.example", "https://x", "help@bank", "help＠bank", "ｗｗｗ．example"];
  for (const name of ordinary) assert.equal(looksLikeContact(name), false, name);
  for (const name of contact) assert.equal(looksLikeContact(name), true, name);
  const database = (await pool.query("SELECT n, commune_private.looks_like_contact(n) AS hit FROM unnest($1::text[]) n", [[...ordinary, ...contact]])).rows;
  for (const row of database) assert.equal(row.hit, looksLikeContact(row.n), `worker and database disagree on ${row.n}`);

  await pool.query('INSERT INTO neon_auth."user" (id,name,email,"emailVerified") VALUES ($1,\'Admin\',$2,true), ($3,\'Bulk\',$4,true)', [actor, `${actor}@example.test`, bulkSender, `${bulkSender}@example.test`]);
  commune = (await asActor(c => c.query("SELECT public.create_commune('Invitation test','household','GBP') AS id"))).rows[0].id;
  const create = async (recipient) => (await asActor(c => c.query("SELECT public.create_commune_invite($1,$2,'member') AS token", [commune, recipient]))).rows[0].token;
  const token = await create("recipient@example.test");
  await assert.rejects(send(actor, token, null), refusal(503));
  await assert.rejects(send(outsider, token), refusal(404));
  assert.equal(calls.length, 0);
  assert.deepEqual(await send(actor, token), { status: "sent" });
  assert.equal(calls.length, 1);
  const sent = JSON.parse(calls[0].body);
  const sentId = (await pool.query("SELECT id FROM public.commune_invites WHERE token_hash=$1", [tokenHash(token)])).rows[0].id;
  assert.equal(sent.subject, "Admin invited you to join “Invitation test” on Commune");
  assert.ok(sent.text.startsWith("Admin has invited you to join “Invitation test” as a member."));
  assert.ok(sent.text.includes(`mailto:support@ourcommune.io?subject=Report%20invitation%20${sentId}`));
  assert.equal(sent.text.split(token).length, 2, "the token appears only in the join link");
  assert.equal(sent.html.split(token).length, 2, "the token appears only in the join link");
  const ledger = (await pool.query("SELECT * FROM public.invitation_email_deliveries WHERE commune_id=$1", [commune])).rows[0];
  assert.equal(JSON.stringify(ledger).includes(token), false, "raw token not stored in the ledger");
  assert.equal(ledger.status, "sent");
  await send(actor, token);
  assert.equal(calls.length, 1, "repeated clicks do not send again");
  const newToken = await create("recipient@example.test");
  await assert.rejects(send(actor, newToken), refusal(429));
  await assert.rejects(send(actor, token), refusal(404), "superseded invite cannot send");
  providerStatus = 503;
  const retryToken = await create("retry@example.test");
  await assert.rejects(send(actor, retryToken), refusal(502));
  const first = calls.at(-1);
  await assert.rejects(send(actor, retryToken), refusal(429));
  await pool.query("UPDATE public.invitation_email_deliveries SET updated_at=now()-interval '2 minutes' WHERE status='failed' AND commune_id=$1", [commune]);
  await pool.query("UPDATE public.communes SET name='Changed name' WHERE id=$1", [commune]);
  providerStatus = 200;
  await send(actor, retryToken);
  assert.deepEqual(calls.at(-1), first, "retry uses identical frozen payload and idempotency key");
  const expired = await create("expired@example.test");
  await pool.query("UPDATE public.commune_invites SET expires_at=now()-interval '1 second' WHERE token_hash=$1", [tokenHash(expired)]);
  await assert.rejects(send(actor, expired), refusal(404));
  const access = (await pool.query("SELECT has_table_privilege('authenticated','public.invitation_email_deliveries','SELECT') AS allowed")).rows[0];
  assert.equal(access.allowed, false);
  assert.equal(await deliveries(), 2);

  // An address that bounced or complained gets no more email, not even a
  // retry of an earlier failed attempt.
  await pool.query("INSERT INTO public.email_suppressions (email, reason, provider_event_id) VALUES ('suppressed@example.test', 'complaint', 'msg_test_1')");
  let before = calls.length;
  await assert.rejects(send(actor, await create("Suppressed@Example.test")), refusal(409, SUPPRESSED));
  assert.equal(calls.length, before, "no email to a suppressed address");
  providerStatus = 503;
  const lateToken = await create("late-bounce@example.test");
  await assert.rejects(send(actor, lateToken), refusal(502));
  before = calls.length;
  await pool.query("INSERT INTO public.email_suppressions (email, reason, provider_event_id) VALUES ('late-bounce@example.test', 'bounce', 'msg_test_2')");
  await pool.query("UPDATE public.invitation_email_deliveries SET updated_at=now()-interval '2 minutes' WHERE recipient_email='late-bounce@example.test'");
  providerStatus = 200;
  await assert.rejects(send(actor, lateToken), refusal(409, SUPPRESSED));
  assert.equal(calls.length, before, "no retry to an address suppressed since");
  assert.equal(await deliveries(), 3);

  // A commune name from before migration 0033 that looks like contact details
  // is never emailed, and neither is an inviter's account name that does.
  await pool.query("UPDATE public.communes SET name='Bank: card locked, call 020 7946 0000' WHERE id=$1", [commune]);
  await assert.rejects(send(actor, await create("phished@example.test")), refusal(422, NAME_REFUSAL));
  await pool.query("UPDATE public.communes SET name='Invitation test' WHERE id=$1", [commune]);
  await pool.query('UPDATE neon_auth."user" SET name=$2 WHERE id=$1', [actor, "Help desk www.example.com"]);
  await assert.rejects(send(actor, await create("phished-too@example.test")), refusal(422, NAME_REFUSAL));
  await pool.query('UPDATE neon_auth."user" SET name=\'Admin\' WHERE id=$1', [actor]);
  assert.equal(calls.length, before);
  assert.equal(await deliveries(), 3, "a refused invitation leaves no delivery");

  // A new account (earliest membership under a day old) sends 5 a day.
  await send(actor, await create("fourth@example.test"));
  await send(actor, await create("fifth@example.test"));
  assert.equal(await deliveries(), 5);
  const sixth = await create("sixth@example.test");
  await assert.rejects(send(actor, sixth), refusal(429, NEW_ACCOUNT));
  await asActor(c => c.query("UPDATE public.commune_members SET joined_at=now()-interval '2 days' WHERE user_id=$1", [actor]));
  assert.deepEqual(await send(actor, sixth), { status: "sent" }, "an established account is not held to the new-account limit");

  // At most 500 invitation emails go out across Commune in 24 hours.
  bulkCommune = (await asUser(bulkSender, c => c.query("SELECT public.create_commune('Bulk test','household','GBP') AS id"))).rows[0].id;
  await pool.query(`INSERT INTO public.commune_invites (commune_id, email, role, token_hash, invited_by)
    SELECT $1, 'bulk-' || g || '@example.test', 'member', sha256(convert_to(gen_random_uuid()::text, 'UTF8')), $2 FROM generate_series(1, 494) g`, [bulkCommune, bulkSender]);
  await pool.query(`INSERT INTO public.invitation_email_deliveries (invite_id, commune_id, sender_id, recipient_email, status, payload)
    SELECT id, commune_id, invited_by, email, 'sent', '{}'::jsonb FROM public.commune_invites WHERE commune_id=$1`, [bulkCommune]);
  const seventh = await create("seventh@example.test");
  before = calls.length;
  await assert.rejects(send(actor, seventh), refusal(429, PAUSED));
  assert.equal(calls.length, before);
  await pool.query("UPDATE public.invitation_email_deliveries SET created_at=now()-interval '25 hours' WHERE commune_id=$1", [bulkCommune]);
  assert.deepEqual(await send(actor, seventh), { status: "sent" }, "the limit is a rolling 24 hours");

  // Each count is read through an index, never by scanning every delivery.
  // 0034 adds the created_at index for the Commune-wide count; a database
  // without it gets the same index here, inside a transaction rolled back.
  const planner = await pool.connect();
  try {
    await planner.query("BEGIN");
    await planner.query("CREATE INDEX IF NOT EXISTS invitation_email_created_idx ON public.invitation_email_deliveries (created_at)");
    await planner.query("SET LOCAL enable_seqscan = off");
    await planner.query("SET LOCAL enable_bitmapscan = off");
    const leading = Object.fromEntries((await planner.query(`SELECT c.relname, a.attname FROM pg_index i
      JOIN pg_class c ON c.oid = i.indexrelid JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = i.indkey[0]
      WHERE i.indrelid = 'public.invitation_email_deliveries'::regclass`)).rows.map((row) => [row.relname, row.attname]));
    const [{ Plan: plan }] = (await planner.query(`EXPLAIN (FORMAT JSON) ${INVITATION_LIMITS_QUERY}`, [actor, commune, "x@example.test"])).rows[0]["QUERY PLAN"];
    const scans = [];
    (function walk(node) { if (node["Relation Name"] === "invitation_email_deliveries") scans.push(node); for (const child of node.Plans ?? []) walk(child); })(plan);
    assert.equal(scans.length, 5);
    for (const scan of scans) {
      // An index read from its first column, not a whole index read through.
      assert.match(scan["Node Type"], /^Index (Only )?Scan$/);
      assert.ok(scan["Index Cond"]?.includes(leading[scan["Index Name"]]), `${scan["Index Name"]} is read in full for ${scan["Index Cond"]}`);
    }
  } finally { await planner.query("ROLLBACK"); planner.release(); }

  const parallelToken = await create("parallel@example.test");
  before = calls.length;
  const parallel = await Promise.allSettled(Array.from({ length: 4 }, () => send(actor, parallelToken)));
  assert.ok(parallel.some(result => result.status === "fulfilled"));
  assert.equal(calls.length, before + 1, "simultaneous sends dispatch only once");
  await asActor(c => c.query("UPDATE public.commune_members SET role='member' WHERE commune_id=$1 AND user_id=$2", [commune, actor]));
  await assert.rejects(send(actor, parallelToken), refusal(404), "former admins cannot send");
  console.log("Invitation email: authorization, inviter and commune naming, report link, contact-like names, suppressed addresses, new-account and Commune-wide limits, index use, provider failure/retry, deduplication, rate limit, expiry, token privacy and HTML escaping passed. No real email sent.");
} finally {
  await pool.query("DELETE FROM public.communes WHERE id = ANY($1::uuid[])", [[commune, bulkCommune].filter(Boolean)]);
  await pool.query("DELETE FROM public.email_suppressions WHERE provider_event_id LIKE 'msg_test_%'");
  await pool.query('DELETE FROM neon_auth."user" WHERE id = ANY($1::text[])', [[actor, bulkSender]]);
  await pool.end();
  await senderPool.end();
}
