# Commune: one place, complete journeys

Design investigation and visual study · 29 September 2026 · London

Status: research and proposed screens, not a deployed redesign or a feature-completion claim.

## Recommendation

Keep the large place photograph, the original compact commune switcher and avatar, the wider sidebar, the lowercase wordmark and the local build's lighter typography. Organise the Hub around four questions: what needs me, what do I owe, what is happening next, and where is the shared information?

The emerging product is a shared place with a dependable memory: money, responsibilities, people and useful details connected to one household, workspace or trip. It should reduce the work of coordinating with other people. A new visual theme would not address the main problems found here.

The user’s unfinished phrase about “the ability to choose the way…” cannot be recovered with certainty. Expense split method, who paid, and payment method are plausible meanings. The first two are confirmed gaps in the current expense journey. Sidebar Basic/Advanced and Operations Week/People/Month already exist.

## Scope and evidence

Inspected the signed-in production app at https://app.ourcommune.io/hub, including an empty commune and a commune with recorded activity. Compared it with the current local app at http://localhost:3000/hub and its expense, Notes, Operations, settlement, recurring and invitation interfaces. Forms were opened and cancelled; no expenses, invitations, reminders or user records were submitted or changed during this review.

The active local product is `/Users/augustusedem/.codex/worktrees/commune-loading`, branch `codex/document-loading-incident`, with pre-existing uncommitted work. The root checkout at `/Users/augustusedem/Commune` is a different branch and older application. Neither dirty checkout was reset or replaced.

Evidence is a combination of current screenshots, visible DOM, and code inspection. This was an expert review, not a participant usability study, an end-to-end integration test, a load test or an accessibility certification. Production and local accounts contain different data. Production and local browser zoom differ, so screenshots establish hierarchy and interaction differences, not a pixel-for-pixel regression measurement.

Current-run private captures are in `/private/tmp/commune-hub-review.uLylWc/`. They were kept out of public application assets:

- `01-production-empty.png`: complete production empty Hub.
- `02-production-hub.png`: complete production populated-layout Hub.
- `03-production-expense.png`: production expense form.
- `06-local-expense.png`: local form, complete dialog visible; surrounding frame has capture padding.
- `07-local-notes.png`, `08-local-contact-reader.png`: local board and reader.
- `09-local-operations.png`: partial Operations frame; controls additionally checked in the DOM.
- `10-local-hub-full.png`: complete horizontal Hub composition; lower member rows are outside the captured area.

Initial local captures `04` and `05` were clipped and are not complete-frame visual QA. Later captures and code were used to verify the missing content. Generated screens use fictional data; they are not evidence of implemented behaviour.

## Journey audit

1. **Enter or switch a commune — needs refinement.** Production shows a strong place identity, but its empty ledger drops into a substantially different body layout. Local correctly uses the same Hub component for empty and populated ledgers, and keeps Notes and Operations available. However, the many zero totals and empty panels overwhelm a first visit. Keep the stable shell and photo; offer invitation and useful setup actions in the same content regions. Keep the current account-scoped cache/auth protections; do not mask loading failures as an empty commune. A production “Opening Commune” state was observed, but no latency cause or timing was established in this design review.

2. **Understand the Hub — needs refinement.** Production repeats balance information, empty settlement information and destination tiles already in the sidebar. Local replaces some of this with live tasks, pinned notes and shared details, but still presents four KPIs, three equal-sized secondary panels and large lower sections. In `Hub.css`, quick panels have a 225px minimum height and lower panels 295px even when nearly empty. The content does not justify that space. Use one personal balance summary, a short actionable queue, the week, and shared essentials. Detailed totals remain in Expenses/Funds; actions remain reachable through the sidebar.

3. **Record an expense — incomplete.** Both inspected forms expose equal splitting only and make “Paid by” read-only. The creator must be included. The limitation is also in `state.tsx: recordExpense` and the database function, so replacing the input with a dropdown alone would be misleading. Add equal, exact-amount, percentage and share/weight choices, preview every person's allocation, and allow a separately chosen payer. Validate membership, permissions, integer-minor-unit totals and rounding on the server. Include an expense-edit/correction journey before calling the ledger complete. No expense-edit control was found in the inspected detail flow.

4. **Settle and remind — partial, with a sound foundation.** Current settlement separates what you owe and what you are owed; only the original bill payer confirms receipt. Nudge is tied to an eligible outstanding share, Chase to a fund commitment. Preserve those domain rules. Add a contextual pre-send summary with recipient, amount, channel, cooldown and remaining allowance; report queued, delivered, suppressed and failed accurately. Do not label a database enqueue as email delivery. Commune currently records payment receipt; it does not transfer money. No reminder was sent and no provider delivery was re-tested in this review.

5. **Find a shared detail — promising.** The local Notes board, search, pinning and persistent side reader are useful advances. Sensitive previews are masked. Custom “Role or service” already exists in the contact editor; the earlier forced-landlord problem is not still present in this source. Keep that work. Improve density and reading hierarchy, and optionally group individual contact notes into a directory. Multiple people inside one contact document, as shown in the concept, would need a deliberate data/editor extension; the current editor says one person or service per note.

6. **Know what is happening — mostly present, incomplete affordances.** Operations exposes Week, People and Month plus task/event creation, assignee, date, optional time and repeat choices. Preserve the established narrow calendar column and same-row view switcher/Add item. The Hub's populated “This week” section shows up to five items but lacks a persistent View week/Add item action; the create link exists only in the empty state. Its filter is a rolling today-plus-six-days window, not a calendar week. Choose a truthful label (“Coming up”) or a Monday–Sunday calendar range and test overdue-item handling. Recurring tasks must remain distinguishable from recurring expenses.

7. **Invite someone — locally implemented interface, delivery unverified here.** The local invite form offers Send invitation and Create link only, email binding, role selection and pending invitation handling. Those are real improvements, not missing controls. Keep admin-only authorization consistent at the entry point and server, preserve partial success if link creation works but email fails, show delivery status separately from acceptance, and keep expiry/revocation clear. The Hub currently displays Invite someone without checking role, while the form disables submission for non-admins: avoid that dead-end action.

8. **Configure the place and longer-term use — several genuine gaps.** Address, destination, hotel/stay name and address fields exist. They are plain text inputs in `CommuneLocationFields.tsx`; Google address suggestions are not wired there. Recurring bills explicitly show “not enabled yet.” Settings says billing/payments are not connected. Photos and the signed-in avatar are still session-scoped by the earlier product decision. Payment-method wording promises browser-saved details, while the Pay flow says they are not stored or published: reconcile that contract before release. The Basic/Advanced preference description also no longer describes the current Basic navigation accurately.

## What to carry forward from each version

| Area | Production strength | Local strength | Combined decision |
| --- | --- | --- | --- |
| Place identity | Generous image and clear household identity | Address/stay context, lighter name | Keep a 280–320px photo hero and real place details; no expense action inside it |
| Shell | Familiar compact switcher/account | Wider sidebar, wordmark and calmer spacing | Keep the current widened shell and original footer behaviour |
| Money | Direct balance and expense entry | Clear sage balance region | One balance region; when owed and owing coexist, show both instead of silently netting them |
| Priority | Easy to see money state | Actual outstanding-share links and tasks | A short “Needs you” queue with explicit next actions and a correct count |
| Week | Activity is visible | Actual Operations items | Separate scheduled work from recent activity; never label expense history as this week's schedule |
| Notes | Shared information has a home | Searchable board, pinning, inline reader | Compact board and contextual reading; preserve masking and permissions |
| Empty state | Retains the place photo | Retains real product modules | Same shell; one invitation-led setup region, not multiple giant “nothing here” panels |
| Reminders | Available on obligations | Account allowance moved out of page toolbars | Small account counter; explanation and delivery status only where a reminder is being sent |

## Important semantic corrections

- `hub.moves` already includes shares involving the current viewer; it is not every debt in the commune. The improvement is to distinguish an action due from an amount merely outstanding, and include assigned tasks in a deliberately designed queue. It is not a fix for a proven cross-user leak.
- Current recent-expense dates and activity dates are derived from the same expense ordering. Index coupling is fragile, but this review did not establish a wrong displayed date. Prefer the expense's own timestamp when refactoring.
- “No expenses” is not “no commune,” “you are even” is not “the whole house is settled,” and “invitation emailed” is not “member joined.” These states need different copy and actions.
- A contact role, expense category, pinned state and note type are separate concepts. Do not encode one by forcing the user to pick another.
- Keep household/workspace/trip language context-aware. “House contacts” is appropriate for this illustrative household, not every commune type.

## Design system contract

Use existing Inter rather than introducing another UI family. Keep the selected lowercase DM Sans wordmark. Suggested exact CSS targets: body 15px/400 with 1.5 line height, labels 14px/500, section headings 18px/500–550, place title 32px/500, balance 42px/450 with tabular numerals. Loaded font support must determine whether intermediate weights are real or synthesized. The generated pictures are approximate; do not copy any accidentally heavy raster weight into CSS.

Keep navy `#1a1e2b`, sage `#2d6a4f`, cream `#f5f1ea`/`#f8f5f0`, and restrained off-white panels. Use muted sage-gray outline icons consistently, mainly in section headers and useful field affordances. Avoid icon badges everywhere. Give each region a job; use spacing and separators before adding another card.

Desktop sidebar remains the current 240–272px responsive width. Keep the original switcher and account footer; no duplicated active commune name beneath the user. Long labels truncate visually with the complete accessible name preserved. At narrower widths, use the existing responsive navigation approach rather than crushing content beside a desktop rail.

Operations retains its 72px date column, 56px below 1000px, with weekday, number and Today/Tomorrow stacked. No shadow or coloured edge. Week/People/Month and Add item stay on one row. New week-navigation controls shown in the concept are proposals, not already-implemented functionality.

One filled primary action per local task area. A first-time Hub can prioritise Invite; an established Hub keeps + Add expense on the balance region. Use quiet links for navigation. Do not use ↗ for internal routes. An unsaved form needs one consistent Cancel/back policy and focus restoration; the raster expense image's duplicate Cancel is a refinement item, not a requirement.

## Human-centred rules to implement and test

- Recognise the place immediately; maintain the photo and shell during background refresh when a valid account-scoped snapshot exists.
- Preserve trustworthy distinctions: loading, confirmed empty, stale-but-usable, permission error and failed save. A first uncached visit may need a lightweight skeleton; never fabricate populated content to eliminate all loading feedback.
- Show allocation and consequences before committing money-related changes. Keep unsaved input on failure; make retries idempotent.
- Keep reminder language neutral. Avoid public shaming, pressure, automatic bulk reminders and misleading “delivered” claims.
- Provide clear keyboard focus, Escape/return-focus for overlays, semantic labels, live save/error feedback, non-colour status cues and sufficiently large targets. Meet WCAG AA contrast in implementation, including muted text; the generated images are not measured accessibility evidence.
- Mask Wi-Fi/access secrets in cards and global search. Reveal/copy within the authorized detail view; do not leak them into logs or notifications.
- Respect reduced motion, 200% zoom, small screens and long names/addresses. Test both one-person and larger communes, each role, zero data, mixed balances, overdue items and connection loss.
- On mobile, make the reader a proper full-screen destination with Back; do not squeeze a desktop side panel. Keep the approved mobile direction rather than copying the desktop sidebar.

These are design hypotheses to validate. A small usability round should ask people to find Wi-Fi, invite a housemate, split an uneven bill, identify their task and send one appropriate reminder. Record completion, errors, hesitation and understanding of who can see or change the record. Do not invent success rates before testing.

## Research: patterns and reusable building blocks

1. **Progressive disclosure:** put frequent choices and the consequences up front; expose less frequent detail through a clear, labelled control. Apply this to expense optional details and reminder explanations, while keeping split method and payer visible because they change the meaning of the expense. [Nielsen Norman Group](https://www.nngroup.com/articles/progressive-disclosure/).

2. **Context-preserving detail:** Basecamp's current product keeps notifications alongside work and separates action-oriented home context from project detail. The transferable lesson is to keep the current place visible while reading a note or preparing a reminder. This is a pattern reference, not a recommendation to reproduce Basecamp's visual style or add chat. [Basecamp 5](https://basecamp.com/5).

3. **Spliit — workflow reference, MIT.** Its open-source expense product includes unequal splitting, participant selection and reimbursement flows. Use it to compare interaction edge cases and test scenarios. Its Next.js/Prisma application is not a drop-in replacement for this Vite/Neon app. Avoid importing a second application architecture just for a split selector. [Repository and license](https://github.com/spliit-app/spliit).

4. **React Aria — strongest component candidate, Apache-2.0.** Unstyled React controls can supply keyboard, focus, select, dialog and date-picker behaviour while Commune retains its own appearance. Introduce only the primitives a specific flow needs; run a compatibility/bundle check against this React 19 project before adopting. A library does not automatically make the complete journey accessible. [Official documentation](https://react-aria.adobe.com/), [repository and license](https://github.com/adobe/react-spectrum).

5. **Pragmatic drag and drop — optional, Apache-2.0.** Worth considering only if pinned-note ordering becomes a demonstrated need. It is headless and incremental. Its core does not automatically provide accessible controls; any drag operation needs a keyboard/menu alternative. A “Move up/down” menu may be sufficient without a dependency. [Repository](https://github.com/atlassian/pragmatic-drag-and-drop), [license](https://github.com/atlassian/pragmatic-drag-and-drop/blob/main/LICENSE), [accessibility guidance](https://atlassian.design/components/pragmatic-drag-and-drop/accessibility-guidelines).

6. **Commune's own existing core — inspect before importing more.** The root checkout already has equal, percentage and exact-amount split helpers in `packages/core/src/splits.ts`. They accept major currency units and return amounts, whereas the current API accepts minor units. Reuse the underlying rounding approach and tests only after adapting the boundary, validating percentages and membership, and making the current server authoritative. This code is an existing asset, not evidence that the current UI supports those methods.

No dependency was installed, copied wholesale or migrated during this research. The recommended first technical addition is a narrowly scoped accessible form primitive if current components cannot meet the interaction contract. Dragging and rich-text editing are lower priority than complete, correct expense and invitation journeys.

## Visual study and functional boundary

Six connected scenes explore one direction, rather than six competing brands:

| Scene | What the image explores | Existing foundation | Still requires implementation/validation |
| --- | --- | --- | --- |
| Active Hub | Photo identity, personal next steps, week and essentials | Real Hub data, expense links, Operations, Notes | Combined priority queue, reduced repetition and reliable section actions |
| New commune | Same place identity with invitation-led setup | Same local Hub component; invite and note forms | Contextual setup state and compact empty sections |
| Add expense | Payer selection, split choices and live allocation preview | Equal split creation and server-validated shares | Payer/creator separation, methods, correction/edit flow and tests |
| Notes & contacts | Compact board and in-context grouped directory | Reader, custom role field, pin/search/masking | Optional grouped contact editor/data contract |
| Settlement & Nudge | Recipient-specific preview, allowance and channel/timing clarity | Current share confirmation and reminder rules | Preview/status presentation and provider-backed delivery proof |
| Operations | Same established layout with clear dated rows | Week/People/Month, task/event CRUD and repeat choice | Week navigation shown in mock and populated/empty/responsive QA |

The illustrative scenes are separate moments, not a single synchronized dataset. Settlement introduces an additional receivable to demonstrate simultaneous owing/owed states. Early image-generation drafts contained copy mismatches; corrected images replace the empty-Hub footer and reminder privacy/timing copy. Search placeholders inherited from the old reference and exact typography must follow the implementation contract above, not be treated as features already available. Currency remains the commune's currency unless a separate multi-currency design is approved; the raster selector is not a multi-currency commitment.

## Build sequence and completion criteria

**First: converge the visual contract and shell.** Confirm this study, then implement the Hub as one component with explicit new/active/error/stale states. Preserve footer, sidebar width, photo sizing, navigation and existing data handlers. Keep the current typography's lighter character. Do not rewrite Auth, data transport or deployment to achieve a layout change.

**Second: complete the expense journey vertically.** Payer and split method → minor-unit allocation preview → server membership/total validation → persisted detail → correction/audit history → settlement. Test excluded creator, payer not sharing, percentage rounding, tiny values, changing members, currency, retries and concurrent edits. Do not enable payer selection until server authorization and settlement ownership use the selected payer correctly.

**Third: make coordination dependable.** Invitation send/link/accept/revoke with role checks; contextual Nudge/Chase states and allowance refresh; recurring bills with explicit schedule, next occurrence, pause/skip and duplicate prevention. Treat bills as ledger generation, not an authorization to charge someone. Implement or clearly mark the missing address finder with manual-entry fallback.

**Fourth: complete shared memory and polish.** Refine Notes/contact grouping, exact icon/type tokens, responsive layouts, keyboard behaviour and state copy across all forms. Preserve existing stored notes and role labels. Review session-only imagery as a separate product persistence decision rather than quietly changing it.

Completion is evidence: each critical journey works with two real roles, persists after reload, handles failure without losing input, has no dead-end controls, and has responsive/keyboard checks. Production integration, real email delivery and performance are separate gates. Six attractive screens do not satisfy those gates by themselves.

## What this review changed

Created this investigation and a six-screen visual study. Restarted the existing local Vite app and local PostgreSQL API for inspection. No product code, production settings, records, database schema, Git commits, PRs or deployments were changed. Existing uncommitted work was preserved.
