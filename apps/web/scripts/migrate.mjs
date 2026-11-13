// Applies pending migrations from infra/neon/migrations in numeric order and
// records each one in commune_release.schema_migrations inside the
// migration's own transaction. A migration that fails rolls back completely
// and stops the run, so the database is never half-migrated.
//
// Runs before `vite build` on Vercel production builds (the "build"
// script in apps/web/package.json), so the app is never deployed ahead of its database.
// It reads the connection string Vercel's Neon integration provides
// (DATABASE_URL_UNPOOLED, else DATABASE_URL). Preview and local builds skip it
// unless MIGRATE=1 is set.
//
//   node apps/web/scripts/migrate.mjs [--plan] [--baseline NNNN]
//     --plan           list pending migrations and change nothing
//     --baseline NNNN  first run only: treat 0001..NNNN as already applied.
//                      Without it, the first run works this out from one
//                      object each of 0011 to 0025 creates, and refuses if the
//                      evidence has gaps.
//
// Neon keeps point-in-time history, so the start time printed below is the
// restore point if a release has to be rolled back.
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const args = process.argv.slice(2);
const plan = args.includes("--plan");
const baselineIndex = args.indexOf("--baseline");
let baseline = baselineIndex >= 0 ? args[baselineIndex + 1] ?? "" : "";
const migrationsDir = process.env.MIGRATIONS_DIR
  ?? join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "infra", "neon", "migrations");

const vercelEnv = process.env.VERCEL_ENV;
if (process.env.MIGRATE !== "1" && vercelEnv !== "production") {
  console.log(`Skipping database migrations (${vercelEnv ? `Vercel ${vercelEnv} build` : "not a production build"}).`);
  process.exit(0);
}

const connectionString = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!connectionString) {
  console.error("No database connection string. Connect the Neon integration to this Vercel project,");
  console.error("or set DATABASE_URL_UNPOOLED. The build stops so the app is not deployed ahead of its database.");
  process.exit(1);
}
if (baseline && !/^\d{4}$/.test(baseline)) {
  console.error("--baseline must be a four-digit migration number, such as 0011");
  process.exit(2);
}

// One object each hand-applied migration created, to work out how far an
// untracked database got. Later migrations are tracked by this runner.
const MARKERS = `
WITH marker(version, present) AS (VALUES
  ('0011', to_regprocedure('commune_private.data_api_user_id()') IS NOT NULL),
  ('0012', to_regclass('public.invitation_email_deliveries') IS NOT NULL),
  ('0013', EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'commune_members' AND column_name = 'left_at')),
  ('0014', to_regprocedure('public.search_commune_records(text, uuid, integer)') IS NOT NULL),
  ('0015', to_regprocedure('public.send_reminder_command(text, uuid, uuid)') IS NOT NULL),
  ('0016', to_regclass('public.expense_share_receipts') IS NOT NULL),
  ('0017', EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'expenses' AND column_name = 'voided_at')),
  ('0018', to_regclass('public.operation_occurrences') IS NOT NULL),
  ('0019', EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'commune_operations' AND column_name = 'anchor_day')),
  ('0020', EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'commune_operations' AND column_name = 'rotation_ids')),
  ('0021', to_regclass('public.expense_share_payment_reports') IS NOT NULL),
  ('0022', EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'recurring_bill_occurrences' AND column_name = 'amount_minor')),
  ('0023', to_regclass('public.note_revisions') IS NOT NULL),
  ('0024', EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'commune_operations' AND column_name = 'turn_owner_id')),
  ('0025', to_regclass('public.commune_announcements') IS NOT NULL))
SELECT version, present FROM marker ORDER BY version`;

const files = readdirSync(migrationsDir).filter((name) => /^\d{4}_.+\.sql$/.test(name)).sort();
const client = new pg.Client({ connectionString });

function fail(message, code = 3) {
  console.error(message);
  process.exitCode = code;
  return client.end();
}

await client.connect();
try {
  const { rows: [{ now }] } = await client.query("SELECT now()");
  console.log(`Database time at start (restore point): ${now.toISOString()}`);

  const { rows: [{ tracked }] } = await client.query(
    "SELECT to_regclass('commune_release.schema_migrations') IS NOT NULL AS tracked");

  if (!tracked) {
    if (!baseline) {
      const { rows } = await client.query(MARKERS);
      let gap = false;
      for (const { version, present } of rows) {
        if (present && gap) {
          await fail(`Cannot work out the baseline: ${version} is present but an earlier migration is not. Check the database by hand and run once with --baseline NNNN.`);
          process.exit();
        }
        if (present) baseline = version; else gap = true;
      }
      if (!baseline) {
        await fail("This database does not look migrated to 0011. Run once with --baseline NNNN.");
        process.exit();
      }
      console.log(`No migration record yet. Detected that 0001 to ${baseline} are already applied.`);
    }
    if (plan) {
      console.log(`Would record 0001 to ${baseline} as already applied.`);
    } else {
      await client.query("BEGIN");
      await client.query("CREATE SCHEMA commune_release");
      await client.query("REVOKE ALL ON SCHEMA commune_release FROM PUBLIC");
      await client.query(`CREATE TABLE commune_release.schema_migrations (
        version text PRIMARY KEY CHECK (version ~ '^[0-9]{4}$'),
        name text NOT NULL,
        applied_at timestamptz NOT NULL DEFAULT now(),
        baseline boolean NOT NULL DEFAULT false)`);
      for (const name of files) {
        if (name.slice(0, 4) > baseline) break;
        await client.query(
          "INSERT INTO commune_release.schema_migrations (version, name, baseline) VALUES ($1, $2, true)",
          [name.slice(0, 4), name]);
      }
      await client.query("COMMIT");
      console.log(`Recorded 0001 to ${baseline} as already applied.`);
    }
  } else if (baseline) {
    await fail("This database already has a migration record; --baseline is only for the first run.", 2);
    process.exit();
  }

  const applied = new Set();
  if (tracked || !plan) {
    const { rows } = await client.query("SELECT version FROM commune_release.schema_migrations");
    for (const { version } of rows) applied.add(version);
  } else {
    for (const name of files) if (name.slice(0, 4) <= baseline) applied.add(name.slice(0, 4));
  }
  const pending = files.filter((name) => !applied.has(name.slice(0, 4)));

  if (!pending.length) {
    console.log("No pending migrations.");
  } else {
    console.log(`Pending migrations:\n${pending.map((name) => `  ${name}`).join("\n")}`);
    if (!plan) {
      for (const name of pending) {
        const sql = readFileSync(join(migrationsDir, name), "utf8");
        // Each migration is one BEGIN ... COMMIT. Record it just before its
        // own final COMMIT so the record and the change land together.
        const commits = sql.match(/^\s*COMMIT;\s*$/gm) ?? [];
        if (commits.length !== 1) {
          await fail(`${name} must contain exactly one COMMIT; line`, 4);
          process.exit();
        }
        const version = name.slice(0, 4);
        const recorded = sql.replace(/^\s*COMMIT;\s*$/m,
          `INSERT INTO commune_release.schema_migrations (version, name) VALUES ('${version}', '${name}');\nCOMMIT;`);
        console.log(`Applying ${name}`);
        try {
          await client.query(recorded);
        } catch (error) {
          await client.query("ROLLBACK").catch(() => {});
          await fail(`${name} failed and was rolled back: ${error.message}`, 5);
          process.exit();
        }
      }
      console.log(`Applied ${pending.length} migration(s).`);
    }
  }
} finally {
  await client.end().catch(() => {});
}
