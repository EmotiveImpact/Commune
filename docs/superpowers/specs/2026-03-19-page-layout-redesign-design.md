# Page Layout Redesign — Design Spec

**Date:** 2026-03-19
**Status:** Approved
**Goal:** Give each page in the Commune web app a distinct visual identity instead of repeating the same hero → KPI cards → table template on every page.

---

## Problem

Every page (Dashboard, Expenses, Breakdown, Activity, Members) uses an identical layout:

1. Dark navy hero card (`commune-hero-card`) with glassmorphism aside
2. 4 KPI stat cards in a `SimpleGrid` with tones: sage, lilac, ink, peach
3. `commune-soft-panel` with a table

The data differs but the visual rhythm is identical. Pages feel like the same template stamped five times.

## Design Decision

Each page gets its own purpose-built layout. The dark hero card becomes a **Dashboard-only** feature. Other pages use compact page headers and layouts suited to their function.

---

## Page Designs

### 1. Dashboard — The Overview

**Keeps:** Hero card, KPI stat cards, charts, recent expenses table.

This is the only page that retains the full `commune-hero-card` with the glassmorphism aside panel. It is the command centre — the first thing the user sees.

**Layout:**
- Hero card (dark gradient, title, cycle snapshot aside with remaining amount, paid, open items, progress bar)
- 4 KPI cards (Monthly budget, Your share, Remaining, Overdue) in a SimpleGrid
- Two-column grid below:
  - Left: Bar chart (6-month trend) + Recent expenses table
  - Right: Category donut chart + Payment focus panel

**No changes to Dashboard structure.** It already works as the overview page.

---

### 2. Expenses — The Ledger

**Removes:** Hero card, 4 KPI cards, filter panel (separate soft-panel).

**New layout:**
- **Compact page header** — single row with:
  - Left: Title "Expenses" + subtitle showing count and total (e.g. "12 expenses · GH₵ 3,200 tracked")
  - Right: Category Select dropdown and "Add expense" primary button — inline. Search continues to use the existing top-bar `useSearchStore` integration (no local search input on this page).
- **Tab-style status filters** — horizontal pill/chip row: All (count), Open (count), Overdue (count), Settled (count). Clicking filters the table.
- **Full-width expense table** — the table IS the page. Dense, scannable, no wrapper panel chrome needed. Columns: Expense, Category, Due date, Participants, Status, Amount.

**Key change:** The page loads and you immediately see the data. No scrolling past decorative sections to reach the table.

---

### 3. Breakdown — Personal Statement

**Removes:** Hero card, 4 KPI cards as separate section.

**New layout:**
- **Compact page header** — single row with:
  - Left: Title "Your Breakdown" + subtitle "What you owe and what you've paid"
  - Right: Month picker Select dropdown
- **Summary card** — single `commune-soft-panel` containing:
  - Three inline stats: Total owed, Paid, Remaining — large typography, color-coded (forest green for paid, peach/coral for remaining)
  - Full-width progress bar below showing payment completion percentage
- **Category filter** — inline Select above the table (not in its own panel)
- **Expense table** — Columns: Expense, Category, Due, Your share, Status, Paid by, Action (pay/unpay toggle)

**Key change:** The progress bar and three summary numbers replace 4 separate KPI cards. Everything the user needs is in one glanceable section.

---

### 4. Activity — Timeline Feed

**Removes:** Hero card, 4 KPI cards.

The existing code already renders events as cards in a vertical Stack (not a table). The main structural changes are: remove the hero card and KPI stat cards, add date-grouped headers, and add client-side type filters.

**New layout:**
- **Compact page header** — single row with:
  - Left: Title "Activity" + subtitle "Everything that happened in {group name}"
  - Right: Filter chips — All, Expenses, Payments, Members (toggle which event types show)
- **Filter implementation:** Client-side only — filter the existing `entries` array by `entry.entity_type`. No new API parameters or backend work needed. Local component state (e.g. `useState<string>('all')`) controls which types are visible.
- **Date-grouped timeline** — vertical list of events grouped by date:
  - Date headers: "Today", "Yesterday", "March 17", etc. — small uppercase labels
  - Event cards: Icon (colored by type) + actor avatar + description + relative timestamp (existing card structure is kept, just wrapped in date groups)
- **Load more button** at the bottom

**Key change:** Removing the hero + KPI cards lets the timeline breathe. Date grouping adds temporal context that the flat list lacks.

---

### 5. Members — People Directory

**Removes:** Hero card, 4 KPI cards, list-in-a-panel format.

**New layout:**
- **Compact page header** — single row with:
  - Left: Title "Members" + subtitle "{count} people in {group name}"
  - Right: "Invite member" primary button (visible to admins)
- **Member cards in a 2-column grid** — each card contains:
  - Avatar (large, 44px), name, email on the left
  - Role badge (Admin/Member) and status badge (Active/Invited) on the right
  - Admin action menu (three dots) for role changes, removal
- **Dashed "invite" placeholder card** at the end of the grid (for admins)
- **Group actions section** — keep the existing compact panel at the bottom as-is (Edit group settings, Leave group buttons, transfer ownership modal)

**Key change:** Avatar-forward grid layout makes it feel like a people directory instead of a data table. The dashed invite card is a persistent visual CTA.

---

## Shared Components

### Compact Page Header

A new reusable component used by Expenses, Breakdown, Activity, and Members:

```
+------------------------------------------------------------------+
| Title (h2, fw 800)                    [Action area - buttons/etc] |
| Subtitle (sm, dimmed)                                             |
+------------------------------------------------------------------+
```

- No background color, no card wrapper
- Bottom border (1px solid commune-border) to separate from content
- Padding bottom of `md`, margin bottom of `lg`
- **Responsive:** At `max-width: 900px` (matching existing breakpoint), the header stacks vertically — title/subtitle on top, action area below with `width: 100%`. Action items within the right section wrap naturally via Mantine `Group` with `wrap="wrap"`.

### Status Filter Chips

Horizontal row of pill-shaped toggles for filtering. Used by Expenses page, Activity page.

- Active chip: `background: commune-mist, color: commune-primary-strong, font-weight: 600`
- Inactive chip: `background: commune-paper, color: commune-ink-soft`
- Clickable, mutually exclusive (Expenses) or toggle-able (Activity)

---

## Files to Modify

1. `apps/web/src/routes/_app/expenses/index.tsx` — replace hero+KPIs with compact header + tab filters + dense table
2. `apps/web/src/routes/_app/breakdown.tsx` — replace hero+KPIs with compact header + summary card + table
3. `apps/web/src/routes/_app/activity.tsx` — replace hero+KPIs with compact header + date-grouped timeline
4. `apps/web/src/routes/_app/members.tsx` — replace hero+KPIs with compact header + member card grid
5. `apps/web/src/styles.css` — add compact page header styles, status filter chip styles, member card grid styles, timeline styles
6. `apps/web/src/components/page-header.tsx` — new shared compact page header component (required — used by 4 pages, no duplication)

**Dashboard (`index.tsx`) is NOT modified.** It keeps its current layout.

---

## What We Are NOT Doing

- No changes to the sidebar/nav
- No changes to the Dashboard page
- No changes to the Mantine theme or color palette
- No new backend work
- No mobile app changes (this is web-only)
- No dark mode
- No changes to Settings, Pricing, or Onboarding pages (out of scope)
