# Recurring split-editor stability — local verification

The recurring editor's disclaimer moved when switching from Equal to Exact,
Percentage or Shares. The conditional inputs were slightly taller than the
avatar-only Equal rows. Native dialog centring amplified the layout change.

## Fix

- Shared SplitEditor keeps a 34px-tall control slot in every member row,
  including Equal and excluded people. Empty slots contain no hidden inputs.
- Allocation space remains present during validation. An invisible CSS sizing
  pseudo-element reserves the formatted total's width, keeping names from
  rewrapping when allocation results disappear. No guessed allocation is shown.
- Helper copy has space for two lines, or three on narrow screens. Longer
  errors can still grow normally rather than being clipped.
- Split calculations, submission behaviour, typography, colours and buttons
  are unchanged. The shared fix also applies to expense and split-template forms.

## Browser evidence

Used the Codex in-app browser and the local Browser QA House's existing Internet
bill. No bill was saved and no hosted service or production data was changed.

At a 1600 × 900 CSS viewport before the fix, Equal rows measured 57.23px and
Exact rows 57.97px. The disclaimer top moved from 703.46px to 704.20px.

After the fix, every method (Equal, Exact, Percentage, Shares) measured:

| CSS viewport | Disclaimer top | Action row top | Row height |
| --- | --- | --- | --- |
| 1600 × 900 | 715.06px | 773.79px | 59.22px |
| 390 × 843 | 673.48px | 752.58px | 59.22px |

At 320 × 843, every valid method had the same disclaimer content Y (850.72px)
and action content Y (970.57px) within the vertically scrolling dialog. An
invalid Exact split kept those same coordinates. The dialog's scroll width and
client width both measured 279px. Keyboard focus scrolled Save into view, with
the full action row above the dialog's bottom edge.

The screenshot `recurring-exact.jpg` shows the corrected form on desktop.

## Automated verification

- `pnpm --filter @commune/web test -- tests/split-editor.test.tsx`: the repository
  script ran all 13 files, 157 tests passed.
- Seven added tests cover all four methods and real penny-accurate allocations,
  reserved DOM slots, validation, excluded members and disabled pending controls.
- JSDOM tests do not measure geometry; position checks above were made in the
  real browser.
- `pnpm --filter @commune/web build`: TypeScript and Vite passed.
- `git diff --check`: passed.

Local changes only; not committed, pushed or deployed in this task.
