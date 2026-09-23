# Design QA — Direction A rollout

**Result: PASS** — no open P0, P1, or P2 design discrepancies.

## Reference and implementation

- Reference: `artifacts/redesign-mockups/a-refined/`
- Product: `apps/web`
- Direction: sage `#2d6a4f`, cream `#f5f1ea` / `#f8f5f0`, navy `#1a1e2b`, Inter

## Visual comparison

- Compared the seeded Home screen side by side at the same 1200 × 900 viewport. Both full-page captures rendered at 1200 × 1117.
- Confirmed the desktop rail, header, photo cards, information hierarchy, card grid, spacing, border treatment, and primary colour system align with Direction A.
- The implementation intentionally uses state-derived decision copy instead of freezing the mockup's sample copy.
- A later user request restored the production-sized 44px logo and 18px uppercase wordmark, aligned to the navigation grid.

## Responsive and protected layouts

- Checked real layouts at 375, 390, 414, and 560px. They fill the viewport without native-preview gutters or the native status-band offset.
- Phone navigation keeps four primary tabs plus the More menu; all remaining destinations are available in More.
- Desktop `?native=1` remains an explicit preview mode.
- Operations keeps its date column at 72px desktop and 56px below 1000px, with weekday, number, and Today/Tomorrow stacked.
- Operations keeps Week / People / Month and Add item on one row. The control bar remains cream/beige with navy selected and sage Add item, with no coloured side edge or drop shadow.

## Interaction and runtime checks

- Confirmed hub switching, expense creation, per-expense settlement, mark-paid state, signup/onboarding, invite sign-in return and identity preservation, configured currency, notes, search, preferences, notices, payment methods, and reload persistence through the browser.
- Confirmed fresh page reloads produce no console errors or warnings.
- Confirmed `pnpm --filter @commune/web build` passes TypeScript and the Vite production build.

## Week date badge demo — 2026-09-23

- Source visual truth: `/var/folders/lt/n7wnxlrn0b753pnz7g41fzgc0000gn/T/codex-clipboard-2e715b96-68a4-45cc-93fe-d2e9af0b1d63.png` (204 × 192px standalone calendar illustration). The selected direction borrows its date hierarchy, not its red, rings, or shadow.
- Implementation: `http://localhost:3000/operations`, Week tab; browser capture `/private/tmp/commune-week-date-demo-final.png` (1558 × 1190px), focused region `/private/tmp/commune-week-date-demo-detail-final.png`, and forced-phone capture `/private/tmp/commune-week-date-phone.png` (2000 × 1125px canvas).
- Desktop capture viewport: 1246 × 952 CSS pixels at browser DPR 0.8; the capture is approximately 1.25 raster pixels per CSS pixel. The reference is a standalone icon, so the focused component crop is used to compare hierarchy rather than claim pixel-for-pixel page fidelity.
- Full-view evidence: the date stays in the existing 72px column beside the operation; the card, row, and page hierarchy are unchanged. Focused evidence: a slim sage weekday cap, larger navy number, and Today label reproduce the reference's readable date order without decorative coils or elevation.
- Responsive evidence: `?native=1` uses a 56px column and a 52px badge; the operation title and metadata remain readable without horizontal overflow.
- Typography: Inter and the existing weights remain; the number is 24px desktop / 22px compact, status 10px. Spacing: no wider date track or added shadow/coloured side edge. Colour: sage, cream, and navy match Direction A. Image quality: no decorative image asset was needed because the chosen treatment is an editable date UI, not a reproduction of the illustration. Copy: weekday, number, and Today/Tomorrow stay visible; a semantic `time` element exposes the ISO date.
- Interaction check: tapping the dated operation opened its detail and Close returned to Week. Browser error log: none. TypeScript check, Vite build, and `git diff --check` passed.
- Comparison history: first browser render matched the chosen hierarchy. The compact Today label was then raised to 10px for legibility; the final desktop and phone captures above show the correction. No actionable P0, P1, or P2 findings remain. Possible P3 iteration: compare a neutral weekday cap against sage after the user reviews the live page.

final result: passed
