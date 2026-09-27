# Production loading investigation — 27 September 2026

Status: loading orchestration fixed; cold-connection identity loss reproduced
on a production branch and corrected by migration 0011. Production rollout
and browser results are recorded in the release PR.

## Identity root cause and fix (follow-up)

- Actual production logs captured 403 from `member_profiles` and
  `list_reminder_targets` in 127–261 ms while other reads succeeded. Another
  Home tab captured 403s in 159–175 ms after showing “No communes yet”.
- On the one-day branch `debug-membership-identity-20260927`, a new direct
  connection was given transaction-local identity claims for an existing
  member. `is_commune_member`, called as `authenticated`, returned **false**
  on first use and **true** on the initialized connection, without data changes.
- The Neon identity extension registers its claims setting lazily. First use
  inside SECURITY DEFINER can discard that setting under PostgreSQL's security
  restrictions. This reproduces the initialization trap described in
  [upstream issue 51](https://github.com/neondatabase/pg_session_jwt/issues/51).
- A pre-request initialization hook was attempted on the isolated branch,
  but the managed role cannot alter `authenticator`. That entire transaction
  was rolled back. It was never applied to production.
- Migration 0011 uses a private invoker-only reader for PostgREST's verified,
  transaction-local `request.jwt.claims.sub`. The Data API still validates JWTs
  and selects the role. No client-supplied identity is accepted. Missing or
  malformed identity raises 28000 instead of masquerading as an empty account.
  Fifteen functions and seven policies keep their existing rules and grants;
  only the identity accessor changes. No browser retries or RLS bypasses.
- This is a Data API identity adapter, not a raw-SQL authentication method.
  Database credentials remain server-only. The reminder worker retains its
  independent JWT validation; only its local test fixtures change.
- Fresh-connection branch assertions passed: members can read communes,
  profiles and reminders; nonmembers cannot; missing identity and anonymous
  access fail; direct expense INSERT remains forbidden.
- Eight existing local SQL suites passed after 0011, including UUID Auth,
  invitations, shared content, atomic creation, reminder limits and grants.
  All 27 web tests and the Vite build passed. The client now also rejects
  malformed/inconsistent membership responses rather than displaying empty.

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
- These initial warm tests predated the captured failures and cold-connection
  reproduction above; they did not establish that the problem was fixed.

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

## Remaining scope

Repeat real-browser reads after rollout and watch for recurrence. Browser
diagnostics are opt-in request traces, not continuous incident monitoring.

The per-commune snapshot still includes several unrelated features and is not
paged. Further section-level reads/batched summaries and realistic volume
benchmarks are necessary before any 100,000-user performance claim. A paid
plan alone does not fix the application's read pattern.

References: [Data API access control](https://neon.com/docs/data-api/access-control),
[Data API troubleshooting](https://neon.com/docs/data-api/troubleshooting),
[Neon latency factors](https://neon.com/faster).
