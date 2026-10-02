# Commune quick search — local implementation and QA

2 October 2026. Built in the real app, not a static mockup. Not pushed or
deployed; no hosted database, provider or billing settings were changed.

## Reference and decision

Inspected Caleane's current `Calenne/app` source: `WorkspaceSearch.jsx`, its
CSS, `workspace-search.mjs`, tests and relevant server/route integration.
Its interaction is the right reference: a quick finder instead of a header
field whose meaning changes on each page. Commune keeps its existing visual
tokens, type, sidebar, switcher, account controls and record editors. No Radix
dependency or Caleane business model was copied into Commune.

Caleane's local browser URL was blocked by the in-app browser. The comparison
is source-backed, not a claim of live rendered Caleane QA. Its existing Node
test attempt hit ENOSPC before creating fixtures; it is not counted as passed.

## Implemented behaviour

- Global header button, Cmd/Ctrl-K and slash outside text fields. Does not
  interrupt an existing editor/dialog or composition input.
- Focused search input, 180ms debounce, two-character minimum and 80-character
  maximum. Closing clears the quick query; stale requests are aborted and
  obsolete responses cannot overwrite a newer query or scope.
- Explicit this-commune/all-communes scope. Home/full-search entry starts
  across owned communes; a scoped product screen starts in its current one.
- Eight grouped result kinds: communes, expenses, notes, operations, funds,
  recurring bills, members and saved splits. Up to eight per group in the
  finder; full search uses 25. Counts/truncation are explicit.
- Arrow-key selection and Enter open the exact record and commune. Expense,
  note and operation use their real reader/editor flows. Funds open the
  selected fund's detail; member/recurring/template lists reveal and focus
  the exact card without triggering a mutation.
- Escape closes the populated native search input in one press, including
  browsers that otherwise clear a search input first. Focus returns to the
  opener. Native dialog semantics retain focus containment.
- Full search preserves query and scope and uses the same search engine.
  It is not blocked on unrelated commune snapshot hydration.
- Expense status/text filters and the Notes board filter are independent of
  the global finder. Existing expense boxes, Notes board and Operations views
  are retained.
- Cross-commune record opening distinguishes pending, failed and genuinely
  missing records. It never substitutes a different record or flashes a
  missing-note error merely because its snapshot has not arrived.

## Backend and privacy

Versioned migration `0014_commune_search.sql` provides one indexed,
membership-scoped RPC. Both the local API and hosted Neon adapter use it.
Search does not download every commune snapshot to filter in the browser.
Authentication and active membership remain mandatory, including when a
specific commune ID is supplied. No broader table grants were introduced.

Private-type/access/contact note excerpts follow the existing Notes preview
policy. Fact values and member email addresses are excluded from the search
index/results; ordinary note excerpts are capped at 160 characters. This is
display/search privacy, not encrypted storage. `%`, `_` and backslash are
literal query characters, not permission-bypassing wildcard input.

The immutable excerpt helper requires a narrow authenticated EXECUTE grant
for normal writes to maintain its expression index. It only transforms its
arguments; it cannot read tables and is in the non-exposed private schema.
The first isolated test caught the missing grant before the app DB migration.

Primary technical references: [Neon Data API access control](https://neon.com/docs/data-api/access-control)
and [Neon pg_trgm](https://neon.com/docs/extensions/pg_trgm).

## Local verification

- `pnpm --filter @commune/web test --maxWorkers=1`: **124 tests, 10 files passed**.
  Includes keyboard/focus, grouping, exact IDs, scopes, malformed responses,
  debounce/abort, retry, full search, hosted-adapter RPC contract and pending
  cross-commune record opening.
- Web TypeScript/Vite production build, local API TypeScript and
  `git diff --check` pass.
- `API_BASE=http://127.0.0.1:3006 node apps/local-api/tests/search.mjs`: passed
  on the separate `commune_search_test_20261002_v1` DB. Eight record kinds,
  active/removed/outsider membership, authentication, scope, caps, archived
  exclusion, literal wildcards and safe note previews were exercised.
- Existing `workflows.mjs` also passed with migration 0014 on that isolated
  API/DB. Its snapshot timings are local HTTP evidence only, not hosted search
  or 100,000-user performance measurements.
- In-app browser against actual saved local records: shortcut/header opens;
  an expense opens the matching expense; an all-commune note switches to its
  real reader; the selected fund opens its actual detail; full search returns
  grouped results; Notes/Expenses retain separate filters; a populated finder
  closes with one Escape and focus returns to the header.
- The app DB was backed up before the additive migration at
  `/tmp/commune-search-backup.Akasnr/local-before-search.dump`. Immediately
  afterward its existing counts remained 4 users, 4 communes, 6 expenses and
  9 notes. This turn inserted no search fixtures into the app DB.
- The original Vite server remains on localhost:3000; its local API remains
  on loopback 3002. The isolated test API is not the user's app backend.

Proof: [expense search](search-01-expense.png) and
[grouped finder](search-02-groups.png).

## Release boundary and environment

The hosted adapter is prepared but has not been run against the hosted branch
in this pass. Apply numeric predecessors and migrations 0013/0014 together
with the appropriate client/sender changes, refresh the Data API schema cache,
then verify exact-record journeys and denied access with two real hosted
accounts before production rollout. Measure representative large-data and
cold/warm/idle search latency; local correctness tests are not load testing.

The Mac's disk is nearly full, and ENOSPC interrupted one test startup before
a successful single-worker rerun. No user files were deleted to free space.
Make storage headroom before dependency installation or broader release work.
