# Commune Web App — Design Overhaul

**Date:** 2026-03-18
**Status:** Approved

## Goal

Restructure layout hierarchy and sharpen visual polish across the entire web app. Keep the existing warm dark+cream color palette but make it feel professional and refined rather than bubbly. Fix the one broken feature (notification bell).

## Current State

- 95% functional — all pages work, data persists, auth flows complete
- Design feels generic/default Mantine with oversized border-radius and diffuse shadows
- Sidebar group selector is too prominent at the top
- Notification bell icon renders but has no functionality

## Design Direction

Dark sidebar + cream content area with soft accent cards (peach, mint, lilac). Inspired by the Finova/class dashboard references: clean hierarchy, sharp typography, subtle depth.

---

## 1. Sidebar Restructure

**Current:** Logo → Workspace card (group selector) → Nav links → Create group
**New:** Logo → MENU nav links → WORKSPACE group selector → divider → Support + Log Out

```
┌──────────────────┐
│  Commune logo     │
│                   │
│  MENU             │
│  ○ Dashboard      │
│  ○ Expenses       │
│  ○ Breakdown      │
│  ○ Members        │
│  ○ Pricing        │
│  ○ Settings       │
│                   │
│  WORKSPACE        │
│  [Flat 42 ▾]      │
│  + New group       │
│                   │
│  ─────────────    │
│  Support           │
│  Log Out           │
└──────────────────┘
```

Changes:
- Remove the dark "workspace card" container — replace with a clean dropdown
- Add section labels (MENU, WORKSPACE) as uppercase dim text
- Pin Support + Log Out to sidebar bottom with a thin divider
- Tighter spacing between nav items (py: 6px not 10px)
- Active nav item: left accent bar (3px teal) + subtle background tint

## 2. Visual Sharpening

### Border Radius
- Panels/cards: `md` (8px) — down from `lg` (14px)
- Buttons: keep `lg` (14px)
- Inputs: `md` (8px)
- Hero cards: 16px — down from 24px
- Badges/pills: keep full radius (999px)

### Shadows
- Replace diffuse `0 10px 24px rgba(...)` with tighter `0 1px 3px rgba(23,27,36,0.06), 0 1px 2px rgba(23,27,36,0.04)`
- Hover state: `0 4px 12px rgba(23,27,36,0.08)` — subtle lift
- No more scale transforms on hover — just shadow transition

### Typography
- Page titles: `fw: 800, fz: 28px` (bolder, larger)
- Section headings: `fw: 700, fz: 18px`
- Body: `fw: 400, fz: 14px`
- Labels/captions: `fw: 600, fz: 12px, tt: uppercase, ls: 0.5px`
- Reduce line-height on headings for tighter feel

### Borders
- Hairline: `1px solid rgba(23,27,36,0.06)` — barely visible
- Dividers: same opacity, horizontal only

### Cards & Panels
- Remove excessive padding (xl → md on most panels)
- Consistent inner spacing: 16px padding
- Stat cards: icon badge (small colored circle with icon) top-left, value large, label small below, optional trend badge

## 3. Dashboard Upgrade

Top section:
- 4 KPI stat cards in a row: Monthly Budget, Total Spent, Remaining, Your Share
- Each card: icon badge (colored circle), large £ value, subtitle, trend percentage badge (green ↑ or red ↓)

Middle section (2-column):
- Left: Transaction Overview bar chart (monthly totals, 6 months)
- Right: Spending by Category donut chart with legend

Bottom section:
- Recent Transactions table with: name, category badge, date, amount, status
- Clean table with hairline row dividers, no zebra striping

## 4. Notification Bell Fix

Wire up a functional notification dropdown:
- Click bell → dropdown panel with recent notifications
- Types: new expense, payment received, payment reminder, overdue
- Each item: icon, message text, relative timestamp
- "Mark all read" action
- Unread count badge on bell icon
- Source: query from Supabase (expenses/payments created in last 30 days for user's groups)

## 5. Settings Page Polish

- Already functional (save works, toggles work, subscription works)
- Visual refinements only: align with new card/typography/shadow system
- Ensure stat cards use new icon badge pattern

## 6. Auth Pages

- Already updated with Google, GitHub, Apple providers
- Visual refinements: match new border-radius and shadow system
- Ensure consistent spacing

---

## Files To Modify

| File | Change |
|------|--------|
| `styles.css` | Update CSS variables (radius, shadows, typography) |
| `__root.tsx` | Update Mantine theme defaults |
| `app-shell.tsx` | Restructure sidebar, wire notification bell |
| `nav-links.tsx` | Reorder links, add section labels, add Support/Logout |
| `_app/index.tsx` | Dashboard KPI cards and layout refinement |
| `_app/settings.tsx` | Visual polish only |
| `_app/breakdown.tsx` | Visual polish |
| `_app/expenses/index.tsx` | Visual polish |
| `_app/members.tsx` | Visual polish |
| `_app/pricing.tsx` | Visual polish |
| New: `hooks/use-notifications.ts` | Query hook for notification data |
| New: `components/notification-dropdown.tsx` | Bell dropdown component |

## Non-Goals

- No dark mode (light only for now)
- No new pages or features beyond notification bell
- No mobile app changes
- No backend/API changes (notifications are client-side queries of existing data)
