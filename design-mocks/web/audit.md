> **Historical.** This audit is of the earlier Mantine app, which has since been
> replaced. It is kept for the record; the approved design direction is
> [docs/DESIGN-LANGUAGE.md](../../docs/DESIGN-LANGUAGE.md).

# Commune Web — UI Design Audit (punch list)

READ-ONLY audit. The "calm" (de-colour) pass went too far: brand colour was stripped from accents and status, controls were left at Mantine's small defaults, and the only segmented control on the app (Active/Paused) has zero custom styling so it renders as a thin grey pill. Below is a prioritised, file-anchored punch list with concrete fixes.

Stack facts that drive the fixes:
- Mantine 9 button heights: `xs` 30px · `sm` 36px · `md` 42px · `compact-xs` 22px · `compact-sm` 26px. SegmentedControl control heights: `sm` ~32px · `md` ~36px · `lg` ~42px.
- Theme (`routes/__root.tsx:35`): `primaryColor: 'commune'`, **no `primaryShade` set** so the default shade is 6 = `#1f7a6a` (a teal-leaning green, not the deeper `--commune-primary` `#2d6a4f`/navy the brand wants). Button default is `size: 'md'`, `radius: 'lg'`.
- `styles.css` has **no `mantine-SegmentedControl-*` rules at all** — confirmed by grep. The toggle is 100% unstyled Mantine default.

---

## TOP 5 (fix these first)

1. **Active/Paused SegmentedControl is unstyled and thin** — `routes/_app/recurring.lazy.tsx:222`. No `size`, no CSS. Renders as a ~32px flat grey track. Add `size="md"` and a `.commune-segmented` CSS treatment (see Segmented control §1).
2. **No SegmentedControl styling exists anywhere** — `styles.css` (whole file). Every toggle (recurring, pricing, settings, templates, expenses/new) inherits the bland default. Add a global `mantine-SegmentedControl` block so the active indicator carries brand green and the track has real height/contrast (Segmented control §2).
3. **KPI tones flattened to one grey** — `styles.css:640-647`. All six `data-tone` values collapse to `--commune-paper-soft`. Combined with grey icons this makes every metric card a colourless box. Reintroduce *subtle* tinted left-accents or icon tint per tone (Colour §1).
4. **Group toolkit tiles are all grey** — `routes/_app/groups/$groupId/index.lazy.tsx:561`. Six `ThemeIcon variant="light" color="gray"` tiles read as a wireframe. Switch icon tiles to `color="commune"` (or per-tile brand colours) (Group page §1).
5. **Primary buttons read flat/thin** — global. Default green button is shade 6 `#1f7a6a` with `radius:'lg'` but the brand wants the deeper green `#2d6a4f`/navy and more presence. Set `primaryShade: { light: 7, dark: 5 }` in theme and give filled buttons a subtle shadow (Controls §1).

---

## Controls (thin / weak)

**C1 — Primary buttons sit at default weight with no depth.** `routes/__root.tsx:72` (`Button defaultProps`) + `styles.css:666-669`.
The filled CTA is shade-6 green, `font-weight:600`, no shadow. It reads thin against the warm paper bg.
Fix: in the theme set `primaryShade: { light: 7, dark: 5 }` (uses `#1a6658`/deeper). In `.mantine-Button-root[data-variant="filled"]` add `box-shadow: 0 1px 2px rgba(20,73,78,0.25), 0 2px 6px rgba(20,73,78,0.12);` and `font-weight:700`. Keep height at `md` (42px) — that part is fine.

**C2 — Header/page CTAs inherit `md` but are visually thin because of letterspacing/weight, not height.** e.g. `routes/_app/groups/index.lazy.tsx:116`, `routes/_app/chores.lazy.tsx:281`, `routes/_app/expenses/index.lazy.tsx:419`.
These are the main "New group / Add expense" actions. Height is OK (42px); the problem is they're low-contrast and weight-600.
Fix: bump label weight to 700 globally (C1) and ensure the primary CTA uses filled brand green, not `variant="default"`.

**C3 — `compact-xs` / `compact-sm` buttons are far too small for real actions.** `routes/_app/chores.lazy.tsx:579` & `:583` (Complete / Delete), `routes/_app/expenses/index.lazy.tsx:594` & `:604` (approve/reject), `routes/_app/overview.lazy.tsx:486`, `routes/_app/groups/$groupId/index.lazy.tsx:1006` (Add moment), `:428-436` (Cycle close), `routes/_app/groups/$groupId.edit.lazy.tsx:455`.
`compact-xs` is 22px tall — these are core row actions and read as fragile links.
Fix: promote action buttons to `size="xs"` (30px) minimum, or `size="sm"` for primary row actions. Reserve `compact-*` for inline text-link affordances only.

**C4 — `Badge size="xs"` used for status everywhere.** `routes/_app/groups/$groupId/index.lazy.tsx:411,687,912,928,939,941,945` and `groups/index.lazy.tsx:236`.
Status badges (Owner/Admin/Settled/Owes) at `xs` are tiny and, with `color="gray"`, nearly invisible.
Fix: use `size="sm"` for status badges; keep `xs` only for inline percentage chips. (Colour fixes for these in Colour §3.)

**C5 — Header search input is `size="sm"` (36px) and very low contrast.** `components/app-shell.tsx:177` + `styles.css:335-345` (`font-size:0.85rem`, `box-shadow:none`, border `--commune-border`).
Against the `--commune-paper` header it nearly disappears.
Fix: `size="md"` (40px), `border-color: var(--commune-border-strong)`, and a faint inset so it reads as an input. Bump font to 0.9rem.

**C6 — Filter inputs in the filter bar are `size="sm"`.** `routes/_app/expenses/index.lazy.tsx:658-661` (Select w=260 size="sm"), and FilterBar children generally.
At 36px next to 42px buttons the bar looks uneven.
Fix: standardise filter-bar controls to `size="md"` so heights line up with adjacent buttons.

**C7 — Filter chips are thin and low-contrast.** `styles.css:1090-1113`.
`padding:0.35rem 0.85rem` (≈28px tall), `font-weight:500`, `border:none`, inactive bg `--commune-paper` (`#faf9f7`) is barely off the page bg. They look like plain text.
Fix: `padding:0.5rem 1rem` (≈34px), `font-weight:600`, add `border:1px solid var(--commune-border)`, inactive bg `var(--commune-paper-strong)`. Active state should be a confident brand fill (Colour §4), not pale mist.

---

## Colour (bland / colourless)

**Col1 — KPI `data-tone` flattened to a single neutral.** `styles.css:640-647`.
All of `sage/peach/lilac/ink/sky/mist` resolve to `--commune-paper-soft`, so `MetricCard` tones do nothing. Cards across recurring (`recurring.lazy.tsx:202,209`), funds (`funds.lazy.tsx:632,639,646`), cycle close (`groups/$groupId.close.lazy.tsx:270-306`) are all identical grey boxes.
Fix: give each tone a *subtle* identity — e.g. a 3px left accent border + faint tinted bg:
```
.commune-kpi-card[data-tone='sage'] { border-left:3px solid var(--commune-primary); background: color-mix(in srgb, var(--commune-primary) 5%, var(--commune-paper-strong)); }
.commune-kpi-card[data-tone='mist'] { border-left:3px solid var(--commune-icon-info); ... }
```
Keep it restrained (5–8% tint) so it's "calm" but not dead.

**Col2 — Metric/stat icons are hardcoded grey at 50% opacity.** `groups/$groupId/index.lazy.tsx:463,475,488,507` (`color:'var(--commune-ink-soft)', opacity:0.5`).
The four headline KPI icons (spend, members, expenses, setup) are washed-out grey. There's a perfectly good `.commune-metric-icon` (brand green tint) at `styles.css:661` that these don't use.
Fix: wrap each in a `ThemeIcon variant="light" color="commune"` (or apply `.commune-metric-icon`) so the icon carries brand green. Vary by metric if you want status meaning (green spend, navy members).

**Col3 — Status badges defaulted to `color="gray"`.** `groups/$groupId/index.lazy.tsx:410,687,928(partial)` and `groups/index.lazy.tsx:236`, `recurring.lazy.tsx:269`.
Type labels (Household/Friends) and category chips are grey — fine — but several *status-bearing* badges are also grey, killing the signal. The brand wants RED for negative status and green/navy for positive.
Fix: keep neutral grey only for taxonomy (group type, category). For status use `color="green"` (settled), `color="red"` (overdue/owes), `color="blue"`/navy (owed). The health badge at `:418-421` already does this correctly — extend that discipline.

**Col4 — Filter-chip active state is pale and weak.** `styles.css:1104-1108`.
Active = `--commune-mist` bg (`#d9ebe5`, a near-white mint) + `--commune-primary-strong` text. On the warm paper page the "selected" chip barely differs from hover.
Fix: make active a solid confident fill: `background: var(--commune-primary); color:#fff;` (or `--commune-primary-strong`). That gives a clear selected state and reintroduces brand colour.

**Col5 — `commune-primary-btn` helper strips all depth and is unused.** `styles.css:352-358`.
It forces `box-shadow:none !important` and exists but no `.tsx` references it (grep: 0 hits). Dead, and the `!important` shadow-kill is exactly the wrong instinct.
Fix: delete it, or repurpose into a real brand-CTA class that *adds* depth (see C1). Flag as dead code regardless.

**Col6 — Sidebar is navy but the rest of the app never echoes navy or deep green.** `styles.css:370` (sidebar gradient `#1a1e2b`) vs. content area which is all warm-grey + teal.
The brand is "deep green + navy" but navy lives only in the sidebar; the content column has no navy anchor, so headers/KPIs feel disconnected and pale.
Fix: bring navy into content as a deliberate accent — e.g. `.commune-page-header-title` in `--commune-ink` is fine, but section headings, the primary metric value, or a hero strip on the group page could carry navy/deep-green to tie the palette together.

**Col7 — Table headers use a warm cream that reads as "unstyled".** `styles.css:606-614` (`background: rgba(255,248,240,0.9)`).
Against white rows it's a muddy off-white, not a deliberate header.
Fix: use `var(--commune-paper-soft)` or a faint brand tint (`color-mix(in srgb, var(--commune-primary) 4%, #fff)`) and keep the uppercase label — it'll read as an intentional header band.

---

## Group page (`groups/index.lazy.tsx` + `groups/$groupId/index.lazy.tsx`)

**G1 — Toolkit tiles are a grey wireframe.** `$groupId/index.lazy.tsx:561` — `ThemeIcon size={38} variant="light" color="gray"` ×6.
This is the most prominent "weak" block on the page: six identical grey-icon tiles.
Fix: `color="commune"` for all, or assign each tile a brand-family colour (Expenses=green, Funds=gold, Members=navy, Analytics=teal). Add `fw={700}` is already there; bump tile hover to lift more (`commune-group-card` hover exists, good).

**G2 — KPI row icons washed out (see Col2).** `$groupId/index.lazy.tsx:463,475,488,507`. Same fix.

**G3 — "Settle up" primary action is `variant="default"` (grey), not branded.** `$groupId/index.lazy.tsx:528-533` and the secondary settle button `:645-655` is `variant="light" color="orange"`.
The two competing settle buttons (one grey "default", one orange "light") are inconsistent and the grey one doesn't look clickable.
Fix: make the top "Settle up" a branded secondary (`variant="light" color="commune"`) and keep "Add expense" as filled green. Pick ONE settle treatment and reuse it.

**G4 — Cover-overlay "Cycle close" button is `compact-xs` `variant="white"`.** `$groupId/index.lazy.tsx:428-436`.
A 22px white button floating in the cover photo metadata row looks like an afterthought next to the badges.
Fix: `size="xs"` minimum, and consider `variant="light"` so it doesn't fight the cover gradient. Align it visually with the member-count/created chips.

**G5 — Member cards: status badges at `xs` + `variant="dot"` are faint.** `$groupId/index.lazy.tsx:939-947`.
Owes/Owed/Settled (the financially important info) is the smallest, lowest-contrast element on the card.
Fix: `size="sm"` and `variant="light"` (filled dot) so the money status is legible. This is the data users care about.

**G6 — Group list cards: type badge `size="xs" color="gray"` + member count tiny.** `groups/index.lazy.tsx:236,239-243`.
The card body under the gradient header is bland — a grey label and a 13px icon.
Fix: keep the gradient header (it's the one colourful part), but give the body more weight: `Badge size="sm"`, and let the active card's green outline (already at `:164`) be matched by a green "Active" badge (already `color="green"` at `:197` — good, keep).

**G7 — "Your position" stat block has no visual anchor.** `$groupId/index.lazy.tsx:612-658`.
Four centered stats in a plain soft-panel; the status badge varies colour (good) but the panel itself is flat.
Fix: add a thin top accent (`borderTop: 3px solid var(--commune-primary)`) or tint, consistent with the pinned-message panel which *does* have a `borderLeft` accent (`:741`). Make the financial panels feel like dashboards, not notes.

**G8 — Section heading icons are bare grey tabler icons.** `$groupId/index.lazy.tsx:613,664,793,852` (`IconAlertCircle/IconReceipt/IconActivity/IconUsers size={18-20}` inline, default colour).
Each section ("Your position", "This month's breakdown", "Recent Activity", "Members") leads with a thin grey icon.
Fix: wrap in a small `ThemeIcon variant="light" color="commune" size="md"` for a consistent branded section-marker, or drop them — but don't leave bare default-colour icons.

---

## Segmented control / tabs

**S1 — Active/Paused has no `size`.** `routes/_app/recurring.lazy.tsx:222`.
Defaults to `sm` (~32px). For a primary tab switch it's too short.
Fix: add `size="md"` (or `lg`). Also consider `fullWidth` is *not* set here while templates/expenses use it — decide per context; for a 2-option tab, a left-aligned `md` is fine but it must be styled (S3).

**S2 — Other SegmentedControls are inconsistent on size.** `pricing.lazy.tsx:212` (`size="sm"`), `settings.lazy.tsx:322` (no size → sm), `templates.lazy.tsx:414` (`fullWidth`, no size), `expenses/new.lazy.tsx:701` (`fullWidth`, no size).
Three different configurations, all small.
Fix: standardise on `size="md"` across all five, and rely on the global CSS (S3) for the look.

**S3 — There is NO CSS for SegmentedControl.** `styles.css` (absent).
This is the root cause of "looks horrible". Mantine's default is a flat light-grey track with a white indicator and tiny labels — exactly the bland look the founder flagged.
Fix: add a global block so it carries the brand and has presence:
```
.mantine-SegmentedControl-root {
  background: var(--commune-paper-soft);
  border: 1px solid var(--commune-border);
  border-radius: 12px;
  padding: 4px;
}
.mantine-SegmentedControl-control { font-weight: 600; }
.mantine-SegmentedControl-label {
  color: var(--commune-ink-soft);
  padding: 6px 16px;            /* real height */
}
.mantine-SegmentedControl-label[data-active] { color: #fff; }
.mantine-SegmentedControl-indicator {
  background: var(--commune-primary);   /* brand fill, not white */
  box-shadow: var(--commune-shadow-sm);
  border-radius: 8px;
}
```
Add a `[data-mantine-color-scheme="dark"]` variant mirroring the other dark overrides. This single block fixes every toggle including Active/Paused.

**S4 — No real tab component is used anywhere** (no Mantine `Tabs`); navigation-as-tabs is done via SegmentedControl. That's fine, but it means S3 must be solid since it's the *only* tab affordance. (Noting for consistency — once S3 lands, all "tabs" inherit it.)

---

## Misc (spacing / radius / weight inconsistencies)

**M1 — Button radius is defined twice and disagrees.** Theme sets Button `radius:'lg'` (`__root.tsx:72`) but `styles.css:666` forces `.mantine-Button-root { border-radius: 16px }`. `lg` in Mantine is 10px → the CSS wins at 16px, making buttons rounder than the `md`(8px)/`lg`(10px) used on cards/inputs.
Fix: pick one. 16px buttons next to 16px cards (`commune-soft-panel`) is defensible, but inputs are `md`(8px) — so inputs and buttons in the same row have different corners. Align inputs to match (or soften buttons to 12px).

**M2 — Card radius is inconsistent across the app.** `commune-soft-panel`/`commune-stat-card`/`commune-kpi-card` = 16px (`styles.css:308,318`), but `commune-kpi-card` base is `12px` (`:634`), and `commune-table-shell` is `12px` (`:594`), while Papers in JSX pass `radius="lg"`(10px) or `radius="md"`(8px) ad hoc (e.g. `$groupId/index.lazy.tsx:287 radius="lg"`, `:612 radius="md"`).
Fix: settle on a token scale (cards 16, inner elements 12) and stop passing per-Paper `radius` that fights the class.

**M3 — Two different page-title sizes.** `.commune-page-title` 1.75rem/800 (`styles.css:577`) vs `.commune-page-header-title` 1.5rem/800 (`:1023`). Pages using `PageHeader` (most) get the smaller title; a few using `commune-page-title` get the bigger one.
Fix: pick one page-title scale and use `PageHeader` everywhere.

**M4 — `ThemeIcon color="gray"` as a default accent throughout.** dashboard `index.lazy.tsx:831,844,857`, group toolkit `:561`.
Grey ThemeIcons are the signature of the over-aggressive de-colour. The brand colour `commune` is available and barely used for accents.
Fix: default decorative ThemeIcons to `color="commune"` (light variant) so accents are branded; reserve grey for genuinely inert/disabled affordances.

**M5 — Progress bars: gradient defined but `color="commune"` passed inline.** `styles.css:1008` defines a nice `.commune-soft-progress` gradient, but `$groupId/index.lazy.tsx:700` uses plain `color="commune"` (flat). Inconsistent — some progress is gradient, some flat.
Fix: route category/breakdown progress through `.commune-soft-progress` for the richer gradient, or drop the gradient class if you want them all flat. Be consistent.

**M6 — Section dividers use raw Mantine border var, not the commune token.** `$groupId/index.lazy.tsx:709` (`var(--mantine-color-default-border)`) while everything else uses `var(--commune-border)`. Minor, but it's a different grey.
Fix: use `var(--commune-border)` for consistency.

**M7 — Member grid defined twice / unused class.** `.commune-member-grid` (`styles.css:1151`) is `repeat(2,1fr)`, but the group page renders members with `SimpleGrid cols={{base:1,sm:2}}` (`$groupId/index.lazy.tsx:868`) — the CSS class isn't used there. Check for dead CSS.
Fix: confirm `.commune-member-grid` is referenced (members route); if not, remove.

---

### Summary of the through-line
The de-colour pass replaced *brand colour* with *grey* on accents (ThemeIcons, KPI tones, status badges) and left every interactive control at Mantine's small/flat defaults, while never styling the one toggle pattern the app relies on. The fix is not "add colour back everywhere" — it's: (a) style the SegmentedControl globally with a brand indicator, (b) give controls real height/weight/depth, (c) restore *restrained* brand green + navy to accents and confident RED/green/navy to **status**, and (d) reconcile the duplicated radius/title tokens.
