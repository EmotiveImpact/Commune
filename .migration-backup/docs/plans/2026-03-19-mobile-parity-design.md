# Mobile Full Parity Upgrade Design

**Date:** 2026-03-19
**Goal:** Align mobile app styling and features with web app

## Scope

4 workstreams, executed in parallel:
1. Design Token Alignment
2. Dashboard Charts
3. Notifications + Pricing Screen
4. UX Polish (date picker, missing hooks)

OAuth deferred to future session.

---

## Workstream 1: Design Token Alignment

### Problem
Mobile uses different colors than web:
- Mobile dark: `#17141F` (deep purple) vs web: `#1f2330` (forest)
- Mobile primary button: dark `#17141F` vs web: sage green `#2d6a4f`
- Tailwind config has indigo `#6366f1` (never used in screens, but wrong)
- Mobile background: `#F4EFE8` vs web: `#f5f1ea` (close but not exact)

### Changes

**tailwind.config.js** — Replace entire color palette:
```js
colors: {
  commune: {
    paper: '#f5f1ea',
    'paper-strong': '#ffffff',
    'paper-soft': '#fbf7f1',
    primary: '#2d6a4f',
    'primary-strong': '#1b4332',
    forest: '#1f2330',
    'forest-soft': '#323847',
    ink: '#171b24',
    'ink-soft': '#667085',
    mist: '#d9ebe5',
    sage: '#d7e6dd',
    peach: '#efdccf',
    lilac: '#e8e1ef',
    gold: '#f1e5bf',
    coral: '#eaa681',
  }
}
```

**components/ui.tsx** — Update all hardcoded colors:
- HeroPanel bg: `#17141F` → `#1f2330`
- Screen bg: `#F4EFE8` → `#f5f1ea`
- Primary button bg: `#17141F` → `#2d6a4f`
- All text colors, borders, tone palettes aligned to web tokens
- Button hover/active states match web's sage green theme

### Files Changed
- `apps/mobile/tailwind.config.js`
- `apps/mobile/components/ui.tsx`
- All screen files that use hardcoded colors

---

## Workstream 2: Dashboard Charts

### Problem
Web dashboard has Recharts bar chart (6-month spending trend) and pie chart (category breakdown). Mobile has none.

### Approach
Use `react-native-svg` + `victory-native` for charts (mature RN chart library).

### Changes

**New dependency:** `victory-native`, `react-native-svg`

**Dashboard screen** (`app/(tabs)/index.tsx`):
- Add 6-month spending trend bar chart after hero panel
- Add category breakdown pie chart in a Surface card
- Use `useDashboardStats` hook (already available) for data
- Style charts to match web's color palette (sage, peach, lilac, gold, coral)

### Files Changed
- `apps/mobile/package.json` (new deps)
- `apps/mobile/app/(tabs)/index.tsx`

---

## Workstream 3: Notifications + Pricing

### Problem
Web has notification bell dropdown and full pricing page. Mobile has neither.

### Changes

**Notifications:**
- Add `hooks/use-notifications.ts` (mirror web's pattern, call `getNotifications` from @commune/api)
- Add notification bell icon to tab bar header (badge with unread count)
- Add notifications modal/bottom sheet listing recent activity
- Tap notification → navigate to related expense

**Pricing Screen:**
- Add `app/(tabs)/pricing.tsx` or `app/pricing.tsx` as stack screen
- 3-tier plan cards (Standard/Pro/Agency) matching web layout
- Current plan indicator
- Stripe checkout button using `useSubscription` + `useCheckout`
- Add nav link to pricing from settings

### Files Changed
- `apps/mobile/hooks/use-notifications.ts` (new)
- `apps/mobile/app/(tabs)/_layout.tsx` (header notification bell)
- `apps/mobile/app/notifications.tsx` (new screen)
- `apps/mobile/app/pricing.tsx` (new screen)
- `apps/mobile/app/(tabs)/settings.tsx` (link to pricing)

---

## Workstream 4: UX Polish

### Problem
- Date inputs are plain text (YYYY-MM-DD format) instead of native picker
- No notifications hook on mobile
- Missing loading skeletons

### Changes

**Date Picker:**
- Add `@react-native-community/datetimepicker`
- Replace text date inputs in new expense, edit expense screens
- Wrap in a pressable that shows the native date picker

**Recurring expense generation:**
- Add `use-recurring.ts` hook matching web (calls `generateRecurringExpenses`)
- Trigger on app foreground or dashboard load

### Files Changed
- `apps/mobile/package.json` (new dep)
- `apps/mobile/app/expenses/new.tsx`
- `apps/mobile/app/expenses/[expenseId]/edit.tsx`
- `apps/mobile/hooks/use-recurring.ts` (new)

---

## Out of Scope
- OAuth (Google/GitHub/Apple sign-in) — deferred
- Offline support
- Push notifications (only in-app)
- Image/receipt uploads
