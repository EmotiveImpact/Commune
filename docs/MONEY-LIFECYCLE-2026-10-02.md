# Commune money lifecycle and task history: 2 October 2026 (later pass), with 3 October review fixes

## Status and scope

Implemented in the real local React app, the local API and four additive
PostgreSQL migrations (0015 to 0018). **Local only.** Nothing was pushed,
deployed or applied to a Neon branch, and no real email was sent. The approved
design direction is unchanged. This pack covers batch B of the
[product-depth roadmap](PRODUCT-DEPTH-ROADMAP-2026-10-02.md) and the operation
occurrence part of batch C.

Each gap was checked against source before work started:

| Roadmap claim | Found in source | Outcome |
| --- | --- | --- |
| Expense window nudges without the preview Settle uses | True: `Windows.tsx` called `sendReminder` directly | Fixed |
| `confirm_expense_share` only settles a whole share, no ledger | True | Receipt ledger added; the old call still works |
| No expense correction, revision or void | True | Added |
| Task completion has no undo or history | True, and worse: the browser computed the next date and rotation and overwrote the row, so two people could advance one occurrence twice | Moved to the database |
| Fund contribution correction | Already implemented in 0013 | Left alone; it is a separate ledger |

## What changed

### 1. One Nudge/Chase interaction (migration 0015)

- `send_reminder_command(kind, source, request_id)` wraps the audited
  `send_reminder`. A repeated request id returns the reminder it already
  created instead of a cooldown error.
- It tells the sender only whether an email is `possible` or there is `none`
  (delivery not configured, or the obligation was withdrawn). Whether an email
  is actually queued depends on the recipient's own preference, so reporting
  queued, accepted or failed per reminder would let a sender read it. Delivery
  states stay with the sender service and its monitoring.
- The snapshot gains `sentReminders`: the signed-in sender's own reminders for
  the last 30 days. Another member's reminder log is never included.
- Expense, Settle and Funds all open the same preview and use one eligibility
  rule, so a disabled button always states why.
- Result wording says only what the server reported and never that an email
  was sent or delivered. A 4xx says nothing was sent and the allowance is
  unchanged. An unknown outcome says so and that a
  retry will not send twice. A failed allowance refresh after an accepted
  reminder is no longer shown as a failed reminder.

### 2. Repayment receipts and reversals (migration 0016)

- `expense_share_receipts`: amount, date received, optional reference,
  recorder, request id, and reversal who/when/why. Clients cannot write it.
- `record_share_receipt`: payer only, never the payer's own share, amount up
  to what is outstanding, under a commune-then-share lock. A repeated request
  id returns the existing entry. A reference that looks like a card or account
  number is refused, because the whole commune can read it.
- `reverse_share_receipt`: payer only, reason required, original entry kept.
  Refused when it would reopen a debt for a former member. Repeating it is a
  no-op. The debtor gets an in-app notice.
- `settled_minor` is now the projection of receipts that are not reversed. A
  deferred constraint trigger checks this at commit for every write path.
- Shares confirmed before the ledger existed are backfilled as one receipt
  each, marked `migrated`.
- "Confirm received" opens a repayment form with the full amount prefilled.
  Settle shows part-paid progress and a Recent repayments list built from the
  ledger. Each share in the expense window lists its repayments.

### 3. Expense correction and void (migration 0017)

- `expenses.version`, void fields, and `expense_revisions` holding before and
  after for every change.
- `correct_expense`: payer or admin; only an admin may change who paid;
  reason, expected version and request id required. While any repayment is
  active, amount, payer and split are locked and the user is told to reverse
  first. Name, category and due date stay correctable. A person with repayment
  history cannot be dropped from the split.
- `void_expense`: same authority and checks, refused while repayments are
  active. The row, its shares and its history remain. Reminder targets, the
  leave/remove guard, search status and queued reminder emails all ignore a
  voided expense. A recurring schedule is not rewound by voiding its expense.
- People whose own figure changed get an in-app notice with the reason.
- The correction dialog has an edit step and a review step (what changes,
  whose balance changes). A competing change shows as a conflict that keeps
  the editor's work and lets them review against the latest version.

### 4. Task occurrences and undo (migration 0018)

- `operation_occurrences` records completed, skipped and reopened with the
  exact state before and after.
- `record_operation_occurrence` computes the next date and rotation in the
  database and rejects a click whose expected date is stale.
- `undo_operation_occurrence` restores the previous date, assignee, status and
  last-done exactly. It is refused once a later action exists or the task was
  edited, so it never overwrites newer work.
- Operations shows Undo in its toast, the Hub confirms with a visible Undo,
  and the task window lists history.

## Verification completed locally

- **Web:** 216 tests in 17 files pass. TypeScript passes. Vite production
  build passes. Baseline before this pack was 166 tests in 14 files.
- **Local API and worker:** both type-check.
- **HTTP integration on a fresh isolated database (port 3006):** the existing
  smoke, workflow and search suites still pass. Two new suites pass:
  - `money-lifecycle.mjs`: one reminder from six simultaneous identical
    requests; request id not reusable across obligations; the roadmap
    acceptance example (120.00 split 40.00/80.00, receive 25.00, retry leaves
    25.00, reverse returns to 80.00, both entries visible to all three
    members); six parallel 30.00 receipts against 55.00 outstanding admit one;
    stale and racing corrections admit one; money fields lock while a
    repayment exists; void leaves history and removes the bill from reminders,
    search status and the leave guard; a former member's settled debt cannot
    be reopened or rewritten; reminders racing receipts and voids end in a
    decision every time, and no voided bill stays remindable.
  - `operations-history.mjs`: weekly rotation, retry, six simultaneous
    completions admit one, exact undo, undo refused after a later completion
    or a manual edit, monthly overdue catch-up, skip, one-off completion,
    reopen of a task finished before occurrences existed.
- **Upgrade path:** 0015 to 0018 were applied to the everyday local database
  after a backup, with every count and money total unchanged (details in the
  handoff). Earlier, 0016 to 0018 were applied to a test database that already held
  data. The backfill produced one receipt for the one confirmed share and no
  projection drift; a direct overwrite of `settled_minor` was rejected by the
  commit-time guard.
- **Grants:** `infra/neon/tests/grants.sql`, extended to the three new tables,
  seven new commands and ten private helpers, passes on the full schema.
- **Email sender:** its integration test (simulated provider) and the existing
  reminder SQL tests pass against the full schema.
- **Browser, synthetic accounts on an isolated database:** empty Settle;
  populated Settle; Nudge preview, send and result; cooldown explanations;
  partial repayment; correction preview and save; the money lock; task
  completion, toast Undo and history; the debtor's account (matching totals,
  notices, no payer controls); reversing a repayment; voiding an expense; a
  real outage (API stopped) then a successful retry. At 375px: stacked Settle, repayment form, expense window and
  correction form, with no horizontal overflow.

Faults found only in the browser, and fixed: cramped share rows in the expense
window; dialogs inheriting the window's footer and label styles; unstyled
error text in the new dialogs; awkward ledger-notice wording; and Voided shown
in the green Settled tone (now the neutral pill).

## Independent review and what it changed

A separate read-only review of migrations 0015 to 0018 confirmed the core
rules (payer-only receipts, no overpayment under concurrency, version checks,
commune isolation, no client-callable private helpers, all five in-place
function patches applied correctly) and raised six points. All were addressed
before the migrations touched the everyday database:

1. **A bill being voided could still be nudged** if the two overlapped. Void
   now takes the share locks a reminder holds, and the reminder re-checks the
   void after acquiring its lock. Proved with a scripted interleaving: the
   nudge waits, is then rejected, and no reminder is recorded. The sender
   service also refuses to email about a voided bill, in a way that works
   before or after 0017 is applied.
2. **A new deadlock ordering** between reminders (share, then commune) and
   receipts/corrections (commune, then share). `send_reminder` now takes the
   commune key lock first, for Nudge and Chase. A race suite of reminders
   against receipts and voids ran three times with no server errors.
3. **Email state revealed a recipient's opt-out.** Reduced to `possible` or
   `none` as described above.
4. **The settlement guard ran under the caller's row-level security.** It is
   now `SECURITY DEFINER` and reads every row.
5. **A retry was matched on too little.** A repeated request id must now carry
   the same amount, date, reference, reason and outcome, or it is refused. A
   replay of a since-reversed receipt is refused rather than reported as
   standing.
6. **Undo ordering used transaction start time.** Occurrences are now ordered
   by when they were recorded under the row lock.

Known and accepted: editing a task's rotation or repeat rule after an action
does not block undoing that action, because undo restores only the date,
assignee, status and last-done.

## Second review round (3 October)

A wider read-only audit (CSS cascade, client logic, backend parity, SQL,
accessibility, dark mode and copy) reported 36 issues; each was checked by a
separate skeptical reviewer. 32 were confirmed and 4 refuted. A hand-run
browser sweep of every screen and dialog at 375, 620, 860 and 1440px, and in
dark mode, added more. All confirmed issues are fixed. Many predate this pack.

Database (new migration **0019_lifecycle_corrections.sql**, additive):

- A void no longer marks queued reminder emails in a way that revealed a
  recipient's email preference.
- An expense whose repayment involves someone who has left can now be voided;
  the void closes those repayments with its reason instead of refusing forever.
- Nudging a bill that was just voided says it was voided, not "only the payer".
- Monthly tasks keep their day of the month (31st returns to the 31st after
  February), with the same anchor rule as recurring bills.
- The reminder allowance read reports each person's last reminder across
  communes, so the one-day cooldown is explained before Send.

Client and styling:

- Task times came back from the database as HH:MM:SS, which broke editing a
  timed task locally and showed seconds; normalised to HH:MM.
- Hosted errors now keep their HTTP status and map the same SQL states as the
  local API, so a rejection is never reported as an unknown outcome.
- Repayment and correction dialogs lock their fields after an unconfirmed
  save, so a retry is the identical command; a save whose reply was lost is
  recognised as your own, not as someone else's change.
- Correct and Void explain who can reverse a repayment (an admin is told to
  ask the payer).
- A commune whose only expenses are voided still shows its ledger.
- Dates of timestamps (voided, corrected, reversed) show your local day;
  Overdue uses your local date.
- Focus returns to a sensible control after a dialog whose trigger became
  disabled or disappeared; the task-history step change and Hub task actions
  keep focus; Escape in the reminder allowance closes only that popover.
- Operations toast: always-present status region, pauses while hovered or
  focused, errors stay 8 seconds, Undo cannot be double-sent, and it no
  longer covers the phone tab bar.
- Unread notices are marked "New" in text, not only by colour.
- Layout: the Nudge dialog and the task Remove card no longer pick up the
  window's sticky footer; dialog widths, field spacing and Settle panel
  padding/shadow now apply as written; compact Reverse buttons on desktop
  with a 44px target on phones.
- Dark mode: invisible notifications bell, selected states (split method,
  filter chips, Week/People/Month), all three Operations views, form
  segmented controls, required marks, the Voided pill, window footers, the
  Hub button hover, task notes and month navigation now have dark styling.
- The Add expense form (reported in the browser) now gets its intended width,
  level Amount/Paid by inputs and one full-width footer.

Verification after the fixes: 222 web tests, TypeScript and the production
build; all five HTTP suites, every SQL test, the grants check, the
email-worker integration and concurrency tests on fresh databases; browser
sweeps for overflow, clipped or misaligned controls and dark-mode contrast.
0019 was applied to the everyday local database after a backup
(`.local/backups/commune_loading_test_20260927-before-0019-*.dump`) with every
count and money total unchanged.

## Not verified, and what that means

- **Nothing hosted.** The Neon adapter has contract tests for function names,
  arguments and error mapping, but it has not run against a Neon branch. Real
  Data API behaviour, RLS with signed JWTs and schema-cache refresh are
  unproven for 0015 to 0018.
- **No real email.** The `possible` result only occurs when a provider is
  configured. Its wording is unit-tested; a real send was not made.
- **The conflict banner and Chase** were exercised in component and HTTP
  tests, not by hand in the browser (a real conflict needs two simultaneous
  sessions).
- **Dark mode** was not inspected for the new dialogs.
- **Accessibility** was checked for roles, labels, focus return and Escape
  handling in tests. No screen reader pass was done.
- **Two older scripts that failed before this pack are resolved.**
  `monthly-limits-concurrency.mjs` inserted members with no acting user, which
  the history trigger added in 0013 rejects; the fixture now acts as the
  commune's creator, and the test passes (run three times on a fresh schema).
  `request_identity.sql` needs an existing membership by design; it passes on
  a database that has one.
- **Capacity.** These are correctness tests on small data. They say nothing
  about hosted latency or 100,000 users. The snapshot now also carries
  receipts and up to 20 revisions per expense, so the unpaged payload noted in
  the workflow document grows further.

## Decisions taken, open to change

1. Only the bill payer records or reverses a repayment. An admin cannot.
2. The payer or an admin corrects or voids. Only an admin changes the payer.
3. Money fields lock while any repayment is active. There is no "move the
   receipt" path.
4. A receipt reference is visible to the whole commune and refuses eight or
   more consecutive digits.
5. Senders are not shown whether a reminder email was queued, accepted or
   failed, to keep the recipient's email preference private. Showing delivery
   states is a small change if you prefer transparency over that privacy.
6. Bell notices go to the debtor on reversal and to affected people on a
   financial correction or a void. Recording a repayment does not notify.
7. Skip keeps the existing "one week" behaviour, including for monthly tasks.
8. Direct column writes to `commune_operations` remain granted, because the
   edit form and the deployed client use them. New clients complete tasks
   through the commands. Revoking `status` and `last_done` writes is a later
   hardening step once every client is on the commands.

## Remaining

1. Hosted release of 0013 to 0018 with the matching client and sender, in the
   order given in `infra/neon/README.md`, followed by two-account checks of
   every money command and a real inbox check.
2. Debtor-reported "I've sent it" (distinct from received), per-person and
   per-expense statements, receipt attachments.
3. Recurring bills: variable amount, this-occurrence edits, skips and period
   history.
4. Operations: stable member ids instead of names in assignee and rotation,
   exceptions and reassignment.
5. Delivery webhooks, bounce and complaint suppression, quiet hours.
6. Snapshot pagination and lighter Home summaries.
7. The HTML design reference still states that the recent-confirmations view
   is not implemented. It was left untouched.
