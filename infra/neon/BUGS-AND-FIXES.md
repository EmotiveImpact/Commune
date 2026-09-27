# Bugs and fixes

Last updated: 27 September 2026. This register distinguishes verified fixes
from unfinished work; it is not a full product release sign-off.

## Fixed: valid members appeared to have no communes

**Symptoms:** intermittent “No communes yet”, “Not a commune member”, and
activity failing to load despite an existing saved commune.

**Cause:** on a fresh database connection, the identity extension's lazy
initialization inside a SECURITY DEFINER function could discard the request
identity. Membership checks then denied a valid member, and RLS could return
an empty list. This was an identity bug, not evidence that the Data API was
inherently too slow or that the user's data had been deleted.

**Fix:** migration `0011_request_identity.sql` reads the Data API's verified
transaction-local identity through a private helper. Existing membership
rules, grants and RLS remain enforced. Missing identity now fails explicitly;
the client also rejects malformed or inconsistent commune/membership results.

**Released:** PR 18, main `cbb7e29`, production `app.ourcommune.io`.
Fresh browser reads and isolated fresh-connection authorization tests passed.
Full evidence and limitations: [loading investigation](LOADING-INVESTIGATION.md).

## Fixed: unnecessary all-commune loading and unrelated error coupling

The loader previously requested every commune's full activity on every page,
blocked Home on all snapshots, and let unrelated request failures control the
selected commune's error state. It now loads the selected commune first,
progressively fills Home, deduplicates requests and reuses fresh in-memory
snapshots for 15 seconds. Refreshes preserve previously verified data;
permission failures remove the affected private snapshot.

## Open: intrusive initial loading and oversized screen reads

**Implemented locally, not yet released:** the full-page “Opening Commune…”
message has been replaced with the public app layout and quiet, static
placeholders. It renders no account data or interactive account controls
before verification. All 28 web tests and the production build pass. This
removes the splash screen; it does not claim to reduce network latency.

**Current behavior:** a fresh visit waits for authentication, then membership,
then activity. The full-page “Opening Commune…” state precedes section
loading. The in-memory cache does not survive a reload. Each snapshot still
reads unrelated features and unpaged collections.

**Next implementation, in order:**

1. Verify in the browser and release the replacement of the blank full-page loader with a stable, responsive shell and
   page-shaped placeholders. Before authentication, show no private names,
   balances or controls that assume membership. Announce loading accessibly.
2. Keep already verified content mounted during background refreshes. Never
   turn a pending or failed request into “no communes”, zero balances or an
   empty ledger. Re-check account changes and revoked membership in tests.
3. Split full snapshots into selected-screen reads and lightweight Home
   summaries; invalidate affected queries after writes. Preserve authorization
   checks and do not persist private ledger data merely to disguise latency.
4. Measure fresh visits, warm navigation, idle returns and multi-commune
   accounts before and after the changes. Record request counts and user-visible
   ready times, not just build times or a single successful request.

**Acceptance:** no false empty-state flash; no full-screen loading replacement
on normal navigation to recently loaded data; explicit retry on real failures;
no private-data leakage across accounts; fewer unrelated requests per screen.
Agree a measured latency budget after collecting representative baseline
samples. A paid service plan or animated skeleton alone is not this fix.

**Not yet verified:** continuous failure monitoring, realistic high-volume
benchmarks and 100,000-user capacity. The production smoke test is not proof
of any of these.
