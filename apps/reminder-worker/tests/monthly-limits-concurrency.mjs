// Run against a disposable local database with the auth stub and all
// migrations. Never point this test at a shared or production branch.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";

if (!process.env.DATABASE_URL?.includes("127.0.0.1")) {
  throw new Error("Concurrency test requires a local 127.0.0.1 DATABASE_URL");
}

const db = new Pool({ connectionString: process.env.DATABASE_URL, max: 3 });
const sender = randomUUID();
const firstRecipient = randomUUID();
const secondRecipient = randomUUID();
let commune;

async function asUser(userId, action) {
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('request.jwt.claims', json_build_object('sub', $1::text, 'role', 'authenticated')::text, true)", [userId]);
    const result = await action(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function createShare(recipient, title) {
  return asUser(sender, async (client) => {
    const created = await client.query(`
      SELECT public.create_expense($1, $2, 100, $3::jsonb, current_date) AS id
    `, [commune, title, JSON.stringify([
      { user_id: sender, amount_minor: 50 },
      { user_id: recipient, amount_minor: 50 },
    ])]);
    const share = await client.query(`
      SELECT id FROM public.expense_shares
      WHERE expense_id = $1 AND user_id = $2
    `, [created.rows[0].id, recipient]);
    return share.rows[0].id;
  });
}

try {
  commune = await asUser(sender, async (client) => {
    const result = await client.query(`
      SELECT public.create_commune('Concurrent limit test', 'household', 'GBP') AS id
    `);
    return result.rows[0].id;
  });
  // Fixture rows bypass the invitation flow, but since migration 0013 every
  // membership change is written to the history with its actor. Record the
  // commune's creator as that actor, as the invitation RPC would.
  await asUser(sender, (client) => client.query(`
    INSERT INTO public.commune_members (commune_id, user_id, role)
    VALUES ($1, $2, 'member'), ($1, $3, 'member')
  `, [commune, firstRecipient, secondRecipient]));
  const [firstShare, secondShare] = await Promise.all([
    createShare(firstRecipient, "First due share"),
    createShare(secondRecipient, "Second due share"),
  ]);
  await db.query(`
    INSERT INTO public.reminders
      (commune_id, kind, source_id, sender_user_id, recipient_user_id,
       amount_minor, created_at)
    SELECT $1, 'nudge', gen_random_uuid(), $2,
      'fixture-recipient-' || i, 50, now() - interval '2 days'
    FROM generate_series(1, 59) AS i
  `, [commune, sender]);

  const results = await Promise.allSettled([
    asUser(sender, (client) => client.query(
      "SELECT public.send_reminder('nudge', $1) AS id", [firstShare],
    )),
    asUser(sender, (client) => client.query(
      "SELECT public.send_reminder('nudge', $1) AS id", [secondShare],
    )),
  ]);
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1,
    "Exactly one concurrent request should take the last monthly slot");
  const rejected = results.find((result) => result.status === "rejected");
  assert.equal(rejected?.reason?.code, "P0001");
  assert.equal(rejected.reason.message,
    "You have reached the limit of 60 reminders in 30 days");
  const count = await db.query(`
    SELECT count(*)::integer AS count FROM public.reminders
    WHERE sender_user_id = $1 AND created_at > now() - interval '30 days'
  `, [sender]);
  assert.equal(count.rows[0].count, 60);
  console.log("Concurrent monthly limit: exactly one of two sends accepted");
} finally {
  if (commune) {
    await db.query("DELETE FROM public.communes WHERE id = $1", [commune]);
  }
  await db.end();
}
