# Commune — Colour Palette (definitive)

**Direction:** rich and branded, built on a **deep forest green** primary with a
**navy-green** for dark surfaces, and a **strong red** for owe/overdue status.
Confident like a good fintech app — colour carries intent, not decoration, but the
brand greens are *present and saturated*, never greyed out.

This replaces the earlier "calm" pass, which stripped so much colour the product
felt bland. The brand green here is deliberately **deeper and richer than the old
sage `#2d6a4f`** so it reads as *the brand*, not a muted UI tint.

---

## 1. The thinking (research-backed)

Looked at four money apps that lead with green and read as premium:

- **Wealthsimple** — a single high-contrast duo (near-black "Dune" `#32302F` +
  white) with one confident accent. Lesson: **restraint + one strong accent**
  reads more premium than a rainbow.
- **Wise** — owns one saturated brand green and uses it boldly on CTAs and key
  surfaces, neutrals everywhere else. Lesson: **let the brand colour be saturated
  and own the key moments.**
- **Monzo** — a single hot, unmistakable brand colour against deep neutrals.
  Lesson: **a brand colour earns recognition by being used decisively**, not
  sprinkled.
- **Starling / evergreen-banking convention** — deep evergreen anchors headers and
  CTAs; mint/sage stay supportive; navy/charcoal carry dark surfaces. Lesson:
  **deep green = trust + growth; pair it with a dark, slightly-green navy for
  weight.**

Cross-cutting best-practice (fintech UI, 2025–26):
- **3–5 colour system**: one primary + neutrals + a small set of status accents.
- **Money is data** → keep numbers and tables on neutral ink with **AA contrast**;
  reserve hue for the *status* of a number (owe / due / settled).
- **Dark mode is expected**, never pure black (`#000`); use a dark green-navy and
  *lift* the green to stay vivid on dark.
- **Saturation, controlled**: confident brand greens; status colours tuned so red
  reads as alarm, amber as caution, success-green as calm — distinct from the
  brand green so "paid" never looks like "a button".

Sources: [Wealthsimple brand palette (Mobbin)](https://mobbin.com/colors/brand/wealthsimple),
[Fintech brand colours guide (Patrick Huijs)](https://www.patrickhuijs.com/blog/fintech-brand-colors-guide),
[Colour psychology in fintech (We and the Color)](https://weandthecolor.com/color-psychology-in-fintech-branding-how-the-right-palette-builds-user-trust/209146),
[Designing for dark mode in fintech (JPN Fintech)](https://www.jpnfintech.com/designing-for-dark-mode-in-fintech-dos-and-donts/),
[Fintech UI/UX best practices (The Skins Factory)](https://www.theskinsfactory.com/uiux-design-blog/fintech-ui-ux-design).

---

## 2. Tokens — LIGHT mode

### Brand
| Token | Hex | Name | Use |
|---|---|---|---|
| `--commune-primary` | `#15573E` | Forest | **The brand.** Primary buttons, active nav, key headings, links, focus ring, selected states. |
| `--commune-primary-strong` | `#0F4030` | Forest Deep | Hover/active/pressed on primary, primary-button shadow, large brand fills. |
| `--commune-primary-tint` | `#E6F0EA` | Forest Tint | Soft brand background: selected rows, brand chips, icon bg, subtle highlights. |
| `--commune-primary-tint-strong` | `#CFE3D7` | Forest Tint+ | Hover on a tinted/selected surface, brand chip border. |
| `--commune-accent` | `#2E8B6A` | Spring Green | Optional brighter brand accent: small highlights, progress fills, sparklines, a single emphasised metric. Use sparingly. |

### Surfaces (dark, navy-green)
| Token | Hex | Name | Use |
|---|---|---|---|
| `--commune-forest` | `#142A22` | Navy Forest | **Dark surfaces:** sidebar, auth brand panel, dark hero, profile menu, dark toolbars. The deep "navy green". |
| `--commune-forest-soft` | `#1C3A2F` | Navy Forest Soft | Raised elements *inside* a dark surface: nav hover, cards on the sidebar, plan card. |
| `--commune-forest-line` | `rgba(255,255,255,0.10)` | On-forest hairline | Dividers/borders on dark surfaces. |
| `--commune-on-forest` | `rgba(255,255,255,0.92)` | On-forest text | Primary text on dark surfaces. |
| `--commune-on-forest-soft` | `rgba(255,255,255,0.62)` | On-forest muted | Labels/secondary text on dark surfaces. |

### Status (intent only)
| Token | Hex | Name | Use |
|---|---|---|---|
| `--commune-danger` | `#C2374A` | Signal Red | **Owe / overdue / destructive.** Negative balances, "you owe", overdue chips, delete. (The red the founder liked.) |
| `--commune-danger-strong` | `#9E2A3A` | Signal Red Deep | Hover on danger buttons, danger text on tint. |
| `--commune-danger-bg` | `#FBECEE` | Red Tint | Danger chip / banner background. |
| `--commune-danger-border` | `rgba(194,55,74,0.22)` | Red Border | Danger chip / inline-issue border. |
| `--commune-warning` | `#B5663D` | Amber | **Due soon / pending / needs attention.** Pending settle-ups, due dates, partial. |
| `--commune-warning-bg` | `#F7EDE4` | Amber Tint | Amber chip / banner background. |
| `--commune-warning-border` | `rgba(181,102,61,0.22)` | Amber Border | Amber chip border. |
| `--commune-success` | `#1E7A52` | Success Green | **Settled / paid / "they owe you".** Positive balances, paid chips, completed chores. Distinct (cooler, lighter) from brand Forest so "done" ≠ "a button". |
| `--commune-success-bg` | `#E4F2EA` | Success Tint | Success chip / banner background. |
| `--commune-success-border` | `rgba(30,122,82,0.22)` | Success Border | Success chip border. |
| `--commune-info` | `#2B6CB0` | Info Blue | Neutral/system info, links in body copy, info chips. |
| `--commune-info-bg` | `#E7F0F9` | Info Tint | Info chip / banner background. |
| `--commune-info-border` | `rgba(43,108,176,0.22)` | Info Border | Info chip border. |

### Neutrals
| Token | Hex | Name | Use |
|---|---|---|---|
| `--commune-paper` | `#F9F8F5` | Paper | App background (warm off-white). |
| `--commune-paper-strong` | `#FFFFFF` | Card | Cards, panels, inputs, raised surfaces. |
| `--commune-paper-soft` | `#F2F1EC` | Paper Soft | Inset/secondary surfaces, table header, unified KPI cards. |
| `--commune-ink` | `#16241D` | Ink | Primary text, headings, big numbers. (A near-black with a green undertone so it sits with the brand — replaces the cool `#1a1e2b`.) |
| `--commune-ink-soft` | `#5C6661` | Ink Soft | Secondary text, labels, captions, muted meta. |
| `--commune-border` | `#E7E5DF` | Border | Default card/input/divider border. |
| `--commune-border-strong` | `#D6D3CB` | Border Strong | Emphasised borders, dashed placeholders, bulk bar. |

---

## 3. Tokens — DARK mode

Background is a **near-black green-navy** (never pure black). The brand green is
**lifted** so it stays vivid; status tints become low-alpha washes of their hue.

### Brand
| Token | Hex | Name | Use |
|---|---|---|---|
| `--commune-primary` | `#3FB389` | Forest (lifted) | The brand on dark. Buttons, active nav, links, focus. |
| `--commune-primary-strong` | `#6EE7B7` | Forest Bright | Hover/active, key accent text, emphasis. |
| `--commune-primary-tint` | `rgba(63,179,137,0.16)` | Forest Tint | Selected rows, brand chip bg, icon bg on dark. |
| `--commune-primary-tint-strong` | `rgba(63,179,137,0.26)` | Forest Tint+ | Hover on tinted surface. |
| `--commune-accent` | `#52C79A` | Spring Green | Progress fills, sparklines, single emphasised metric. |

### Surfaces
| Token | Hex | Name | Use |
|---|---|---|---|
| `--commune-paper` | `#10171300`→`#101713` | App bg | Near-black green-navy app background (`#101713`). |
| `--commune-paper-strong` | `#172019` | Card | Cards/panels/inputs on dark. |
| `--commune-paper-soft` | `#131A16` | Paper Soft | Inset surfaces, table header. |
| `--commune-forest` | `#0E1612` | Navy Forest | Sidebar / dark brand panel (slightly darker than cards for depth). |
| `--commune-forest-soft` | `#1A241E` | Navy Forest Soft | Raised elements inside the sidebar. |
| `--commune-forest-line` | `rgba(255,255,255,0.10)` | On-forest hairline | Dividers on dark surfaces. |

### Status (dark)
| Token | Hex | Name | Use |
|---|---|---|---|
| `--commune-danger` | `#F06A78` | Signal Red (lifted) | Owe / overdue / destructive on dark. |
| `--commune-danger-strong` | `#F58A95` | Signal Red Bright | Danger hover/text on dark. |
| `--commune-danger-bg` | `rgba(240,106,120,0.15)` | Red Wash | Danger chip bg. |
| `--commune-danger-border` | `rgba(240,106,120,0.30)` | Red Border | Danger chip border. |
| `--commune-warning` | `#E08A52` | Amber (lifted) | Due / pending on dark. |
| `--commune-warning-bg` | `rgba(224,138,82,0.15)` | Amber Wash | Amber chip bg. |
| `--commune-warning-border` | `rgba(224,138,82,0.30)` | Amber Border | Amber chip border. |
| `--commune-success` | `#46C98A` | Success Green (lifted) | Settled / paid on dark. |
| `--commune-success-bg` | `rgba(70,201,138,0.15)` | Success Wash | Success chip bg. |
| `--commune-success-border` | `rgba(70,201,138,0.30)` | Success Border | Success chip border. |
| `--commune-info` | `#63B3ED` | Info Blue (lifted) | Info / system on dark. |
| `--commune-info-bg` | `rgba(99,179,237,0.15)` | Info Wash | Info chip bg. |
| `--commune-info-border` | `rgba(99,179,237,0.30)` | Info Border | Info chip border. |

### Neutrals (dark)
| Token | Hex | Name | Use |
|---|---|---|---|
| `--commune-ink` | `#E6E8E6` | Ink | Primary text on dark. |
| `--commune-ink-soft` | `#9BA39E` | Ink Soft | Secondary text on dark. |
| `--commune-border` | `rgba(255,255,255,0.09)` | Border | Default border on dark. |
| `--commune-border-strong` | `rgba(255,255,255,0.15)` | Border Strong | Emphasised border on dark. |

> Legacy aliases (keep mapped so existing CSS keeps working):
> `--commune-mist` → `--commune-primary-tint`, `--commune-sage` →
> `--commune-primary-tint-strong`, `--commune-coral` → `--commune-warning`,
> `--commune-gold` → `--commune-warning-bg`. Treat `peach`/`lilac` as deprecated —
> map both to `--commune-paper-soft` (the calm pass already neutralised them).

---

## 4. Usage guide — where each colour goes

**Forest green (`--commune-primary`) — the brand. Be confident, not shy:**
- Primary buttons (filled forest, white text) and their hover (`-strong`).
- Active sidebar item, active nav indicator, active filter chip.
- Key page headings / section eyebrows where brand presence matters; links.
- Focus rings, selected rows/checkboxes, brand icon backgrounds (`-tint`).
- Progress bars and the one "hero" metric may use `--commune-accent` (Spring).

**Navy forest (`--commune-forest`) — weight and depth:**
- The sidebar (already dark), the auth brand panel, the dark hero card, the
  profile dropdown, any dark toolbar/footer. Text on it uses `--commune-on-forest`.
- Raised things *inside* those surfaces use `--commune-forest-soft`.

**Red (`--commune-danger`) — status only, never decoration:**
- "You owe", negative balances, **overdue** chips, destructive actions (delete,
  remove member, leave group). Red should feel like an alarm — keep it rare so it
  *means* something.

**Amber / Success / Info — the rest of the status spectrum:**
- **Amber** = due-soon / pending / partial / needs-attention.
- **Success green** = settled / paid / "they owe you" / completed chore. It is
  intentionally *cooler and lighter* than brand Forest so a "paid" badge never
  looks like a primary button.
- **Info blue** = neutral system messages and body links only.

**Neutrals — the canvas (most of the UI):**
- Cards/inputs on `--commune-paper-strong` over a `--commune-paper` app bg.
- All money figures, tables, and dense text on `--commune-ink` /
  `--commune-ink-soft` for AA contrast — *the number stays neutral; only its
  status chip carries hue.*

### Restraint rules
1. **Colour = intent.** Green = brand/primary, Red = owe/danger, Amber = due,
   Success = paid, Info = system. If a colour isn't communicating one of those,
   it's a neutral.
2. **One brand green per view as the lead.** Don't tint every card — let neutral
   cards frame the green so it reads as deliberate (the Wealthsimple/Wise lesson).
3. **But don't grey the brand out.** Buttons, active nav, and key emphasis MUST be
   saturated Forest, not a washed pastel. "Calm" ≠ "colourless".
4. **Status chips are tint + text, not full fills** (except the one destructive
   button). Background = `*-bg`, text = the base hue, optional `*-border`.
5. **Numbers are neutral ink; status lives in the chip beside them**, so totals
   stay legible and scannable.
6. **Dark mode lifts, never dulls:** use the lifted greens/reds so the brand stays
   vivid on the green-navy background; never pure black.

---

## 5. CSS variable block (drop-in for `styles.css`)

```css
:root {
  /* Brand */
  --commune-primary: #15573E;
  --commune-primary-strong: #0F4030;
  --commune-primary-tint: #E6F0EA;
  --commune-primary-tint-strong: #CFE3D7;
  --commune-accent: #2E8B6A;

  /* Surfaces — navy forest */
  --commune-forest: #142A22;
  --commune-forest-soft: #1C3A2F;
  --commune-forest-line: rgba(255, 255, 255, 0.10);
  --commune-on-forest: rgba(255, 255, 255, 0.92);
  --commune-on-forest-soft: rgba(255, 255, 255, 0.62);

  /* Status */
  --commune-danger: #C2374A;
  --commune-danger-strong: #9E2A3A;
  --commune-danger-bg: #FBECEE;
  --commune-danger-border: rgba(194, 55, 74, 0.22);
  --commune-warning: #B5663D;
  --commune-warning-bg: #F7EDE4;
  --commune-warning-border: rgba(181, 102, 61, 0.22);
  --commune-success: #1E7A52;
  --commune-success-bg: #E4F2EA;
  --commune-success-border: rgba(30, 122, 82, 0.22);
  --commune-info: #2B6CB0;
  --commune-info-bg: #E7F0F9;
  --commune-info-border: rgba(43, 108, 176, 0.22);

  /* Neutrals */
  --commune-paper: #F9F8F5;
  --commune-paper-strong: #FFFFFF;
  --commune-paper-soft: #F2F1EC;
  --commune-ink: #16241D;
  --commune-ink-soft: #5C6661;
  --commune-border: #E7E5DF;
  --commune-border-strong: #D6D3CB;

  /* Legacy aliases */
  --commune-mist: var(--commune-primary-tint);
  --commune-sage: var(--commune-primary-tint-strong);
  --commune-coral: var(--commune-warning);
  --commune-gold: var(--commune-warning-bg);
}

[data-mantine-color-scheme="dark"] {
  /* Brand */
  --commune-primary: #3FB389;
  --commune-primary-strong: #6EE7B7;
  --commune-primary-tint: rgba(63, 179, 137, 0.16);
  --commune-primary-tint-strong: rgba(63, 179, 137, 0.26);
  --commune-accent: #52C79A;

  /* Surfaces */
  --commune-forest: #0E1612;
  --commune-forest-soft: #1A241E;
  --commune-forest-line: rgba(255, 255, 255, 0.10);
  --commune-on-forest: rgba(255, 255, 255, 0.92);
  --commune-on-forest-soft: rgba(255, 255, 255, 0.62);

  /* Status */
  --commune-danger: #F06A78;
  --commune-danger-strong: #F58A95;
  --commune-danger-bg: rgba(240, 106, 120, 0.15);
  --commune-danger-border: rgba(240, 106, 120, 0.30);
  --commune-warning: #E08A52;
  --commune-warning-bg: rgba(224, 138, 82, 0.15);
  --commune-warning-border: rgba(224, 138, 82, 0.30);
  --commune-success: #46C98A;
  --commune-success-bg: rgba(70, 201, 138, 0.15);
  --commune-success-border: rgba(70, 201, 138, 0.30);
  --commune-info: #63B3ED;
  --commune-info-bg: rgba(99, 179, 237, 0.15);
  --commune-info-border: rgba(99, 179, 237, 0.30);

  /* Neutrals */
  --commune-paper: #101713;
  --commune-paper-strong: #172019;
  --commune-paper-soft: #131A16;
  --commune-ink: #E6E8E6;
  --commune-ink-soft: #9BA39E;
  --commune-border: rgba(255, 255, 255, 0.09);
  --commune-border-strong: rgba(255, 255, 255, 0.15);

  /* Legacy aliases */
  --commune-mist: var(--commune-primary-tint);
  --commune-sage: var(--commune-primary-tint-strong);
  --commune-coral: var(--commune-warning);
  --commune-gold: var(--commune-warning-bg);
}
```

---

## 6. Contrast notes (AA targets)

- White text on Forest `#15573E` ≈ **7.4:1** → AA/AAA for buttons & body.
- Ink `#16241D` on Paper `#F9F8F5` ≈ **15:1** → AAA for all text/numbers.
- Ink-soft `#5C6661` on Paper ≈ **5.3:1** → AA for labels/captions.
- Danger `#C2374A` on white ≈ **5.0:1**; Success `#1E7A52` on white ≈ **4.8:1**;
  Amber `#B5663D` on white ≈ **4.7:1** → AA for status text (≥4.5).
- Dark mode: Forest `#3FB389`, Danger `#F06A78`, Success `#46C98A`, Info `#63B3ED`
  on `#101713` all clear **≥4.5:1**. Status text always uses the *lifted* hue, not
  the base, on dark.
- Rule: any status colour used as **text** must hit ≥4.5:1 on its background; as a
  **chip fill** it pairs base-hue text on its own `*-bg` tint.
