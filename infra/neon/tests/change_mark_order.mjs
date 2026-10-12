// Change marks when two writes commit out of order (0036). A change row's id
// is handed out when the row is inserted, not when its transaction commits,
// so a write that started first can commit last with the lower id. The app
// reads a commune's snapshot only when its mark moves, so a mark that went by
// the highest id alone would miss that write until the next one. This test
// keeps the first write open while a second one commits, reads the mark,
// then commits the first and checks that the mark moved again. It also shows
// that the second write did not wait for the first.
//
// Run against a disposable local database with every migration applied, on
// top of infra/local/bootstrap.sql or infra/neon/tests/local_auth_stub.sql:
//   DATABASE_URL=postgres://commune:commune@127.0.0.1:5432/<disposable> node infra/neon/tests/change_mark_order.mjs
// It adds a commune and removes it again. Never point it at a shared or
// hosted database.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";

if (!process.env.DATABASE_URL?.includes("127.0.0.1")) {
  throw new Error("The change mark order test requires a local 127.0.0.1 DATABASE_URL");
}
// The pg driver comes from the local API's dependencies.
const { Client } = createRequire(new URL("../../../apps/local-api/package.json", import.meta.url))("pg");

const avery = randomUUID(), blake = randomUUID(), casey = randomUUID();
const connect = async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  // A wait that never ends fails the test instead of hanging it.
  await client.query("SET statement_timeout = '20s'");
  return client;
};
const owner = await connect();

// One transaction as one person, the way the local API runs a request.
async function begin(userId) {
  const client = await connect();
  await client.query("BEGIN");
  await client.query("SELECT set_config('request.jwt.sub', $1, true)", [userId]);
  await client.query("SELECT set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: userId })]);
  await client.query("SET LOCAL ROLE authenticated");
  return client;
}
async function as(userId, sql, values) {
  const client = await begin(userId);
  try {
    const result = await client.query(sql, values);
    await client.query("COMMIT");
    return result.rows[0];
  } finally {
    await client.end();
  }
}
// The mark the app compares, read the way the app reads it.
async function mark(commune) {
  const { list } = await as(avery, "SELECT public.my_communes() AS list");
  return list.find((entry) => entry.id === commune).changeMark;
}

const commune = (await as(avery, "SELECT public.create_commune('Mark order', 'household', 'GBP') AS id")).id;
const sessions = [];
try {
  await owner.query("BEGIN");
  // Fixture members skip the invitation, with Avery as the actor in the history.
  await owner.query("SELECT set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: avery })]);
  await owner.query("INSERT INTO public.commune_members (commune_id, user_id, role) VALUES ($1, $2, 'member'), ($1, $3, 'member')",
    [commune, blake, casey]);
  await owner.query("COMMIT");
  const notice = (await as(avery, "SELECT public.post_announcement($1, 'Boiler service', 'Friday morning', true, $2) ->> 'id' AS id",
    [commune, randomUUID()])).id;
  const before = await mark(commune);

  // Blake confirms the notice first and takes the lower change id, but has not committed.
  const first = await begin(blake);
  sessions.push(first);
  await first.query("SELECT public.acknowledge_announcement($1)", [notice]);
  // Casey confirms it too and commits straight away: nothing makes her wait for Blake.
  const second = await begin(casey);
  sessions.push(second);
  await second.query("SELECT public.acknowledge_announcement($1)", [notice]);
  await second.query("COMMIT");
  const between = await mark(commune);
  assert.notEqual(between, before, "A committed write did not move the mark");

  await first.query("COMMIT");
  const after = await mark(commune);
  assert.notEqual(after, between, "A write that committed after a later one did not move the mark");
  // The highest id is the same both times; only the count shows Blake's write.
  assert.equal(after.split(":")[2], between.split(":")[2], `Expected the lower id to commit last: ${between} then ${after}`);
  assert.equal(Number(after.split(":")[1]), Number(between.split(":")[1]) + 1);

  // The snapshot carries the same mark as the list.
  const { snapshot } = await as(avery, "SELECT public.commune_snapshot($1) AS snapshot", [commune]);
  assert.equal(snapshot.changeMark, after);
  console.log("change mark order passed: a write that commits after a later one still moves the mark");
} finally {
  // Ending a session rolls back anything it left open.
  await Promise.all(sessions.map((client) => client.end().catch(() => undefined)));
  await owner.query("DELETE FROM public.communes WHERE id = $1", [commune]);
  await owner.query("DELETE FROM commune_private.commune_changes WHERE commune_id = $1", [commune]);
  await owner.end();
}
