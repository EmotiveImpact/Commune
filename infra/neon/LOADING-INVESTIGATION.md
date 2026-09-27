# Production loading investigation — 27 September 2026

Status: loading orchestration defects reproduced and fixed; intermittent
`Not a commune member` rejection remains unproven and must not be called fixed.

## Evidence

- Production commit `b14fbb7` has browser-local request diagnostics. Open a
  product URL with `?diagnostics=1`. Logs contain resource names, HTTP status,
  and duration only, not tokens, filters, row contents or personal identifiers.
- Six warm reloads succeeded. Initial session reads were around 139–490 ms;
  individual data calls were about 119–375 ms. Warm success is not proof that
  the reported intermittent failure is resolved.
- After leaving the product for more than five minutes, the first session
  check took 828 ms and data calls took 124–355 ms. All succeeded. Compute
  suspension was not independently observed, so this is an idle-load test,
  not a claim that a database cold start was definitely measured.
- The production `is_commune_member(uuid)` function is STABLE, SECURITY
  DEFINER, owned by neondb_owner, with a fixed search_path. It checks the
  commune ID and `m.user_id = auth.user_id()`. `member_profiles(uuid)` uses
  that guard and the managed Auth UUID-to-text join from migration 0008.
- No failed authenticated request has yet been captured with the new
  diagnostics. No grant, RLS rule, auth provider, billing plan or database
  setting was changed during this investigation.

## Reproduced application defects

1. Every product page fetched a full snapshot for every commune. Each snapshot
   started eight reads, then dependent expense/fund reads. More communes
   multiplied the work even when only one was open.
2. Home withheld every card until every snapshot finished. One failure or
   slow commune blocked the whole overview despite having verified names and
   addresses available.
3. A single global error controlled the active commune's loading panel.
   An invitation failure could say the commune itself failed to load.

Regression tests reproduce all three against the previous implementation.
The revised loader reads the selected commune, deduplicates concurrent reads,
reuses recently loaded in-memory snapshots for 15 seconds on navigation, and
progressively fills overview cards. Mutations explicitly force fresh reads.
No private ledger is persisted to browser storage. Permission failures remove
that commune's cached activity rather than quietly showing stale private data.
Unknown balances and partial overviews never claim zero, even, or nothing due.

## Verification

- `pnpm --dir apps/web test`: 22 tests passed, including delayed/failing
  snapshots, cross-commune isolation, selection races, changed accounts,
  permission revocation, creation, and refresh preservation.
- A transport-contract test uses the actual installed Neon SDK with a fake
  HTTP transport. Three concurrent reads share one session bootstrap, carry
  the expected JWT, and obtain a renewed JWT after advancing past expiry.
  This tests SDK behavior, not hosted Postgres identity propagation.
- `pnpm --dir apps/web build`: passed.
- Local browser: two real PostgreSQL-backed communes retain names, addresses,
  members, expense balances and navigation. No production data was changed.

## Still required

Capture a failing production request before changing authentication. Record
the failing resource/status/timing and distinguish `member_profiles` from
`list_reminder_targets`. Then compare the verified subject with the database
membership under the same request context. Do not bypass RLS, automatically
recreate membership, or silently retry 403s to hide the failure.

The per-commune snapshot still includes several unrelated features and is not
paged. Further section-level reads/batched summaries and realistic volume
benchmarks are necessary before any 100,000-user performance claim. A paid
plan alone does not fix the application's read pattern.

References: [Data API access control](https://neon.com/docs/data-api/access-control),
[Data API troubleshooting](https://neon.com/docs/data-api/troubleshooting),
[Neon latency factors](https://neon.com/faster).
