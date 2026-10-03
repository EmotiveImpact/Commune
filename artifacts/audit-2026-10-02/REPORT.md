# Commune: what is right, confused, and unfinished

Audited 2 October 2026. Current local application at `http://localhost:3000/`.

**Implementation follow-up:** the scope, payer, Funds, recurring, saved-split,
membership and state-consistency gaps below were subsequently implemented and
tested in the running `commune-loading` checkout. See its
[workflow implementation and release limits](/Users/augustusedem/.codex/worktrees/commune-loading/docs/WORKFLOW-COMPLETION-2026-10-02.md)
and [design language](/Users/augustusedem/.codex/worktrees/commune-loading/docs/DESIGN-LANGUAGE.md).
The original findings/screenshots below are preserved as audit evidence, not
rewritten as a current release verdict. Billing and hosted rollout remain
separate, explicitly unverified work.

## Verdict

Keep the new direction. The photo-led Home and Hub, compact navy sidebar, quiet sage icons, Notes board, two-column expense cards, and side-by-side settlement boxes are a coherent foundation. This is not merely an HTML mockup: existing commune records, notes, expenses, members and funds are visible in the real app, with real mutation handlers behind the forms.

But the app is not functionally complete. Its biggest confusion is scope: Home is all communes, while search and some actions silently use the selected commune. Several prominent destinations are unfinished. The styling is also implemented through overlapping page styles and overrides rather than consistently shared components.

This is a read-only inspection, not a release certification. No records were created/deleted, no invitations/reminders were sent, and nothing was pushed or deployed during this review.

## What to preserve

- Home: one large featured commune, smaller communes below. Do not turn this back into an equal-card dashboard.
- Hub: large photograph, identity and members, followed by money/attention, then week/shared essentials. Keep Add expense out of the photo hero.
- Sidebar: current wordmark, compact navigation, original commune switcher and account area. Keep reminder allowance here rather than repeating it in page toolbars.
- Expenses: the actual two-column individual boxes, not full-width ledger rows. One saved expense occupies one box; the empty second position is not missing data.
- Settle: separate, equally weighted “You owe” and “You’re owed” boxes, with explicit payment-outside-Commune language.
- Notes: pinned notes, useful types, protected previews of access/contact details, and a reader beside the board.
- Operations: preserve its week/people/month controls, calendar date treatment and compact date column. Do not use this audit to restyle it again.

## Fix order

### 1. Make scope predictable

**Evidence: steps 1 and 15; `Home.tsx`, `House.tsx`, `Shell.tsx`.**

Home shows recent events from both communes, but its Activity button opens only the selected commune's history. I verified this: Home showed “rwsfs” and “Shared groceries”; Activity showed only “Shared groceries”. Search is expense-only for the selected commune except on Notes, where it becomes note search. On Home, the searched commune is not stated next to the field.

Use a clear rule: Home and its history/search operate across communes; Hub and its child pages operate within the selected commune. If search deliberately remains commune-specific, name that scope explicitly. Aggregate Home activity by event time before taking the first six; the current code concatenates each commune's activity without a global sort.

The featured Home card is currently `places[0]`, not a chosen favourite or the selected commune. Preserve the large/small layout, but define whether the feature is pinned, last opened, or otherwise deliberately selected.

### 2. Resolve real workflow gaps before more cosmetic work

**Evidence: steps 5, 9, 11–14 and the current screen source.**

- Recurring is a prominent navigation item but only says recurring bills are not enabled. Build the recurring workflow or clearly mark it unavailable; a one-off-expense shortcut is not recurring functionality.
- Expense entry fixes “Paid by” to the signed-in user and always includes that user. Equal, Exact, Percentage and Shares methods exist, but recording an expense paid by another member is not available. Decide the intended policy, then implement its server rules and UI together—not just an unrestricted payer dropdown.
- Funds has create, pledge, contribution-recording and Chase handlers, but no exposed edit/archive fund, change/cancel pledge, or correction flow in this screen. A mistaken commitment needs a safe way to be corrected. The inline pledge/contribution forms also lack an explicit Cancel control.
- Members shows balances, pending invitations and invitation revocation. It does not expose leave-commune, member removal or role-change controls. Those need an explicit permission and financial-history policy.
- Billing is disconnected. Saved split templates are unavailable; forecasting/budgets are not connected. These are source-confirmed gaps, not claims that those entire journeys were browser-tested.

### 3. Clean up state and copy that undermine trust

**Evidence: steps 1, 6, 12–14; `App.tsx` and `state.tsx`.**

- “Your communes, Loading.” is the first word of the actual local account name “Loading Test”. It is not a loading indicator. Test data is making the application look stuck.
- A separate `Opening ${hub.name}…` blocking screen still exists when content is unavailable. Preserve already-known content during refresh and distinguish cold-start, retry and background refresh. Do not merely hide unresolved errors behind a fake zero balance.
- `/settle-even` is still a content-dependent URL. `/expenses-empty` also remains an internal state route; `/hub-empty` redirects to `/hub`. Empty/settled states should normally live inside stable product routes.
- Commune settings says “Create a link for an invited email address”, but the actual invitation window offers email sending and link-only creation. Update the description to match the real action.
- Settings describes Basic navigation as Home, Hub and jumps, although the current Basic sidebar already includes Expenses, Settle, Recurring, Funds, Notes and Operations.
- Photos are explicitly session-only and payment details browser-only. Keep that limitation honest. Shared/cross-device persistence is a separate product capability, not a CSS fix.

This review did not measure production latency or establish that Neon is causing delay. The current local screens were loaded with existing records; the old missing-membership incident cannot be diagnosed from a stable screenshot.

### 4. Finish hierarchy and density without another redesign

**Evidence: steps 1–10 and 12–14.**

The interface is strongest when the meaningful action and number lead. It is weaker when low-information empty cards occupy the same height as useful content, or sparse data produces a very long page before recent expenses are reached.

Keep the requested big photograph and large/small Home model. Reduce unused space inside lower empty panels, not the identity/photo. Keep one primary action for each section; avoid adding duplicate expense actions back into the hero. Funds needs a more compact goal summary and an intentional commitment-detail layout rather than a stretched full-width progress bar.

Expense boxes now have the requested shape, but the prominent amount needs an explicit “Total” versus “Your share” distinction. A compact period/total summary would make this an expense overview rather than only a collection of boxes.

Typography is not uniformly too thin. The quieter Hub/Settle numbers work; Operations' heavy “You're clear today”, some member balances and older form headings are noticeably stronger. Consolidate heading roles rather than increasing all weights.

### 5. Turn the design-language document into actual shared components

**Evidence: `main.tsx`, `styles/app.css`, `styles/overrides.css`, `styles/design-system.css`, `screens/Hub.css`, `screens/Money.css`.**

The document describes a system, but much of the implementation is still a CSS override layer across older screen-specific styles. Shared button, panel, section-heading, toolbar, field, dialog-footer and empty-state primitives should own the approved spacing and emphasis. Retain intentional differences: an expense object card is not a settings row or a Notes board tile.

Also fix accessible selected-state semantics for expense filters and Basic/Advanced controls. The source communicates selection through classes, not `aria-pressed` or a comparable selection state. This is a source-confirmed accessibility issue. Focus indicators are present; a complete keyboard/screen-reader/contrast audit remains to be done.

## Captured screen-by-screen evidence

These are current-run in-app-browser screenshots, saved and reopened for inspection. Different browser tabs used their normal viewport sizes; this is not a pixel-for-pixel comparison between tabs. Each screenshot is a viewport capture, not proof of unseen lower content or every responsive breakpoint.

### 1. Home — good foundation, confused scope

The requested large commune and smaller card hierarchy is restored. The first-card feature does not correspond to the sidebar's selected commune. Lower all-commune content routes partly into selected-commune destinations. Two page-level h1 elements also merit heading-hierarchy cleanup.

![1. Current Home](/Users/augustusedem/Commune/artifacts/audit-2026-10-02/01-home.jpg)

### 2. Hub with one member — good structure, sparse-state density needs work

Photo, balance, attention and lower shared details belong together. Empty panels still consume considerable height. Existing pinned content is present; this is not a wholly empty commune.

![2. One-member Hub](/Users/augustusedem/Commune/artifacts/audit-2026-10-02/02-hub.jpg)

### 3. Hub with two members — good continuity, essentials prioritisation needs refinement

Members and saved shared details appear after switching communes. The essentials list needs a deliberate priority rule, rather than only taking the first available records. No write or member-permission operation was tested here.

![3. Two-member Hub](/Users/augustusedem/Commune/artifacts/audit-2026-10-02/03-hub-members.jpg)

### 4. Expenses — box layout right, financial context incomplete

This is an individual half-width card in a two-column grid, not the rejected full-width row. “Settled” and payer/category are clear. The amount is not explicitly labelled as the total, and the page has no compact personal-share/period summary. Filter selection is visual-only in the source.

![4. Expenses](/Users/augustusedem/Commune/artifacts/audit-2026-10-02/04-expenses.jpg)

### 5. Expense window — useful split preview, payer limitation

The two-part form/summary is helpful. I typed £10.01 and observed the equal allocation £5.01 + £5.00; I did not save. Payer is read-only, and the current user cannot be excluded. Initial “Every penny is included” feedback appears even before a valid amount is entered. Keyboard traversal and invalid submission were not fully exercised.

![5. Add expense](/Users/augustusedem/Commune/artifacts/audit-2026-10-02/05-expense-form.jpg)

### 6. Settle — correct visual and conceptual split

Two side-by-side boxes make direction clear. The copy correctly distinguishes tracking from moving money. Only the zero-balance state was available; payment confirmation, eligible Nudge and cooldown behaviour were not retested.

![6. Settle](/Users/augustusedem/Commune/artifacts/audit-2026-10-02/06-settle.jpg)

### 7. Notes board — one of the strongest screens

Pinned versus other notes is legible, types help scanning, and credentials/access/contact values are not revealed in previews. This preserves useful content rather than replacing it with decorative cards. Colour contrast and screen-reader selection announcements still need dedicated testing.

![7. Notes board](/Users/augustusedem/Commune/artifacts/audit-2026-10-02/07-notes.jpg)

### 8. Note reader — useful board/detail relationship

Opening Quiet hours keeps the board visible and highlights the selected note. Edit and Pin are discoverable. The repeated generic “Notes” label inside the reader can be simplified. No edit or pin was saved during this audit.

![8. Note reader](/Users/augustusedem/Commune/artifacts/audit-2026-10-02/08-note-reader.jpg)

### 9. Funds — functional starting point, incomplete lifecycle

Goal, recorded total and pledge action are present. The single full-width card stretches sparse information. No edit/archive/correction controls are exposed. The progress bar has useful accessible value attributes in the source; contributions and Chase were not submitted.

![9. Funds](/Users/augustusedem/Commune/artifacts/audit-2026-10-02/09-funds.jpg)

### 10. Operations — approved structure retained, typography outlier

The light tab track, navy selected view and Add item position are right. The heavy empty-state heading is less consistent with the newer typography. No tasks were due this week, so a populated date-column or task-completion journey was not available in this capture.

![10. Operations](/Users/augustusedem/Commune/artifacts/audit-2026-10-02/10-operations.jpg)

### 11. Recurring — unfinished

The page honestly states that automatic recurring expenses are unavailable, but presenting this as a normal primary destination overstates the product's completeness.

![11. Recurring unavailable](/Users/augustusedem/Commune/artifacts/audit-2026-10-02/11-recurring.jpg)

### 12. Settings — understandable layout, stale descriptions and product limits

Account versus preferences grouping is useful. Billing is disconnected, payment details browser-only, and the Basic-navigation description is stale. Support/legal destinations were not opened or validated. Settings selection controls need programmatically exposed selected state.

![12. Settings](/Users/augustusedem/Commune/artifacts/audit-2026-10-02/12-settings.jpg)

### 13. Commune settings — sensible safeguards, partial production capability

Name/address and character limits are present. Locking currency once financial records exist prevents relabelling past money. The photo limitation is explicit. Invitation wording is out of date. Address autocomplete was not exercised; this capture alone does not establish whether its provider is configured.

![13. Commune settings](/Users/augustusedem/Commune/artifacts/audit-2026-10-02/13-commune-settings.jpg)

### 14. Members and invitation window — both invite methods present

Email sending and link-only creation are offered, with role explanation. Pending invitations can be revoked. The screenshot establishes the controls, not email delivery or successful acceptance; no recipient information was entered and no invitation was sent. Existing-member management remains limited.

![14. Invite](/Users/augustusedem/Commune/artifacts/audit-2026-10-02/14-invite.jpg)

### 15. Home → Activity — verified scope mismatch

Home listed records from both communes; its Activity button opened the selected commune's single-record log. This is a real interaction mismatch, not only a source-code inference.

![15. Activity after Home](/Users/augustusedem/Commune/artifacts/audit-2026-10-02/15-activity-scope.jpg)

## Source pointers for implementation

- Home aggregation/featured selection: `/Users/augustusedem/.codex/worktrees/commune-loading/apps/web/src/screens/Home.tsx`, lines 49–96.
- Activity scope and other explicit gaps: `/Users/augustusedem/.codex/worktrees/commune-loading/apps/web/src/screens/House.tsx`, lines 49–119.
- Search scope: `/Users/augustusedem/.codex/worktrees/commune-loading/apps/web/src/shell/Shell.tsx`, lines 255–276.
- Expense payer/split feedback: `/Users/augustusedem/.codex/worktrees/commune-loading/apps/web/src/windows/Windows.tsx`, lines 294–336.
- Expense filters/financial cards, Recurring and Funds: `/Users/augustusedem/.codex/worktrees/commune-loading/apps/web/src/screens/Money.tsx`.
- Loading/error screen: `/Users/augustusedem/.codex/worktrees/commune-loading/apps/web/src/App.tsx`, lines 175–185.
- State-dependent navigation: `/Users/augustusedem/.codex/worktrees/commune-loading/apps/web/src/state.tsx`, lines 889–907.
- Stale Settings wording: `/Users/augustusedem/.codex/worktrees/commune-loading/apps/web/src/screens/Settings.tsx`, lines 55–118.
- Current design primitives: `/Users/augustusedem/.codex/worktrees/commune-loading/apps/web/src/styles/design-system.css`.

## Evidence boundaries

This audit covers the current local app's visible screens, navigation, split preview and relevant source. It does not certify production auth, Neon tenant isolation, reminder delivery, billing, multi-device persistence, cold-start latency, cross-browser behaviour, mobile behaviour, or full accessibility compliance. Existing data was inspected without mutation. The active local app lives in the worktree above; the top-level Commune checkout should not be mistaken for the source currently serving port 3000.

Recommended next implementation batch: fix Home/activity/search scope and stable routes first, then consolidate shared presentation without changing the approved layouts, then finish each missing workflow with browser and backend evidence.
