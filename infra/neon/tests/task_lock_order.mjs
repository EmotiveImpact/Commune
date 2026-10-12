// Lock order between a member leaving and the task commands (0027, 0037).
// A member leaving locks the commune and then that member's tasks. A command
// that locked the task first and then needed the commune (adding a history
// line or an occurrence takes a key-share lock on it) would wait on the
// leaving member while the leaving member waited on it, until PostgreSQL
// cancelled one of them as a deadlock. Every task command now locks the
// commune first: editing and removing since 0027; completing, skipping,
// handing over and undoing since 0037. For each command, this test holds the
// departure at the point between its two locks, starts the command, then
// lets both run, so that interleaving happens every time. The command then
// finds the task as the departure left it, and goes ahead or is refused with
// its usual message.
//
// Run against a disposable local database with every migration applied, on
// top of infra/local/bootstrap.sql or infra/neon/tests/local_auth_stub.sql:
//   DATABASE_URL=postgres://commune:commune@127.0.0.1:5432/<disposable> node infra/neon/tests/task_lock_order.mjs
// It adds a commune for each command and removes it again. Never point it at
// a shared or hosted database.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";

if (!process.env.DATABASE_URL?.includes("127.0.0.1")) {
  throw new Error("The lock order test requires a local 127.0.0.1 DATABASE_URL");
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
  const { rows } = await client.query("SELECT pg_backend_pid() AS pid");
  return { client, pid: rows[0].pid };
}
async function as(userId, sql, values) {
  const { client } = await begin(userId);
  try {
    const result = await client.query(sql, values);
    await client.query("COMMIT");
    return result.rows[0];
  } finally {
    await client.end();
  }
}
async function waitingForLock(pid) {
  for (let attempt = 0; attempt < 400; attempt += 1) {
    const { rows } = await owner.query("SELECT wait_event_type FROM pg_stat_activity WHERE pid = $1", [pid]);
    if (rows[0]?.wait_event_type === "Lock") return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`Session ${pid} never waited for a lock`);
}
const settle = (promise) => promise.then((result) => ({ result }), (error) => ({ error }));
// A session ends its transaction as soon as its statement settles. A session
// cancelled as a deadlock then lets the other one finish at once.
async function finish(client, outcome) {
  const settled = await outcome;
  await client.query(settled.error ? "ROLLBACK" : "COMMIT");
  return settled;
}

// Avery runs the commune. Casey added a weekly task that is Blake's turn,
// then Blake is removed while Casey acts on the task. A command's prepare
// step runs before the race and returns its values; otherwise the only
// value is the task.
async function race(command) {
  const commune = (await as(avery, "SELECT public.create_commune('Lock order', 'household', 'GBP') AS id")).id;
  const sessions = [];
  try {
    await owner.query("BEGIN");
    // Fixture members skip the invitation, with Avery as the actor in the history.
    await owner.query("SELECT set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: avery })]);
    await owner.query("INSERT INTO public.commune_members (commune_id, user_id, role) VALUES ($1, $2, 'member'), ($1, $3, 'member')",
      [commune, blake, casey]);
    await owner.query("COMMIT");
    const task = (await as(casey, `SELECT public.create_operation($1, 'task', 'chore', 'Bins', current_date, NULL, true, $2,
      jsonb_build_array($2::text, $3::text), 'weekly', '', $4) ->> 'id' AS id`, [commune, blake, casey, randomUUID()])).id;
    const values = command.prepare ? await command.prepare(task) : [task];

    // Hold Blake's membership row, so the departure stops after locking the commune.
    const holder = await connect();
    sessions.push(holder);
    await holder.query("BEGIN");
    await holder.query("SELECT 1 FROM public.commune_members WHERE commune_id = $1 AND user_id = $2 FOR UPDATE", [commune, blake]);
    const leaving = await begin(avery);
    sessions.push(leaving.client);
    const left = settle(leaving.client.query("SELECT public.manage_commune_member($1, $2, 'remove')", [commune, blake]));
    await waitingForLock(leaving.pid);
    const changing = await begin(casey);
    sessions.push(changing.client);
    const changed = settle(changing.client.query(command.sql, values));
    await waitingForLock(changing.pid);
    await holder.query("COMMIT");

    const [departure, change] = await Promise.all([finish(leaving.client, left), finish(changing.client, changed)]);
    for (const outcome of [departure, change]) {
      assert.notEqual(outcome.error?.code, "40P01", `${command.name} and a member leaving deadlocked: ${outcome.error?.message}`);
    }
    assert.equal(departure.error, undefined, departure.error?.message);
    const { rows } = await owner.query(`SELECT assignee_id, rotation_ids, turn_owner_id, title, date - current_date AS due_in,
      status, version, deleted_at FROM public.commune_operations WHERE id = $1`, [task]);
    return { change, row: rows[0] };
  } finally {
    // Ending a session rolls back anything it left open.
    await Promise.all(sessions.map((client) => client.end().catch(() => undefined)));
    await owner.query("ROLLBACK");
    await owner.query("DELETE FROM public.communes WHERE id = $1", [commune]);
  }
}

try {
  // The edit waits for the departure, then finds the task moved on to Casey
  // and is refused as stale rather than putting Blake back.
  const edit = await race({ name: "An edit", sql: `SELECT public.update_operation($1, 1, 'task', 'chore', 'Bins and recycling',
    current_date, NULL, true, NULL, NULL, 'none', '')` });
  assert.equal(edit.change.error?.code, "P0001", edit.change.error?.message ?? "The stale edit was saved");
  assert.equal(edit.change.error.message, "This task was changed by someone else. Review the latest version before saving your changes.");
  assert.deepEqual([edit.row.assignee_id, edit.row.rotation_ids, edit.row.title, edit.row.version], [casey, [casey], "Bins", 2]);

  // The removal waits for the departure, then removes the task.
  const removal = await race({ name: "A removal", sql: "SELECT public.remove_operation($1)" });
  assert.equal(removal.change.error, undefined, removal.change.error?.message);
  assert.notEqual(removal.row.deleted_at, null);
  assert.deepEqual([removal.row.assignee_id, removal.row.version], [casey, 3]);

  // The completion waits for the departure, then completes the turn that has
  // passed to Casey, the only person left in the rotation.
  const completion = await race({ name: "A completion",
    sql: "SELECT public.record_operation_occurrence($1, 'completed', current_date, current_date, $2)",
    prepare: (task) => [task, randomUUID()] });
  assert.equal(completion.change.error, undefined, completion.change.error?.message);
  assert.deepEqual([completion.row.assignee_id, completion.row.rotation_ids, completion.row.due_in, completion.row.status,
    completion.row.version], [casey, [casey], 7, "open", 3]);

  // The skip waits for the departure, then moves Casey's turn on a week.
  const skip = await race({ name: "A skip",
    sql: "SELECT public.record_operation_occurrence($1, 'skipped', current_date, current_date, $2)",
    prepare: (task) => [task, randomUUID()] });
  assert.equal(skip.change.error, undefined, skip.change.error?.message);
  assert.deepEqual([skip.row.assignee_id, skip.row.rotation_ids, skip.row.due_in, skip.row.status, skip.row.version],
    [casey, [casey], 7, "open", 3]);

  // Casey offers to take Blake's turn. The handover waits for the departure,
  // then finds the turn already passed to Casey and is refused as stale.
  const handover = await race({ name: "A handover",
    sql: "SELECT public.hand_over_operation($1, $2, current_date, $3, current_date, NULL, $4)",
    prepare: (task) => [task, casey, blake, randomUUID()] });
  assert.equal(handover.change.error?.code, "P0001", handover.change.error?.message ?? "The stale handover was saved");
  assert.equal(handover.change.error.message, "This task has already moved on. Refresh to see who has it now.");
  assert.deepEqual([handover.row.assignee_id, handover.row.turn_owner_id, handover.row.due_in, handover.row.version],
    [casey, null, 0, 2]);

  // Casey completed Blake's turn, so the next one is Casey's. Undoing that
  // would give the task back to Blake: the undo waits for the departure, then
  // is refused because Blake has left, and the task stays with Casey.
  const undo = await race({ name: "An undo", sql: "SELECT public.undo_operation_occurrence($1)",
    prepare: async (task) => [(await as(casey, `SELECT public.record_operation_occurrence($1, 'completed', current_date,
      current_date, $2) ->> 'id' AS id`, [task, randomUUID()])).id] });
  assert.equal(undo.change.error?.code, "P0001", undo.change.error?.message ?? "The undo gave the task back to Blake");
  assert.equal(undo.change.error.message,
    "The person who had this task has left, so it can no longer be undone. Edit the task instead.");
  assert.deepEqual([undo.row.assignee_id, undo.row.rotation_ids, undo.row.due_in, undo.row.status, undo.row.version],
    [casey, [casey], 7, "open", 3]);
  console.log("task lock order passed: a member leaving and a task edit, removal, completion, skip, handover or undo wait in turn");
} finally {
  await owner.end();
}
