// Run against a disposable local database with local_auth_stub.sql and all
// migrations applied. Never point this test at a shared or production branch.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import { Pool } from "pg";

if (!process.env.DATABASE_URL?.includes("127.0.0.1")) {
  throw new Error("Integration test requires a local 127.0.0.1 DATABASE_URL");
}
process.env.RESEND_API_KEY = "test-only";
process.env.RESEND_FROM = "Commune <test@example.test>";
process.env.APP_URL = "https://example.test";
process.env.NEON_AUTH_BASE_URL = "https://auth.example.test/neondb/auth";
process.env.NEON_AUTH_JWKS_URL = "https://auth.example.test/jwks";

const { publicKey, privateKey } = await generateKeyPair("EdDSA");
const publicJwk = await exportJWK(publicKey);
publicJwk.kid = "local-test";

const { default: worker } = await import("../src/index.ts");
const db = new Pool({ connectionString: process.env.DATABASE_URL });
const suffix = randomUUID();
const alice = randomUUID();
const bob = randomUUID();
let providerCalls = [];
let providerStatus = 503;
let testCommune;

globalThis.fetch = async (url, init) => {
  if (String(url) === process.env.NEON_AUTH_JWKS_URL) {
    return Response.json({ keys: [publicJwk] });
  }
  assert.equal(String(url), "https://api.resend.com/emails");
  providerCalls.push({
    payload: JSON.parse(init.body),
    key: init.headers["Idempotency-Key"],
  });
  return new Response(JSON.stringify(providerStatus === 200
    ? { id: `mail-${providerCalls.length}` }
    : { message: "simulated outage" }), {
    status: providerStatus,
    headers: { "Content-Type": "application/json" },
  });
};

async function signedToken(userId, verified = true) {
  return new SignJWT({ emailVerified: verified })
    .setProtectedHeader({ alg: "EdDSA", kid: "local-test" })
    .setSubject(userId)
    .setIssuer("https://auth.example.test")
    .setAudience("https://auth.example.test")
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(privateKey);
}

async function dispatchReminder(reminderId, token, origin = "https://example.test") {
  return worker.fetch(new Request("https://example.test/dispatch", {
    method: "POST",
    headers: {
      Origin: origin,
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ reminderId }),
  }));
}

async function asUser(userId, action) {
  const connection = await db.connect();
  try {
    await connection.query("BEGIN");
    await connection.query("SELECT set_config('request.jwt.sub', $1, true)", [userId]);
    const result = await action(connection);
    await connection.query("COMMIT");
    return result;
  } catch (error) {
    await connection.query("ROLLBACK");
    throw error;
  } finally {
    connection.release();
  }
}

async function runWorker() {
  const response = await worker.fetch(new Request("https://example.test/", {
    method: "POST",
    headers: { "x-neon-trigger-invocation-id": "local-test" },
  }));
  assert.equal(response.status, 200);
}

async function outbox(reminderId) {
  const { rows } = await db.query(
    "SELECT * FROM public.reminder_email_outbox WHERE reminder_id = $1",
    [reminderId],
  );
  return rows[0];
}

let testExitCode = 0;
try {
  // Hosted Managed Better Auth uses UUID ids. Keep this disposable local stub
  // representative without changing the text-id stub used by other SQL tests.
  await db.query(`
    ALTER TABLE neon_auth."user" ALTER COLUMN id TYPE uuid USING id::uuid
  `);
  const existing = await db.query(`
    SELECT count(*)::integer AS count FROM public.reminder_email_outbox
    WHERE status IN ('pending', 'failed', 'sending') AND attempts < 5
  `);
  assert.equal(existing.rows[0].count, 0,
    "Run this integration test against a fresh disposable database");
  await db.query(`
    INSERT INTO neon_auth."user" (id, name, email, "emailVerified")
    VALUES ($1, 'Alice', $2, true), ($3, 'Bob', $4, true)
  `, [alice, `alice+${suffix}@example.test`, bob, `bob+${suffix}@example.test`]);
  const commune = await asUser(alice, async (client) => {
    const result = await client.query(
      "SELECT public.create_commune('Test house', 'household', 'GBP') AS id",
    );
    return result.rows[0].id;
  });
  testCommune = commune;
  await db.query(`
    INSERT INTO public.commune_members (commune_id, user_id, role)
    VALUES ($1, $2, 'member')
  `, [commune, bob]);

  async function createShare(title) {
    return asUser(alice, async (client) => {
      const created = await client.query(`
        SELECT public.create_expense($1, $2, 10000, $3::jsonb,
          current_date) AS id
      `, [commune, title, JSON.stringify([
        { user_id: alice, amount_minor: 5000 },
        { user_id: bob, amount_minor: 5000 },
      ])]);
      const share = await client.query(`
        SELECT id FROM public.expense_shares
        WHERE expense_id = $1 AND user_id = $2
      `, [created.rows[0].id, bob]);
      return share.rows[0].id;
    });
  }

  async function makeNudge(title) {
    const shareId = await createShare(title);
    const reminderId = await asUser(alice, async (client) => {
      const result = await client.query(
        "SELECT public.send_reminder('nudge', $1) AS id", [shareId],
      );
      return result.rows[0].id;
    });
    return { shareId, reminderId };
  }

  async function makeChase(name, contributionBeforeReminder = 0) {
    const fundId = await asUser(alice, async (client) => {
      const result = await client.query(
        "SELECT public.create_fund($1, $2, 20000) AS id",
        [commune, name],
      );
      return result.rows[0].id;
    });
    const commitmentId = await asUser(bob, async (client) => {
      const result = await client.query(
        "SELECT public.pledge_fund($1, 10000, current_date) AS id",
        [fundId],
      );
      return result.rows[0].id;
    });
    if (contributionBeforeReminder) {
      await asUser(alice, (client) => client.query(
        "SELECT public.record_fund_contribution($1, $2)",
        [commitmentId, contributionBeforeReminder],
      ));
    }
    const reminderId = await asUser(alice, async (client) => {
      const result = await client.query(
        "SELECT public.send_reminder('chase', $1) AS id", [commitmentId],
      );
      return result.rows[0].id;
    });
    return { commitmentId, reminderId };
  }

  async function ageReminder(reminderId) {
    await db.query(`
      UPDATE public.reminders SET created_at = now() - interval '2 days'
      WHERE id = $1
    `, [reminderId]);
  }

  // A failed attempt freezes the body. Opting out before retry suppresses it.
  const first = await makeNudge('Gas <img src=x onerror="alert(1)"> & Tea');
  await runWorker();
  assert.equal((await outbox(first.reminderId)).status, "failed");
  assert.equal(providerCalls.length, 1);
  assert.deepEqual((await outbox(first.reminderId)).payload,
    providerCalls[0].payload, "The exact request must be frozen before sending");
  assert.match(providerCalls[0].payload.html, /#2d6a4f/);
  assert.match(providerCalls[0].payload.html,
    /Gas &lt;img src=x onerror=&quot;alert\(1\)&quot;&gt; &amp; Tea/);
  assert.doesNotMatch(providerCalls[0].payload.html, /<img\b/i);
  assert.match(providerCalls[0].payload.text,
    /Gas <img src=x onerror="alert\(1\)"> & Tea/);
  await db.query(`
    INSERT INTO public.notification_preferences (user_id, email_reminders)
    VALUES ($1, false)
  `, [bob]);
  await db.query(`
    UPDATE public.reminder_email_outbox SET next_attempt_at = now()
    WHERE reminder_id = $1
  `, [first.reminderId]);
  await runWorker();
  assert.equal((await outbox(first.reminderId)).status, "suppressed");
  assert.equal(providerCalls.length, 1);

  // A partial contribution after a failed send invalidates its frozen amount.
  await db.query(`
    UPDATE public.notification_preferences SET email_reminders = true
    WHERE user_id = $1
  `, [bob]);
  await ageReminder(first.reminderId);
  const second = await makeChase("Deposit");
  await runWorker();
  assert.equal(providerCalls.length, 2);
  await asUser(alice, (client) => client.query(
    "SELECT public.record_fund_contribution($1, 4000)",
    [second.commitmentId],
  ));
  await db.query(`
    UPDATE public.reminder_email_outbox SET next_attempt_at = now()
    WHERE reminder_id = $1
  `, [second.reminderId]);
  await runWorker();
  assert.equal((await outbox(second.reminderId)).status, "suppressed");
  assert.equal(providerCalls.length, 2);

  // A contribution before the first send is reflected in the email amount.
  await ageReminder(second.reminderId);
  const third = await makeChase("New fund", 4000);
  providerStatus = 200;
  assert.equal((await dispatchReminder(third.reminderId)).status, 401,
    "A public caller cannot start delivery");
  assert.equal((await dispatchReminder(third.reminderId, await signedToken(bob))).status, 404,
    "The recipient cannot dispatch someone else's reminder");
  assert.equal((await dispatchReminder(third.reminderId, await signedToken(alice, false))).status, 401,
    "An unverified account cannot dispatch email");
  assert.equal((await dispatchReminder(third.reminderId, await signedToken(alice),
    "https://another-site.test")).status, 403,
  "A different website cannot call the browser route");
  const immediate = await dispatchReminder(third.reminderId, await signedToken(alice));
  assert.equal(immediate.status, 200);
  assert.equal((await immediate.json()).processed, true);
  assert.equal((await outbox(third.reminderId)).status, "sent");
  const sentCount = providerCalls.length;
  assert.equal((await dispatchReminder(third.reminderId, await signedToken(alice))).status, 200);
  assert.equal(providerCalls.length, sentCount, "A repeated dispatch must not duplicate email");
  assert.match(providerCalls.at(-1).payload.text, /£60\.00/);
  assert.match(providerCalls.at(-1).payload.html, /£60\.00/);
  assert.match(providerCalls.at(-1).payload.html, /Outstanding fund pledge/);
  assert.equal(providerCalls.at(-1).key,
    `commune-reminder/${third.reminderId}`);

  // Crossing the 23-hour retry limit must not expire a freshly claimed send.
  // A crashed final claim can expire once its lease is stale.
  await db.query(`
    UPDATE public.reminder_email_outbox
      SET status = 'sending', attempts = 5,
          created_at = now() - interval '24 hours', updated_at = now()
      WHERE reminder_id = $1
  `, [third.reminderId]);
  await runWorker();
  assert.equal((await outbox(third.reminderId)).status, "sending");
  await db.query(`
    UPDATE public.reminder_email_outbox
      SET updated_at = now() - interval '6 minutes'
      WHERE reminder_id = $1
  `, [third.reminderId]);
  await runWorker();
  assert.equal((await outbox(third.reminderId)).status, "failed");

  // Chase must read a contribution committed while it waited for the pledge
  // lock, rather than use the snapshot from its original SELECT statement.
  await ageReminder(third.reminderId);
  const lockFund = await asUser(alice, async (client) => {
    const result = await client.query(
      "SELECT public.create_fund($1, 'Lock test', 20000) AS id",
      [commune],
    );
    return result.rows[0].id;
  });
  const lockCommitment = await asUser(bob, async (client) => {
    const result = await client.query(
      "SELECT public.pledge_fund($1, 10000, current_date) AS id",
      [lockFund],
    );
    return result.rows[0].id;
  });
  const locker = await db.connect();
  const sender = await db.connect();
  let lockReminder;
  try {
    await locker.query("BEGIN");
    await locker.query("SELECT set_config('request.jwt.sub', $1, true)", [alice]);
    await locker.query(
      "SELECT id FROM public.fund_commitments WHERE id = $1 FOR UPDATE",
      [lockCommitment],
    );
    await locker.query(
      "SELECT public.record_fund_contribution($1, 4000)",
      [lockCommitment],
    );
    await sender.query("BEGIN");
    await sender.query("SELECT set_config('request.jwt.sub', $1, true)", [alice]);
    const pendingSend = sender.query(
      "SELECT public.send_reminder('chase', $1) AS id", [lockCommitment],
    );
    let blocked = false;
    for (let retry = 0; retry < 80; retry += 1) {
      const state = await db.query(`
        SELECT wait_event_type FROM pg_stat_activity WHERE pid = $1
      `, [sender.processID]);
      if (state.rows[0]?.wait_event_type === "Lock") {
        blocked = true;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    assert.equal(blocked, true, "Chase did not wait for the pledge lock");
    await locker.query("COMMIT");
    lockReminder = (await pendingSend).rows[0].id;
    await sender.query("COMMIT");
  } finally {
    await locker.query("ROLLBACK");
    await sender.query("ROLLBACK");
    locker.release();
    sender.release();
  }
  const lockedAmount = await db.query(
    "SELECT amount_minor FROM public.reminders WHERE id = $1",
    [lockReminder],
  );
  assert.equal(lockedAmount.rows[0].amount_minor, "6000");

  // Two distinct expenses cannot evade the per-recipient daily cap by racing.
  await ageReminder(lockReminder);
  const shareA = await createShare("Rate test A");
  const shareB = await createShare("Rate test B");
  const sends = await Promise.allSettled([shareA, shareB].map((shareId) =>
    asUser(alice, async (client) => {
      const result = await client.query(
        "SELECT public.send_reminder('nudge', $1) AS id", [shareId],
      );
      return result.rows[0].id;
    }),
  ));
  assert.equal(sends.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(sends.filter((result) =>
    result.status === "rejected" && result.reason.code === "P0001").length, 1);

  // The retry sweep must clear more than the old ten-email ceiling in a run.
  const batchIds = [];
  for (let index = 0; index < 12; index += 1) {
    const shareId = await createShare(`Batch ${index}`);
    const inserted = await db.query(`
      INSERT INTO public.reminders
        (commune_id, kind, source_id, sender_user_id, recipient_user_id, amount_minor)
      VALUES ($1, 'nudge', $2, $3, $4, 5000)
      RETURNING id
    `, [commune, shareId, alice, bob]);
    const reminderId = inserted.rows[0].id;
    batchIds.push(reminderId);
    await db.query(`
      INSERT INTO public.reminder_email_outbox (reminder_id) VALUES ($1)
    `, [reminderId]);
  }
  await runWorker();
  const batch = await db.query(`
    SELECT count(*)::integer AS count FROM public.reminder_email_outbox
    WHERE reminder_id = ANY($1::uuid[]) AND status = 'sent'
  `, [batchIds]);
  assert.equal(batch.rows[0].count, 12);

  console.log("Reminder worker integration checks passed");
} catch (error) {
  console.error(error);
  testExitCode = 1;
} finally {
  if (testCommune) {
    await db.query("DELETE FROM public.communes WHERE id = $1", [testCommune]);
  }
  await db.query("DELETE FROM neon_auth.\"user\" WHERE id IN ($1, $2)",
    [alice, bob]);
  await db.end();
  // The production worker deliberately keeps its module-scope pool alive.
  process.exit(testExitCode);
}
