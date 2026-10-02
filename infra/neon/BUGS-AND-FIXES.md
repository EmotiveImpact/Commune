# Bugs and fixes

Last updated: 2 October 2026. This register distinguishes verified fixes
from unfinished work; it is not a full product release sign-off.

## Local search consistency and cross-commune record opening

The header formerly changed meaning by page (note filter, expense filter or
cross-commune snapshot search). It now opens one keyboard-accessible quick
finder, adapted from Caleane's interaction and styled with Commune tokens.
Expenses/Notes retain independent local filters. Migration 0014 supplies a
single membership-scoped indexed RPC; it does not widen table grants. Private
note bodies/facts and member email addresses stay out of results. Lists have
per-section caps and report truncation instead of pretending to be exhaustive.

The native search input consumed the first Escape to clear its text. Explicit
keyboard handling now closes a populated finder in one press and restores the
opener's focus; browser verification and a regression test cover this case.

Browser verification caught a false “That note isn’t here” flash when search
switched to a commune whose snapshot had not arrived. Selected-record windows
now distinguish pending/error from genuine absence; exact IDs remain intact.
The initial index test also caught missing EXECUTE permission on the immutable
excerpt helper during normal note insertion. The helper now has the narrow
authenticated permission needed to maintain the index; no table access or
public RPC exposure is added by this helper.

Verified on local PostgreSQL and the local browser only. Production requires
0013/0014 on its branch, Data API schema-cache refresh and hosted two-account
verification before deploying this client. See the
[dated search QA report](../../artifacts/workflow-qa-2026-10-02/search-review.md).

## Local implementation: scope, shared workflows and read/write consistency

Home now features the selected commune while preserving its large/small-card
layout. Its activity and search span communes and sort by event time; scoped
pages retain the exact record ID. Missing IDs cannot fall through to another
expense. The `*-empty` routes redirect to stable product routes.

Recurring, saved splits, actual payer/category selection, fund editing/archive/
restore, pledge editing/cancellation, contribution correction history and
member role/leave/remove flows now use validated Postgres RPCs, not placeholders.
Last-admin and unresolved-obligation guards preserve access and money history.
The sender rechecks active membership and revised obligations. Billing,
automatic charges and hosted delivery are not claimed by this implementation.

Writes re-read only the affected commune. Per-account/commune read revisions
prevent an older in-flight response from overwriting a newer saved snapshot.
If a write committed but refresh failed, the UI reports a refresh failure
without offering a duplicate create. Permission failures clear private cache.

Funds detail/Chase focus restoration was fixed after browser QA found the
pledge row remounting on each state change. Recurring confirmation returns
focus within the same card if its trigger disappears after recording. Disabled
actions are visibly disabled. Duplicate mobile-web Notes search was removed;
native mode retains its search when the global field is absent.

Verification and paired hosted release requirements are in the
[2 October workflow record](../../docs/WORKFLOW-COMPLETION-2026-10-02.md).

## Local fix: reminder allowance belongs to the account

Moved the aggregate reminder counter out of Funds and Settle toolbars into
the sidebar beneath the profile, plus the Settings profile card for mobile.
The sidebar details open upward; Settings expands inline. Escape closes the
details and returns focus. Existing rolling totals, limits, and per-recipient
Nudge/Chase counters are unchanged; no extra API request was added.

Verified locally in the in-app browser on desktop and at 392px mobile width
(no horizontal overflow), with 45 web tests and the production build passing.
Three regressions cover toolbar removal, account placement and Escape. Not
pushed or deployed as part of this change.

## Local implementation: invitations can be sent by email

The previous Invite dialog only created a link and explicitly sent no email.
It now offers Send invitation, a separate link-only path, confirmed provider
acceptance, failure/retry and retained copyable links. The authenticated Neon
sender route reuses Resend with admin checks, expiry checks, durable send
deduplication and rate limits. Migration 0012 and the sender/frontend rollout
are still required on hosted branches; real inbox delivery is not yet tested.
See [invitation email implementation and release checklist](INVITATION-EMAIL.md).

## Local fixes: screen and dialog consistency

**Contact editor follow-up:** landlord-only notes replaced by Contacts with
custom person/business and role, phone/email, and optional prose. Legacy
Landlord records remain readable and editable without losing their fields.
Shared checkbox sizing and label typography corrected; Hub previews now
use the same privacy-safe rendering policy as the Notes board. 39 web tests
and build pass. No schema, grants or production changes. See the
[window review](../../audit/2026-09-27/window-review.md).

Local review corrected unrelated expense subtitles on non-money screens,
page headings changing behind dialogs, misleading Pinned empty-state copy,
and a search label broader than its actual expense-search scope. Note form
copy is shorter, selection state is exposed to assistive technology, and
new note previews use the note body instead of arbitrary metadata.

Dialogs now take keyboard focus, wrap Tab navigation, make background
controls inert and restore focus when closed. Local note creation and reload
passed; 30 web tests and the production build passed. These changes are not
yet deployed. Evidence and remaining functional gaps are in the
[local screen review](../../audit/2026-09-27/README.md).

## Implemented locally: Notes board and saved-note actions

The approved pinned-first Notes board replaces the single list. Saved notes
open in an inline desktop reader or full-screen phone reader. Edit and pin/
unpin now use the existing authenticated note update endpoint; no database
grants or membership rules changed. Search is scoped to Notes, independent
of expense search. Private-type previews exclude access/contact details;
password/code fields are masked until revealed and support copy feedback.
This is display privacy, not encrypted storage.

Creation, edit, pin/unpin and reload were tested against the local database.
35 web tests and the production build passed. Mobile sizing and missing-note
recovery were fixed during QA. No production deployment in this pass.
Evidence and limits: [Notes design QA](../../design-qa.md).

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

## Local fix; hosted measurement open: loading and oversized screen reads

**Implemented locally, not yet released:** the full-page “Opening Commune…”
message has been replaced with the public app layout and quiet, static
placeholders. It renders no account data or interactive account controls
before verification. All 28 web tests and the production build pass. This
removes the splash screen; it does not claim to reduce network latency.

**Current local behavior (2 October):** authentication and membership still
precede private activity. The shell stays in place, known commune identity is
retained, and the old “Opening Commune…” splash is absent. The hosted adapter
now calls one membership-guarded `commune_snapshot` RPC per selected commune
rather than awaiting individual table reads in sequence. Unrelated communes
load progressively only where needed. The in-memory cache does not survive a
reload, intentionally; no private ledger data was added to persistent storage.
Snapshots still contain unpaged collections. One RPC is not proof of bounded
payloads or instant hosted startup after the database has been idle.

**Next implementation, in order:**

1. Release the locally browser-verified replacement of the blank full-page loader with a stable, responsive shell and
   page-shaped placeholders. Before authentication, show no private names,
   balances or controls that assume membership. Announce loading accessibly.
2. Keep already verified content mounted during background refreshes. Never
   turn a pending or failed request into “no communes”, zero balances or an
   empty ledger. Re-check account changes and revoked membership in tests.
3. The guarded aggregate RPC and affected-commune invalidation are implemented
   locally. Next, measure hosted payload sizes; add selected-screen pagination
   and lightweight Home summaries where actual account sizes justify it.
   Preserve authorization checks and do not persist private ledger data merely
   to disguise latency.
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
