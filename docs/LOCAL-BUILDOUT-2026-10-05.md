# Local build-out, from 5 October 2026

Local only. Nothing here has been pushed, deployed, or applied to Neon. Each
batch was tested on disposable `commune_depth_*` databases and disposable
accounts before it touched the everyday local database, which was backed up
first. Local test results say nothing about hosted capacity or readiness.

## 1. Operations people by member id (migration 0020)

**Why.** Tasks named people by display name. A rename broke assignments, two
members with the same name were confused, rotations could hold names of
people who were never members, and the web editor had no way to set a
rotation at all.

**What changed.**
- `commune_operations.assignee_id` and `rotation_ids` (member ids) are the
  truth. The `operation_people` trigger copies names into the old `assignee`
  and `rotation` columns, so older clients keep working, and checks that every
  person is an active member of the commune, appears once, and that the
  current holder is in the rotation.
- Names-only writes from older clients are resolved to ids when the name is
  unique among active members, and refused otherwise.
- `record_operation_occurrence` advances by id and passes over anyone who has
  left; undo restores the id. Occurrence history stores ids beside names.
- The snapshot reads names live from ids, so a rename shows everywhere at once.
- When a member leaves or is removed, their tasks pass to the next active
  person in the rotation (or become unassigned) and they leave every rotation.
  The history line says so, e.g. "Casey left. Now with Blake".
- Backfill: names matching exactly one active member became ids; ambiguous or
  unknown names were left as names.
- Web: "Assigned to" picks by member id and allows Unassigned. Repeating tasks
  get a **Takes turns** list (the existing member rows): the current holder is
  fixed, turns follow member order, and a non-repeating task drops its turns.
  "Yours", the People view and Hub use ids; unheld tasks appear under House.

**Evidence.** `infra/neon/tests/operation_people.sql` (duplicate names,
membership, legacy names, rename, departures, undo), `tests/grants.sql`,
`apps/local-api/tests/operations-history.mjs` (ids, refusals, legacy client,
leave and remove), the other four HTTP suites, 232 web tests, build, and a
browser check of create and edit with turns on the QA database.

## 2. "I've sent it" payment reports (migration 0021)

**Why.** The member who owed a share could only wait: the screen said
"Awaiting payer confirmation" and there was no way to say "I have paid".

**What changed.**
- `expense_share_payment_reports`: a claim by the member who owes, with
  amount, date sent and optional reference (card-like numbers refused, as for
  receipts). It never changes a balance. One pending report per share.
- `report_share_payment`, `withdraw_share_payment_report` and
  `resolve_share_payment_report` (confirm or decline). Confirming records an
  ordinary receipt for exactly what was reported, through `record_share_receipt`,
  so every receipt rule still applies and the receipt can be reversed as usual.
  Declining needs a reason. All commands lock the commune first and are
  idempotent; four concurrent answers produce exactly one outcome.
- A pending report closes on its own ("Share settled" or "Expense voided")
  when nothing is left to confirm.
- Notices: the payer is told of a report; the reporter is told of a
  confirmation or a decline (with the reason).
- Web: Settle and the expense window offer **I've sent it** to the member who
  owes, show the pending claim to both sides, let the reporter withdraw it,
  and give the payer **Confirm** and **Not received**. Nudge is hidden while a
  report waits for an answer.

**Evidence.** `apps/local-api/tests/payment-reports.mjs` (permissions,
validation, idempotency, decline, withdraw, confirm-to-receipt, reversal,
auto-close on settle and void, a four-way race), `tests/grants.sql`, four new
web tests (236 in all), build, and a two-account browser run on the QA
database: report as the debtor, then confirm as the payer.

## 3. Statements between two members (web only)

**What changed.** The Breakdown window (Settle → View breakdown) now has a
**Statement with** picker. It lists, oldest first, every share one of you owes
the other, each repayment, each reversal, and voided bills (listed, never
counted), with a running balance. The closing figure is the same net that
Settle shows. **Download CSV** saves it locally; text cells are quoted and
formula-like text is neutralised so a spreadsheet cannot run it.

**Evidence.** `apps/web/tests/statement.test.ts` (order, signs, reversal,
void, both directions, CSV quoting), 239 web tests, and a browser check on the
QA database where the statement reconciled with Settle (£80 + £12 − £15 − £12
repaid = £65).

## 4. Recurring bill periods (migration 0022)

**Why.** A recurring bill could only be recorded at its saved amount, never
skipped, and kept no visible record of past periods.

**What changed.**
- Each period is a record: `recorded` (with the amount actually paid, who
  recorded it and when) or `skipped` (with a reason, and no expense).
- `record_recurring_period(bill, period, amount)`: a different amount scales
  the saved split proportionally (largest remainder, ties in saved order), so
  the shares always add up exactly. The saved bill is unchanged. Sending the
  same period again reports the period already recorded.
- `skip_recurring_period(bill, period, reason)`: nobody is charged; the
  schedule moves on. A future period can be skipped ahead of time.
- The original `record_recurring_bill` still works for older clients and keeps
  its old contract (a second call for the same period is refused).
- History lines say what happened ("Recorded for 31 Jan · £100.01 (usually
  £90.00)", "Skipped 28 Feb: …") instead of a vague "Updated".
- Web: the record dialog takes **Amount paid this time** and previews the
  scaled split; **Skip this period** asks for a reason; each bill lists its
  recent periods with a link to the recorded expense.

**Evidence.** `apps/local-api/tests/recurring-periods.mjs` (permissions,
scaling, retry, skip, skip-then-record refusal, old command, history,
three-way race), `workflows.mjs` (old contract), `tests/grants.sql`,
`apps/web/tests/recurring-periods.test.ts` (client preview matches the server
cases), two new screen tests (243 web tests), and a browser check on the QA
database (recorded £97.50 against a usual £90.00).

## 5. Invitation lifecycle (web only)

**Why.** Admins only saw invitations still pending, so an expired invite
silently disappeared and there was no way to send a fresh link.

**What changed.** The client keeps every invitation with a derived stage:
pending, expired, accepted or revoked. Members shows open invitations with
when they were sent and when they expire (or expired), **New link** for pending
and expired ones, and **Revoke** for pending ones; accepted and revoked
invitations are listed under "past invitations". New link asks first, then uses
the existing `create_commune_invite`, which already retires the earlier link
for that address. Signing in from an invitation still returns to it
(`commune.return-to`). No migration was needed.

**Not exercised locally.** "Email it" uses the existing invitation-email path.
It was not pressed in testing, so no real email was sent.

**Evidence.** A screen test covering all four stages, the history list and a
new link (244 web tests), and a browser check on the QA database confirming
the earlier link was revoked when the new one was created.

## 6. Note history and conflict protection (migration 0023)

**Why.** Two people editing a note at once silently overwrote each other, and
a note's earlier content was gone after any edit.

**What changed.**
- Notes have a version, set only by the database. Every content change saves
  the replaced content to `note_revisions` (who saved it, who replaced it,
  when); the last 50 per note are kept. Unchanged saves make no new version.
- A save names the version it started from. If someone saved since, nothing is
  written and the client gets 409. Older clients that send no version still
  save as before.
- Members read an earlier version on demand (`GET /notes/:id/revisions/:rid`
  locally; the `note_revisions` table through the Data API), so the snapshot
  carries summaries only.
- Web: the editor keeps the draft on a conflict, names who saved the newer
  version, and offers **Save mine over theirs** (theirs stays in history) or
  **Discard mine, see theirs**. The note reader lists earlier versions; one can
  be opened (passwords and codes stay masked, as on the board) and restored as
  the newest version. Nothing is deleted.

**Found in testing.** The first draft's backfill fired the activity-history
trigger, which needs a signed-in identity, so it failed on any database that
already had notes (the fresh test database had none). The backfill now runs
with that trigger disabled. Each remaining migration is rehearsed on a clone of
the everyday database before it is applied there.

**Evidence.** `apps/local-api/tests/note-revisions.mjs` (stale save refused,
history, unchanged save, older client, revision read and outsider refusal,
restore, a six-way race, delete), `tests/grants.sql`, two web tests (246 in
all), all SQL and HTTP suites on a database built from zero, and a browser
check of the history and a revision on the QA database.

## 7. Fund figures (web only)

Fund cards and the fund view now show **Promised** (active pledges),
**Received** (recorded contributions, net of corrections), **Still to come**
(promised but not yet received) and, with a target, **Not yet pledged**. A
cancelled pledge's recorded money still counts as received; its promise does
not. Gaps never go negative. Tested in `apps/web/tests/funds-figures.test.ts`
(249 web tests) and checked in the browser on the QA database.

**Not built: linking a fund to an expense.** Spending from a fund changes what
people owe (does the fund pay the bill, or reimburse the payer, and how are
the shares settled?). That is a product decision, so it is listed as an open
question rather than guessed at.

## 8. Data export (web only)

Commune settings has a **Records** group: **Download expenses** (CSV, one row
per share with amounts, received, outstanding and status, voided bills marked)
and **Download all records** (JSON of everything the member can see in that
commune). Files are made on the device from data already loaded; nothing is
sent anywhere. Passwords and door codes in notes are left out of the JSON, as
they are masked on the board. CSV text cells are quoted and formula-like text
is neutralised. Tested in `apps/web/tests/export.test.ts` (251 web tests) and
checked in the browser.

## 9. Task handovers and skip reasons (migration 0024, 6 October)

**Why.** The roadmap's remaining Operations gap was exceptions and
reassignment. A housemate who could not do their turn had two poor options:
edit the task (which changed the rotation for good and left no history) or
leave it late.

**What changed.**
- `hand_over_operation(task, to member, expected date, expected holder, today,
  reason, request id)`: any member hands the current occurrence to another
  active member. It is a recorded occurrence (`handed_over`) with the actor,
  time, optional reason and state before and after, so it shows in History and
  the latest one can be undone. A retry returns the same handover; a stale
  date or holder is refused.
- On a task that takes turns, `commune_operations.turn_owner_id` remembers
  whose turn it is while someone covers it. Completing advances the rotation
  from that person, so the cover does one turn and nobody gains or loses a
  place. The cover is credited in "last done". Handing it back to the turn
  owner ends the cover. The person covering need not be in the rotation.
- A member's own edit of who has the task, who takes turns or the repeat
  replaces any cover; other edits keep it. Clients cannot write
  `turn_owner_id` (no column grant).
- Departures: if the person covering leaves, the task goes back to whoever's
  turn it is; if the turn owner leaves, the cover keeps it. Undo refuses to
  hand a task back to someone who has left (this also closes the same gap for
  undoing a completion).
- `record_operation_occurrence` takes an optional reason (skips only, up to 200
  characters). Older clients that call it without one keep working. The skip
  date rule is unchanged.
- Web: the task window has **Hand over** (choose a member, optional reason)
  and **Skip a week** now asks for an optional reason first. "Assigned to"
  reads "Dana Moss · covering for Avery"; the rotation highlights whose turn it
  is; History lists handovers and reasons. The Late card's one-click skip is
  unchanged. The edit form keeps a cover out of the rotation.

**Evidence.** `infra/neon/tests/operation_handovers.sql` (refusals, retry,
cover, completion, undo, hand back, edits, skip reasons, departures),
`tests/grants.sql`, `apps/local-api/tests/operations-history.mjs` and the other
seven HTTP suites on a fresh database, 256 web tests, web typecheck and
production build, local API typecheck, and a browser check of the handover
and skip panels at desktop and phone widths on a disposable database. Not
applied to any hosted database.
