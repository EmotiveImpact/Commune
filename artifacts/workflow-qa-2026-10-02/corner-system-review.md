# Corner system and next upgrades — 2 October 2026

Scope: the running local app, its shared corner rules, Hub, Add expense and Notes. The corner changes are implemented locally; the remaining findings below are recommendations, not completed features. No shared records were edited and nothing was deployed.

## Implemented rule

- Controls: **9px** — search, bell/menu actions, primary/secondary buttons, fields, close controls and auth controls.
- Surfaces: **15px** — shared cards, the Hub photo hero, Notes cards/readers, dialogs and the top corners of narrow dialog/menu sheets.
- Round shapes remain intentional for portraits, status badges and filter tracks. Clickable cards remain surfaces, not ordinary action buttons. Approved Operations calendar geometry is unchanged.

`apps/web/src/styles/shared.css` owns the three tokens. Legacy radius names now reference those tokens. The product guide and design-language document reflect the same rule. Layout, fonts, colours, chosen photos and application state were preserved.

## Captured steps

### 1. Hub before — inconsistent controls

Search and notification controls had 999px corners; hero actions had 8px; Add expense had 9px. The photo identity and calm two-column content structure already worked and were retained.

![Step 1 — Hub before](/Users/augustusedem/.codex/worktrees/commune-loading/artifacts/workflow-qa-2026-10-02/corners-01-before.jpg)

### 2. Hub after — shared controls aligned

Computed search, bell, hero actions and Add expense now use 9px. The hero and main panels use 15px. Portraits remain circular. Other layout decisions were not changed by this pass. Header controls are still 38px high versus the 40px standard action: a future control-size pass should resolve that separately.

![Step 2 — Hub after](/Users/augustusedem/.codex/worktrees/commune-loading/artifacts/workflow-qa-2026-10-02/corners-02-hub-after.jpg)

### 3. Add expense — corners aligned; field layout needs attention

Inputs, Save, Cancel and close share 9px corners; the dialog and split-summary surface use 15px. Amount and Paid by inputs do not line up, explanatory text makes the row uneven, and the lower action area needs more deliberate spacing. Opening Add expense from Hub also moves the underlying page to Expenses; cancelling should preserve the user's source context. The form was cancelled without saving.

![Step 3 — Add expense](/Users/augustusedem/.codex/worktrees/commune-loading/artifacts/workflow-qa-2026-10-02/corners-03-expense-form.jpg)

### 4. Notes and reader — shared controls aligned; existing interaction retained

Search, filter select, Add note and reader actions now share the control rule; the note tile and reader share the surface rule. An existing pinned note opened and closed, restoring focus to its tile. No values were edited or copied.

![Step 4 — Notes and reader](/Users/augustusedem/.codex/worktrees/commune-loading/artifacts/workflow-qa-2026-10-02/corners-04-notes.jpg)

### 5. Lower Hub — useful structure, unfinished recent section

Recent expenses still has a transparent background, 6px/2px padding, no border and no radius, versus the white 23px-padded main panels. Its visible heading suggests broader commune activity although the section contains only expenses. Empty Needs you and This week areas occupy substantial height for one sentence. These are the clearest remaining screen-level mismatches.

![Step 5 — Lower Hub](/Users/augustusedem/.codex/worktrees/commune-loading/artifacts/workflow-qa-2026-10-02/corners-05-hub-lower.jpg)

## Next upgrades, in order

1. Align form labels/fields/helper text and give dialogs a consistent action footer. Use the existing lighter heading weights; no font change is needed.
2. Give recent expenses the established panel treatment and an accurate label. Broader recent activity should include actual linked updates, not decorative placeholder content.
3. Make empty sections more compact while preserving headings and useful actions.
4. Preserve the source page when opening and closing actions/details from Hub.
5. Complete the control-size and interaction-state pass: standard heights, visible keyboard focus, consistent disabled/pending states and unobtrusive hover feedback.

## Verification and limits

- All five exact screenshots were saved and inspected in this run. Computed styles confirmed the cited corner/padding values.
- `pnpm --filter @commune/web test`: **100 tests passed**, including 23 new CSS token contracts.
- `pnpm --filter @commune/web build`: TypeScript and Vite passed.
- CSS contracts guard source rules; they do not replace browser verification. Fresh browser evidence covers the desktop screens above, not an exhaustive product audit.
- Control names were exposed in the accessibility tree and Notes focus restoration was checked. Contrast, full keyboard/screen-reader journeys and touch target usability are not certified by these screenshots.
- Narrow sheet rules use the shared token, but mobile reflow, dark mode and signed-out auth were not re-exercised in the browser in this pass. Backend permissions, hosted data and email delivery were outside this design change.
