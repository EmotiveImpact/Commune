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
