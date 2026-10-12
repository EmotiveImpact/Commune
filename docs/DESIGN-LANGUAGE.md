# Commune design language

Decision: 2 October 2026. The newly integrated local design is the direction; the recovered version is a functional reference, not a visual rollback target. Shared product primitives and the workflow screens below are now implemented locally. This is not a hosted release or exhaustive accessibility certification. See [workflow implementation and verification](WORKFLOW-COMPLETION-2026-10-02.md).

## Product character

Calm, domestic, clear and capable. Photography gives a commune its identity. Numbers explain obligations. Quiet lists and boards make shared life easier. Avoid making every section an equally prominent dashboard tile. Preserve existing functions while refining their presentation.

## Copy and punctuation

Do not use em dashes or other long dashes in product or transactional email copy.
Use full stops, commas, colons or conjunctions according to the meaning, not a
blanket punctuation substitution. Empty-value placeholders use a short hyphen,
never a zero that could imply a real balance. Preserve genuine minus signs,
date ranges and user-written content. Keep the wording plain and concise.

## Foundations

| Token | Decision |
| --- | --- |
| Canvas | Cream #f5f1ea; secondary cream #f8f5f0 |
| Surface | White #ffffff; use cream for recessed areas, not arbitrary competing whites |
| Ink / rail | Navy #1a1e2b |
| Primary action | Sage #2d6a4f, white text |
| Secondary text / section icons | Muted green-grey #60706b; verify contrast on each surface |
| Rules | Thin neutral borders; boundaries rather than decoration |
| Money icon | Slate #637689 on #edf0f3 when a category chip is useful |
| Operations icon | Sage on pale green; status must also have a text label |
| Interface typography | Existing Inter stack, served from the app with every subset Google served (`apps/web/src/styles/fonts`); do not swap the entire app to the wordmark font |
| Wordmark | Existing lowercase DM Sans wordmark, position and treatment retained. Its font file holds only the letters of "commune.", so new wordmark text needs a new subset (see `fonts.css`) |
| Type weights | Body 400; row names and buttons 500; section headings 550–600; avoid default 700/800 headings |
| Type sizes | Body 14px, secondary 12–13px, sections 18px, page titles 21px, hero 32–35px, principal money 36–44px |
| Numbers | Tabular numerals; 450–500 weight on large totals; labels must explain whose money and what state |
| Spacing | 4/8/12/16/24/32 rhythm; retain established desktop 22px page gutter and 22px grid gap |
| Sidebar | 248px; compact 37px-ish desktop rows with 3px gaps; original switcher and account/avatar remain |
| Header | Existing 60px desktop header; content aligned to the page gutter |
| Corners | One shared token family: controls/search/icon actions 9px; cards/hero/dialogs 15px. Pills only for statuses, filter tracks and avatars; inset segments follow their track geometry |
| Elevation | No default card shadows. Overlay elevation only when it communicates layering |
| Cover tones | `--cover-household` #3d5a4c, `--cover-workspace` #3f4b5a, `--cover-trip` #6a4b3c: behind a commune's cover photo while it loads, and in its place if it cannot load |
| Focus and green text | `--focus-ring` and `--text-green`: today's sage in light mode, the Hub's #649578 in dark mode and on navy surfaces |
| Error text | `--danger` and `--danger-soft`, one error colour in both themes |
| Touch areas | On phones (560px and under) small controls reach 44px through an invisible `::before` area; on desktop small links reach 24px through padding with a matching negative margin. Nothing moves visually |

Use semantic tokens with explicit dark-mode counterparts when consolidating CSS. Do not flatten dark mode with hard-coded light overrides. Normal text must reach 4.5:1 contrast; control boundaries/focus must remain discernible. Small metadata must not rely on very low opacity.

Corner authority lives in `apps/web/src/styles/shared.css`: `--radius-control`, `--radius-surface` and `--radius-pill`. Legacy `--radius` / `--radius-sm` are aliases, not a second scale. Search, bell/menu icon actions, primary/secondary buttons, form inputs, close controls and auth controls use the control token. Cards, the Hub photo hero and both dialog families use the surface token. Avatars and informational badges keep their intentionally rounded identity. Do not use a blanket `button` override: a clickable expense/note card is a surface, not an action button. Keep the approved Operations calendar geometry intact.

## Component families

These are system responsibilities, not a demand to rename every existing component. Shared `Button`, `Panel`, `SectionHeading`, `Field`, `Dialog`, `EmptyState`, `Feedback` and `SplitEditor` are implemented in the web app. Existing shell, Notes reader and Operations retain their established interactions.

| Family | Responsibility and variants |
| --- | --- |
| AppShell | One sidebar/header/content frame. Original commune switcher and user account control. Responsive mobile navigation preserved |
| PageHeader | Title, optional useful context, global controls. No duplicate in-content title unless it serves a different hierarchy |
| QuickFinder | One header search button and native modal, Cmd/Ctrl-K or slash; scoped grouped results with exact-record navigation. Expenses and Notes retain independent in-page filters. No copying another app's styling or credentials |
| SectionHeader | Heading, optional muted 17–18px line icon, count or one quiet action. Same treatment for populated and empty sections |
| Button | Primary sage, secondary outline, quiet text, danger. 40px standard; 44px touch target on mobile. Loading/error states retain the action label |
| SegmentedControl | Shared light track, navy selected state, clear keyboard focus. Operations retains its established placement and behaviour |
| Panel | White bordered container with consistent padding. Not every list needs a separate nested panel |
| SummaryAmount | Label, real amount, concise meaning, optional primary action. Money hierarchy through size rather than excessive boldness |
| ListRow | Leading identity/icon if informative, primary text, secondary metadata, trailing value/status. No nested conflicting click targets |
| StatusBadge | Compact labelled state. Green for settled/complete, amber for pending/attention, red for failure/overdue where appropriate; colour never the sole signal |
| DateBadge | Shared `CalendarDate`: Operations' weekday strip, white face, date and Today/Tomorrow; add the month for dates beyond the week. 60px face / 52px below 1000px. Operations date column stays 72px / 56px below 1000px, no shadow or coloured edge |
| NoteCard / NoteReader | Existing board and reader. Type-specific fields without changing the basic interaction. Contacts keep editable roles; confidential values stay masked |
| FundCard | Purpose, contributed/target, progress, outstanding pledges and relevant next action. Explicitly records contributions; never implies Commune holds money |
| FormDialog | Consistent title, close, labelled fields, error placement and action footer. Single column normally; two columns only where a live expense summary earns the space |
| ReminderConfirmation | Shared Nudge/Chase preview: recipient, purpose, allowance, confirmation and result. Preserve server limits and cooldowns |
| Empty / Loading / Error | Same section identity and useful destination. Never represent pending data as no commune. Keep existing content during refresh; make genuine failure distinct and retryable |

## Icon and action rules

- Use the existing line-icon family, approximately 1.5–1.8 stroke weight. No mixed filled/decorative packs.
- All Hub card headings use the same quiet green-grey line-icon treatment: 17px, 1.5 stroke, 9px label gap. This includes balance, attention, week, essentials and recent expenses, in both populated and empty states. Keep the photo hero's identity free of decorative heading icons.
- Use coloured icon chips to distinguish actual activity types, not on every heading.
- Keep the current wordmark, original switcher and avatar. Do not redesign them during screen work.
- One clear primary action per task area, not a primary button in every card. Add expense belongs in the balance/task area, not the house hero.
- No decorative external-link arrows on internal actions. Use a chevron only when it clarifies navigation.
- Preserve the original background on settings-row hover; focus, underline or a subtle foreground change can communicate interaction. No warmer-cream repaint.

## Screen roles

- Home: one large **selected/current commune**, others smaller below. Personal next actions, chronologically sorted activity and search span all communes; switching the feature also switches the active commune. Not a duplicate Hub.
- Hub: place identity → your balance and immediate needs → this week and shared essentials → recent activity. Keep the new layout. Recover missing useful information selectively; do not automatically put the four old KPI tiles back.
- People: keep hero access obvious; concise member context can be restored without reinstating a large repeated list. Roles, invites and member balances must remain reachable.
- Expenses: individual **two-column boxes**, one saved expense per box; one column below 760px. Preserve payer, category, due date, status and filters. Label **Total paid** separately from **Your share**; explicitly say when the viewer is not included. Do not replace the boxes with full-width ledger rows.
- Settle: equally weighted adjacent **You owe / You’re owed** panels, stacked below 760px. Receipt confirmation belongs to the actual bill payer, not the debtor or an unrelated admin. Reminder buttons explain due-date/cooldown/allowance restrictions.
- Notes: retain the board/reader interaction; improve information density without turning notes into another financial list.
- Funds: compact two-column goal cards with a focused details dialog. Real own-pledge editing/cancellation, admin contribution recording/correction, fund editing/archive/restore and Chase. Keep correction history; never imply recorded contributions are money held by Commune.
- Recurring: save weekly/monthly amount, payer and split, edit/pause/resume. A payer/admin explicitly records one paid occurrence; concurrent confirmation cannot duplicate that period. No automatic card charge.
- Saved splits: shared Equal/Exact/Percentage/Shares templates, creator/admin editing, archive/restore, and deliberate use inside Add expense. Validate active participants and the final expense total again at save time.
- Operations: preserve week/people/month, the calendar treatment and established date-column geometry. Share basic tokens without restyling the screen wholesale.

## State and acceptance rules

1. Stable product routes: `/`, `/hub`, `/expenses`, `/settle`. Legacy `*-empty`/even links redirect; the data selects the empty state, not a mockup route.
2. Home/global history/search span communes; Hub and its child screens are scoped to the selected commune. Entity links retain the exact expense/note/operation ID; a missing ID must never open another record.
3. Initial reads retain verified commune identity with quiet page-shaped placeholders. Refresh keeps verified content mounted; 401/403/404 invalidates private cached data. No “Opening Commune” splash or false “No communes” state while pending.
4. Writes show pending/errors, block accidental modal dismissal, and re-read the affected commune. An older in-flight read cannot overwrite a newer saved snapshot. If the write committed but its refresh failed, offer **refresh**, not another create.
5. Dialogs use focus trapping, Escape guards and focus restoration; when an action removes its trigger, return focus within the same card. Disabled controls visibly differ. Global search is a quick-finder button on every product page, with a mobile icon variant. Notes and Expenses each retain one independent local filter; global queries must not silently filter the page behind the finder.
6. Preserve photos/avatar/payment hints in the existing browser/session store. Shared ledger and workflow records live in Postgres. Do not imply those personal hints are cloud-synced.

No further full-page redesign or automatic rollback. Keep the checkpoint and recovered comparison. Before removing visible information, identify its replacement and check whether it is still available when needed.

## Search interaction (2 October)

Adapted from the locally inspected Caleane `WorkspaceSearch.jsx` interaction,
not its appearance. The search modal stays over the current screen; result
groups are Communes, Expenses, Notes, Tasks & events, Funds, Recurring bills,
People and Saved splits. This commune / All communes explicitly states scope.
Arrows select a result, Enter opens it, Escape dismisses and restores focus.
No second search modal opens over a form/dialog; slash is ignored while typing.

Search uses one guarded Postgres RPC, not every commune's snapshot. Minimum
two characters, maximum 80, 180ms debounce, cancellation and stale-response
guards. Show a distinct retryable error; never report no matches while pending.
The quick finder returns up to eight matches per section; full search up to 25,
with honest total/truncation messaging. Exact/prefix title matches rank first
inside each section. This is indexed text matching, not AI or fuzzy matching.

Sensitive note types and custom access-code facts mask their previews and omit
private free text from matching. Never index fact values or member email
addresses. Archived funds/splits and inactive membership are excluded. Record
links re-check permissions when opening; loading a different commune must not
flash a false missing-record error. Funds open details; people, schedules and
splits focus the exact card without triggering an edit or financial action.

Implementation and local evidence: [search review](../artifacts/workflow-qa-2026-10-02/search-review.md).

## HTML reference: context, components and states

With the dev server running, open `/reference/design-language/index.html`
(the file is `apps/web/reference/design-language/index.html`; it is never
published). The three keyboard-accessible tabs are **In context**,
**Components** and **States**; `/reference/design-language/index.html#states`
opens the state reference directly. This is an illustrative document, not a
second application. Its example forms and reminder controls never call the API,
create records or send email. The existing reference typography and icon family
remain unchanged.

The States tab includes:

- The same fund identity in populated, genuinely empty, initial-read and
  retryable-error states. A refresh retains known values; pending is never £0 or
  a claim that no commune exists.
- A labelled 80-character example form, validation, pending/disabled submission
  and local-only success, plus wrapped contact names and masked access details.
- A **design target** for Settle with a contextual Nudge panel, illustrative
  email preview and recent confirmations. Ready, sending, failure, cooldown,
  exhausted allowance and accepted states can be inspected independently.
- A screen coverage checklist and explicit responsive, keyboard, focus,
  permission and uncertain-write rules.

Status after the money-lifecycle pass (local only): every Nudge and Chase entry
point (Expense, Settle, Funds) now uses the one `ReminderConfirm` dialog with
the same preview, allowance, cooldown explanation and reported result. The
receipt ledger is the timestamped confirmation source, and Settle shows it as
**Recent repayments**. The contextual Nudge **side panel** and the illustrative
email preview in States remain design targets and are not app UI. The HTML
reference still says the recent-confirmations view is not implemented; that
sentence is now out of date and was left unchanged pending a decision on the
reference. Preview email
copy is not a promise of the sender's exact template or successful delivery.
Cooldown and quota checks disable sending; they are not decorative messages
beside an enabled button. Server authority remains essential.

## Shared date calendar (2 October)

`apps/web/src/ui/CalendarDate.tsx` and
`apps/web/public/styles/calendar-date.css` are the shared component and appearance
authority. The app and HTML reference both load that stylesheet. Operations,
Hub's This week, Home's dated next actions, expense due dates and recurring
next-due dates use the same calendar. Inline prose dates, date inputs, avatars,
undated records and the interactive Month grid are not replaced with badges.

Use local date-only values without UTC day shifts. A full weekday, day, month
and year is exposed to assistive technology; Today/Tomorrow is additional
context, not the only date. Never invent a date for an undated expense. Keep
explicit overdue/paused labels in row copy rather than recolouring the calendar
into a second status system. Keep existing task/open/complete and record
navigation interactions intact. The calendar alone retains Operations' approved
number weight; this does not authorize another global font-weight pass.

## Money lifecycle and task history (2 October, later pass)

Implemented locally with the existing primitives (`Dialog`, `Field`, `Button`,
`Feedback`, `Pill`, the `c-contribution-history` disclosure). No new visual
language, no change to the Hub, Home, sidebar, expense boxes or Operations
geometry. Details and evidence: [money lifecycle](MONEY-LIFECYCLE-2026-10-02.md).

- **One reminder interaction.** Preview (who, what for, amount, due date,
  count to this person, allowance left), explicit Send, then the result the
  server reported. A disabled Nudge or Chase always shows why: not due, no due
  date, 72-hour cooldown, reminded in the last day, or allowance reached. Never
  say an email was sent, queued or delivered: that depends on the recipient's
  own preference, which the sender must not be able to read.
- **Confirm received is a repayment form.** The label and position are
  unchanged. It opens one dialog with the full outstanding amount prefilled;
  changing the amount records a part payment. Date received and an optional
  reference (visible to the commune, no account or card numbers). The line
  under the fields states what remains after the entry.
- **History uses one disclosure pattern.** Repayments under each share,
  changes to an expense, and task occurrences all use the contribution-history
  disclosure: newest first, who and when, the reason in plain words, struck
  amount or verb for a reversed or undone entry. The original entry is never
  removed.
- **Share rows.** Identity, figures and status on the first line; actions and
  the reminder hint on their own line, right-aligned, as in Settle. Status
  adds **Part paid** and **Voided**; colour is never the only signal.
- **Correct and Void** sit with the other quiet actions in the expense window,
  for the payer or an admin only. Correction is edit, then review: what
  changes, whose balance changes, a required reason. Money fields show as
  locked, with the reason, while repayments exist. A competing change appears
  as a conflict banner that keeps the editor's work.
- **Voided expenses** leave All, Open and Settled and every total. A Voided
  filter appears only when one exists.
- **Tasks.** After Done or Skip, the existing toast carries an Undo for a few
  seconds; the Hub confirms in a visible line with Undo; the task window lists
  history with Undo on the latest entry only.
- **Failure wording.** A server rejection says nothing was saved. An unknown
  outcome (offline, timeout) says so and that trying again is safe. Money
  dialogs show errors in the Overdue tone with `role="alert"`.

### Connection recovery

- Before an account can be verified, use a compact white recovery card on the
  cream canvas with the existing wordmark, 21px heading and shared corner tokens.
  No raw fetch error, false empty commune or unverified private sidebar.
- A brief startup connection failure gets one retry across identity and membership
  reads. Never automatically retry a financial command or an access rejection.
- Retry stays in the same card, disables while running and announces its result.
  Offline copy explains the next step; returning online triggers a retry.
- Once verified content is loaded, a temporary refresh failure preserves that
  view and offers a small connection notice rather than replacing the whole app.
