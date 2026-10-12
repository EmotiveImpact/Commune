# Hub prototype integration — 27 September 2026

## Sidebar follow-up — 28 September 2026

The 193px rail and footer measurements below document the earlier matched
capture, not the current sidebar. At the user's request, the desktop rail is
now 240–272px (responsive to viewport width) so the active commune name and
type fit. The original green home tile, compact switcher with chevron, and
small avatar/account treatment were restored; the newer wordmark, icon style,
and navigation placement remain.
The account footer shows the role and remaining reminder count without
repeating the active commune name. In-app browser checks confirmed the
switcher menu, Settings link, and reminder details stay usable and within the
rail. TypeScript, the web production build, and all 50 web tests passed. This
is a local change only; no push or deployment was done.

Source visual truth: `apps/web/reference/hub-prototype/index.html`, captured at
`/private/tmp/commune-hub-prototype-source.png` (1391 × 1853 px).
Implementation: `http://localhost:3000/hub`, captured at
`/private/tmp/commune-hub-final-1113.png` (1391 × 1816 px).
Both captures used the same 1113 × 946 CSS viewport in the Codex in-app browser,
light theme, the 3 Vicarage Grove example, and an approximately 1.25 px/CSS-px
capture scale (browser-reported DPR 0.8). The source has illustrative content;
the implementation shows the saved commune, so financial, task and note values
intentionally differ. Source and implementation were opened together as
`/private/tmp/commune-hub-comparison.png` for full-page composition and
`/private/tmp/commune-hub-focused-comparison.png` for sidebar, type and hero
detail.

## Findings and comparison history

- [P2, fixed] The first live pass showed a completed operation in “This week”
  while the Operations week view reported no open items. The Hub now filters
  completed operations out; the post-fix browser state shows 0 items and an
  Add a task or event route, and the final matched capture records the empty
  card. This is a data/interaction correction, not sample content.
- [P3, fixed] The live hero prefixed a household address with “Address” while
  the selected prototype used the address alone. Removed that visual prefix;
  trip Area/Stay labels remain to distinguish the two location fields.
- [P2, fixed during build] Earlier live iterations had a wider/heavier sidebar
  and different Hub row density. The matched capture now shows the 193px rail,
  wordmark at x14/y24, first Home row at y77, hero at x215/y77, and the same
  major card order and gaps as the source. No horizontal overflow at 1113px.

No actionable P0/P1/P2 findings remain in the selected desktop state.

## Five fidelity surfaces

- **Typography:** DM Sans 23px/700 wordmark; Inter 13px sidebar labels,
  32px/500 hero heading, 17px/600 section headings. The source and live
  computed families, sizes and weights match. Real longer commune/note names
  wrap or truncate within their cards rather than widening the grid.
- **Spacing/layout:** 193px sidebar; 60px header; 22px page inset; 277px hero;
  balance/statistics row, three-card row, two-card lower row, then members.
  Card gaps, radii, flat borders and nav/footer positions closely track the
  combined comparison. Desktop widths of 1113, 1391 and 1600px showed no
  horizontal overflow.
- **Colors/tokens:** navy sidebar/ink, cream page, white cards, sage balance
  and primary action, muted green unboxed section icons. No new drop shadows
  or decorative gradients.
- **Images/icons:** the same existing living-room image and crop are used for
  the default household cover; saved user photos still take precedence. The
  mobile-prototype wordmark and Lucide icon family are used in the real
  sidebar. No placeholder art was introduced.
- **Copy/content:** prototype financial and note data was not copied into the
  app. The live text reflects actual balances, open shares, operations, notes
  and members. The new section names are meaningful against the real routes.

## Functional and accessibility checks

In the local browser, Add expense opened the real form, outstanding-share
View opened its expense detail, a pinned note opened its reader, a task opened
its Operations detail, Invite someone opened the email/link form, and the
commune switcher listed existing communes and Create a commune. No forms were
submitted and no test records were created. An empty commune displayed its
empty-state actions. Semantic buttons/regions, focus styling and visible
labels were retained. Browser error log was empty. TypeScript, Vite production
build and all 50 web tests passed after the integration. No deployment or
push was done.

## Follow-up polish / limits

- [P3] The selected reference is desktop-only. The app's existing responsive
  breakpoints were retained and audited in CSS, but the in-app browser's
  temporary narrow-viewport override did not change its rendered tab size;
  this pass does not claim a visual phone-size comparison.
- Physical-device and hosted-environment verification are outside this local
  design pass.

**Implementation checklist:** keep the linked real-data actions; repeat a
phone-size visual pass when the browser viewport can be controlled; obtain
feedback on the live populated Hub before changing the direction again.

final result: passed

---

# Hub option 1 — 27 September 2026

Implemented the first displayed selected mockup in the existing live-data hub.
Source: `/Users/augustusedem/.codex/generated_images/01a0caea-a2a0-7ab0-a1c0-f65f6e7f5dba/exec-32a824ef-f3ab-463f-89e8-89e7d81dba90.png` (1487 x 1058).
Implementation: `http://localhost:3000/hub`.
Desktop capture: `/tmp/commune-hub-option1-full.png` (1859 x 2353), CSS viewport 1487 x 1057.
Mobile capture: `/tmp/commune-hub-option1-mobile.png` (490 x 3776), CSS width 392.
Source and full desktop capture were opened together in one comparison input;
compared at equal relative content width (capture density approximately 1.25).
In-app inline screenshot output cropped its right edge; the saved image opened
with the image viewer includes the full width. Full-page captures have stitching
artifacts around fixed chrome; DOM bounds additionally confirm no horizontal overflow.

## Findings and verification

- Typography: restored Inter via the established font token, stronger balance
  figure and section headings. Removed the hub's competing DM Sans family.
- Layout: large original cover, equal-width balance/statistics, three first-row
  panels, Recent expenses and Group essentials beneath, then Your people.
  White 14px-radius panels and simple note rows match the selected direction.
- Tokens/assets: warm cream, sage, navy, existing living-room photo and logo.
  No regenerated brand assets or decorative external-link arrows.
- Content: real account data intentionally differs from mock placeholders.
  Kept the functional settlement action rather than the mock's duplicate Add
  expense; kept search, commune settings and the commune switcher.
- Interactions: selected populated commune, opened pinned Bin collection in
  its real reader, returned to hub, expanded Quiet hours. No data mutated.
- Empty commune also rendered its existing functional empty states.
- Mobile: single-column layout and no horizontal overflow (392/392 CSS px).
- Browser error log: empty during verification.
- Focused checks used readable desktop labels and the separate mobile capture.

No actionable P0/P1/P2 design findings in the selected scope. P3: real-data
panels vary in height; the empty space beside a long essentials list can be
refined after feedback. Physical-device verification remains outside this pass.

final result: passed

---

# Notes board — design and functional QA (previous pass)

## Contact editor follow-up — 27 September 2026

Contacts now replaces the landlord-only category, supports custom names and
roles, and preserves legacy notes. The form has grouped responsive fields,
optional prose for structured notes, clear sharing copy and compact pinning.
Shared dialog label/checkbox fixes and privacy-aware Hub previews included.
39 tests and the production build pass; local-only changes.
See [three-window review and screenshots](audit/2026-09-27/window-review.md)
for evidence and remaining app-wide work.

The earlier Direction A and calendar review is preserved in
[the historical QA report](audit/direction-a-design-qa.md).

Date: 27 September 2026. Implementation: http://localhost:3000/notes.
Scope: the approved Notes board and reader in the existing application, not a
new prototype or a production-wide sign-off. Product Design image-to-code,
design QA, and React best-practices guidance used.

## Source visual truth

Directory: `/Users/augustusedem/.codex/generated_images/01a0caea-a2a0-7ab0-a1c0-f65f6e7f5dba/`

- Board: `exec-f97c1c8b-74ba-4af2-adc7-552059fa51f0.png` (1487 × 1058).
- Desktop reader: `exec-895e7e23-b1b2-4413-b71c-dec5b876f181.png` (1487 × 1058).
- Mobile reader: `exec-28e83751-d49a-40fa-bdcb-9d4e85340785.png` (853 × 1844).

## Browser evidence and normalization

All captures are in `audit/2026-09-27/`. Signed-in local test account, light
theme, six actual saved notes in Loading test home. Five fictional notes were
created through the real local API-backed form; no fixture data was added to
the application and no production records were changed.

- `notes-board-desktop-v2.png`: board, two pinned / four other notes.
- `notes-reader-desktop-v2.png`: Wi-Fi selected, password masked.
- `notes-reader-mobile-final.png`: full-screen Wi-Fi reader, password masked.
- `notes-board-mobile-filter.png`: Wi-Fi filter retained after returning.

Desktop CSS viewport: 1487 × 1057; full-page capture about 1859 × 1322.
Mobile CSS viewport: 392 × 847; full-page capture about 491 × 1059.
The in-app browser reports DPR 0.8 but emits full-page images at approximately
1.25 pixels per CSS pixel. Comparisons used equal relative content width:
desktop source at 1487 CSS-equivalent width, mobile source at ~393 width
(source density ~2.17). These are not pixel-difference measurements.

Each source and corresponding implementation was opened together in the same
comparison input. The mobile pair provided a readable, focused comparison of
the detail rows, reveal/copy controls, divider spacing, and action area; a
separate crop was unnecessary. Desktop card labels and controls were readable
in the full-view pair.

## Findings and iteration history

1. [P2, fixed] First desktop capture (`notes-reader-v1.png`) put icons above
   titles in the reader's board and made secondary cards unnecessarily tall.
   Changed reader cards to horizontal icon/text with 176px minimum height.
   Post-fix evidence: `notes-reader-desktop-v2.png`.
2. [P2, fixed] An auto-fill grid left unused tracks on wide boards and made
   four saved notes occupy only part of the row. Use four desktop columns,
   two with the reader/tablet, one on phones. Strengthened card borders to
   the existing border-strong token. Post-fix: `notes-board-desktop-v2.png`.
3. [P2, fixed] Initial mobile reader (`notes-reader-mobile-v1.png`) ended at
   content height, leaving a strip of the underlying page. Explicit 100dvh
   reader height now covers the viewport: measured 847.5px for an 847px CSS
   viewport. Post-fix: `notes-reader-mobile-final.png`; no horizontal overflow.

No actionable P0/P1/P2 findings remain in the tested states.

## Five fidelity surfaces

- **Typography:** existing Inter stack retained; 17px card titles, 14px card
  text, 28px reader heading, 16px mobile body. Existing compact page heading
  and sidebar sizing intentionally retained instead of enlarging the entire
  application to match the generated mock's chrome. Titles wrap/clamp without
  widening cards; full title/body remain available in the reader.
- **Spacing/layout:** pinned-first hierarchy, two large pinned cards, four
  smaller desktop cards, inline right reader, full-screen mobile reader.
  No backdrop or nested detail cards. 44px reader controls. Mobile body wraps
  to three lines for this content; acceptable at the app's readable text size.
- **Colors/tokens:** existing sage, cream, navy and muted-text tokens; flat
  cards with subtle borders; sage selection tint. No new decorative shadows.
- **Assets/icons:** original Commune logo and sidebar assets unchanged.
  Lucide's existing catalog version supplies matching outlined functional
  icons; no generated/hand-drawn replacement brand assets or raster UI.
- **Copy/content:** actual saved note types/order retained. No invented
  authors, comments or timestamps. Private-type card previews are generic;
  fields stay in the reader. Mobile mock's unexplained ellipsis omitted
  because Edit and Pin are already explicit working actions.

## Verification

- 35 web tests pass; TypeScript and production Vite build pass; diff check clean.
- Browser: create Wi-Fi/Bins/Keys/Landlord/House rules, pin/unpin, reveal/hide,
  copy network with success feedback, edit network, reload and verify saved
  value/pin, mobile Back and retained type filter.
- Regression tests: private preview/search exclusion, masked password and
  repeated body secret, copy success/failure, edit/update endpoint, failed
  pin leaves saved state intact, keyboard focus/Escape, missing-note recovery.
- Existing authenticated local and Neon note update endpoints reused. No
  schema, access grants, or RLS rules changed. Hosted Neon writes were not
  exercised in this local UI pass.
- Console inspected: one development hot-reload warning when an effect's
  dependency array was edited during the session. No further error appeared
  after a clean reload; no runtime API failures in the tested Notes flows.
- Masking is display privacy, not encryption or a new permission boundary.

## Remaining limits

Real-device/screen-reader coverage, collaborative edit conflict resolution,
and a hosted deployment smoke test are not included in this local handoff.
No deploy, commit or push performed. Other product gaps remain in the earlier
screen review; this does not declare the full application production-ready.

final result: passed
