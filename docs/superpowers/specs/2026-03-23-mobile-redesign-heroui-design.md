# Mobile App Redesign — HeroUI Native Migration

**Date:** 2026-03-23
**Status:** Approved
**Scope:** Full redesign of all screens in `/apps/mobile/`

## Summary

Replace the current utilitarian dark-themed mobile UI with a modern, consumer-grade design using HeroUI Native as the component library. Light theme by default with dark mode toggle. Inspired by clean package-tracking app aesthetics: bold hero cards, circular quick actions, status chips, and minimal bottom navigation.

## Decisions

| Decision | Choice |
|----------|--------|
| Theme | Light default + dark mode toggle (exact Uniwind API TBD — verify at install time) |
| Hero card | Top balance/debt summary with progress bar |
| Quick actions | Add Expense, Settle Up, Activity, Analytics |
| Bottom nav | 4 tabs (Home, Expenses, Groups, Settings) + center FAB |
| Colors | Keep brand (#2d6a4f, #f5f1ea) + bright accent green (#4ade80) |
| Component library | HeroUI Native (replaces custom `ui.tsx`) |
| Styling engine | Uniwind (replaces NativeWind) |
| Scope | All screens — full redesign |

## 1. Design System Foundation

### Styling Engine

Replace NativeWind with Uniwind — HeroUI Native's Tailwind v4 binding. Same class-based approach but with build-time compilation (2.5x faster). Dark mode is built into the theming system via CSS variables.

> **API Verification Gate:** Before implementation begins, install `heroui-native` and `uniwind`, then audit the actual exports. Verify every component name, prop, variant, and compound component pattern (e.g., `Avatar.Fallback`, `Switch.StartContent`) referenced in this spec against the real package. If the API differs, update this spec before writing screen code. This is a blocking prerequisite for Step 1 of the migration order (Section 10).
>
> **Uniwind Theming API:** This spec references `Uniwind.setTheme('light' | 'dark')` based on documentation examples. The actual API may differ (Unistyles uses `UnistylesRuntime.setTheme()`). Verify the exact call during Step 2 and update the spec accordingly.

### Color Tokens

Defined as CSS variables in Uniwind theme layers. Both light and dark values provided.

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `background` | `#FAFAFA` | `#0A0A0A` | Page background |
| `surface` | `#FFFFFF` | `#18181B` | Cards, panels |
| `surface-secondary` | `#F5F1EA` | `#27272A` | Nested surfaces, inputs |
| `foreground` | `#171b24` | `#FAFAFA` | Primary text |
| `muted` | `#667085` | `#A1A1AA` | Secondary text |
| `accent` | `#2d6a4f` | `#2d6a4f` | Brand green (unchanged) |
| `accent-bright` | `#4ade80` | `#4ade80` | Progress bars, success badges |
| `accent-surface` | `#EEF6F3` | `#1a2e25` | Green-tinted backgrounds |
| `danger` | `#B9382F` | `#EF4444` | Overdue, errors |
| `warning` | `#F59E0B` | `#FBBF24` | Due soon |
| `border` | `rgba(23,27,36,0.10)` | `rgba(255,255,255,0.10)` | Subtle borders |

### Typography

System font (San Francisco on iOS, Roboto on Android). Size scale:

- 28px: Screen titles (font-bold)
- 20px: Section headings (font-semibold)
- 16px: Body text, button labels (font-medium)
- 14px: List item titles (font-semibold)
- 13px: Secondary text (font-normal)
- 11px: Captions, chip labels (font-medium, uppercase tracking)

### Radius System

Note: The current app uses large radii (28px for `Surface`, 24px for `ListRowCard`). The redesign intentionally tightens to a more modern, compact feel.

- `rounded-2xl` (16px): Cards, inputs, hero card
- `rounded-xl` (12px): Buttons, inline cards
- `rounded-full`: Avatars, chips, quick action circles, filter pills

### Component Mapping

Every custom component in `ui.tsx` maps to a HeroUI Native equivalent:

| Current (`ui.tsx`) | HeroUI Native Replacement |
|-------------------|--------------------------|
| `Screen` | Keep as layout wrapper, update background to `background` token |
| `Surface` | `Card` (variant="default") |
| `AppButton` | `Button` (variant="primary" / "secondary" / "tertiary" / "danger"). Note: current `variant="ghost"` maps to HeroUI `variant="tertiary"` — update all callsites |
| `StatusChip` | `Chip` (color="success" / "warning" / "danger" / "accent" / "default") |
| `Pill` | `Chip` (variant="secondary", pressable, selected state via `color` prop) |
| `TextField` | HeroUI `TextField` + `Input` (variant="primary" / "secondary") |
| `DateField` | Keep custom (HeroUI Native has no date picker) — restyle wrapper |
| `ToggleRow` | `ControlField` + `Switch` + `Label` + `Description` |
| `InitialAvatar` | `Avatar` + `Avatar.Fallback` |
| `EmptyState` | Keep custom, restyle with HeroUI `Card` + `Button` |
| `HeroPanel` | Remove — replaced by hero debt card on home, clean headers elsewhere |
| `SectionHeading` | Remove — use plain `Text` with token classes |
| `StatCard` | `Card` variant="secondary" with icon + value layout |
| `ListRowCard` | `Card` with pressable wrapper |
| All `*Skeleton` | HeroUI `Skeleton` (isLoading prop, shimmer animation) |
| `Shimmer` / `SkeletonBox` / `SkeletonLine` | Remove — HeroUI `Skeleton` handles this |

### Accessibility Requirements

All screens must meet minimum accessibility standards:
- All pressable elements (`Button`, `TouchableOpacity`, icon buttons): `accessibilityLabel` describing the action
- All status `Chip` components: `accessibilityLabel` with full status text (e.g., "Status: Overdue")
- All icon-only buttons (notification bell, FAB): `accessibilityLabel` + `accessibilityRole="button"`
- All `Avatar` components: `accessibilityLabel` with user name
- All form inputs: `accessibilityLabel` via HeroUI `Label` component (automatic)
- All `Switch` toggles: `accessibilityLabel` describing what is toggled + current state

### Error States

Error handling pattern for all screens:
- **Fetch errors (full screen):** Show the existing `EmptyState` component (restyled with HeroUI `Card` + `Button`) with `cloud-offline-outline` icon, error message, and "Try again" button. This pattern already exists in every screen and is preserved.
- **Mutation errors (inline):** Use HeroUI `Toast` variant="danger" with error message. Replaces `Alert.alert` for non-destructive error feedback.
- **Destructive action errors:** Use HeroUI `BottomSheet` for confirmation, then `Toast` variant="danger" if the action fails.
- **Network offline:** Same as fetch error — EmptyState with retry.

### Animations & Transitions

- **Card/button press:** Default HeroUI press feedback (scale 0.98, 100ms). No custom press animations needed.
- **Screen transitions:** Default expo-router stack transitions (slide from right for modals, none for tab switches). No shared element transitions in this phase.
- **Skeleton shimmer:** HeroUI `Skeleton` built-in shimmer animation (duration 1500ms).
- **Dark mode toggle:** Instant theme switch via Uniwind — no crossfade animation.
- **Tab indicator:** Default react-navigation tab bar animation.

## 2. Navigation & App Shell

### Bottom Tab Bar

4 tabs + center FAB. Light background.

```
┌──────────────────────────────────────────┐
│  Home    Expenses    [+]   Groups   Settings  │
│   🏠       📋        ●      👥       ⚙️      │
└──────────────────────────────────────────┘
```

**Styling:**
- Background: `surface` token (white/dark)
- Active tab: `accent` green icon + label
- Inactive tab: `muted` gray icon + label
- Top border: `border` token, 1px
- Height: 70px + safe area bottom inset
- No shadow, no elevation

**Center FAB:**
- 56px circle
- Background: `accent` (#2d6a4f)
- Icon: white `+`, 24px
- Shadow: `accent` color, opacity 0.25, radius 12, offset y:6
- Border radius: 18px (rounded square, matching current)
- Positioned: top -10 above tab bar
- onPress: navigate to `/expenses/new`

**Tab screens:**
- `index` → Home (icon: `home-outline`)
- `expenses` → Expenses (icon: `receipt-outline`)
- `create` → FAB placeholder. This file must exist for expo-router's file-based tab routing but renders nothing. The tab slot is occupied by the custom FAB button via `tabBarButton`. Keep `create.tsx` as a no-render placeholder.
- `groups` → Groups (icon: `people-outline` — changed from `pie-chart-outline` to reflect the group-centric purpose). Renamed from `breakdown.tsx`.
- `settings` → Settings (icon: `settings-outline`)

### Header

Profile-first header replacing the dark branded header.

```
┌──────────────────────────────────────────┐
│  [Avatar]  Hi, Josh          🔔  [Group▾] │
│            Sunday, 23 March                │
└──────────────────────────────────────────┘
```

**Layout:**
- Background: `background` token (light/dark)
- Padding: top = safe area inset + 8, bottom = 14, horizontal = 16
- Left: HeroUI `Avatar` (40px, with user image or fallback initials)
- Center: Greeting text ("Hi, {firstName}") in `foreground`, date below in `muted`
- Right: Notification bell icon (40px pressable area, `muted` color, red badge for unread count) + GroupSwitcher (restyled as HeroUI `Select` with `presentation="popover"` — the Select component provides a dropdown list of groups, which is more appropriate than a Chip for multi-option selection)

**The header is shared across all tab screens** via the tab layout's `header` option.

### Dark Mode

- Toggle lives in Settings screen under "Appearance" section
- Uses Uniwind/HeroUI theming API (exact call to be verified during Step 2 — see API Verification Gate in Section 1)
- Theme preference persists to AsyncStorage
- Read on app startup in root `_layout.tsx`, applied before first render

## 3. Home Screen (`app/(tabs)/index.tsx`)

Complete rewrite. New layout top to bottom:

### 3.1 Hero Debt Card

The centerpiece — a dark card showing the user's monthly balance summary.

**Data source:** From `useDashboardStats` which returns `{ total_spend, your_share, amount_paid, amount_remaining, overdue_count, upcoming_items }`. The card uses `amount_remaining` and `your_share` to compute progress. Note: the hook does NOT return debtor/creditor identity, so the card shows aggregate "Your remaining share" rather than "You owe → [person]".

**Layout:**
```
┌─ Card (dark bg: forest #1f2330) ────────────┐
│                                               │
│  [Chip: "REMAINING" or "ALL SETTLED"]        │
│                                               │
│  Your share: £142.50                          │
│  ████████████░░░░░░  78% paid                 │
│                                               │
│  £112.00 paid · £30.50 remaining              │
│  March 2026                                   │
└───────────────────────────────────────────────┘
```

- HeroUI `Card` with custom dark background (#1f2330), `rounded-2xl` (16px)
- Status chip at top: `Chip` with `accent-bright` background. Label: "REMAINING" if `amount_remaining > 0`, "ALL SETTLED" if `amount_remaining === 0`
- Amount: `your_share` formatted as 32px bold white text
- Progress bar: width = `(amount_paid / your_share) * 100%`. Fill color: `accent-bright` (#4ade80). Track: rgba(255,255,255,0.15)
- Subtitle row: "£X paid · £Y remaining" in muted white text (rgba(255,255,255,0.6))
- Date: current month/year in muted white text
- If `amount_remaining === 0`: show "All settled!" with checkmark icon, full green progress bar
- If `your_share === 0` (no expenses): show "No expenses this month" with a subtle prompt

### 3.2 Quick Actions

4 circular icons in a horizontal row below the hero card.

| Action | Icon | Route |
|--------|------|-------|
| Add Expense | `add-outline` | `/expenses/new` |
| Settle Up | `checkmark-circle-outline` | `/(tabs)/groups` — simply navigates to the Groups tab (no scroll-to mechanism needed; settlement info is at the top of the screen) |
| Activity | `time-outline` | `/activity` |
| Analytics | `bar-chart-outline` | `/analytics` |

**Styling per action:**
- Circle: 56px, background `accent-surface`, border-radius full
- Icon: 22px, color `accent`
- Label: 11px `muted`, below circle, margin-top 8

### 3.3 Recent Expenses

Section with "Recent expenses" heading + "See all >" link.

**List items:** Each expense row in a shared `Card`:
- Left: category icon in 40px colored circle (pastel background, colored icon)
- Center: title (14px semibold `foreground`) + relative date (12px `muted`)
- Right: amount (14px semibold `foreground`) + HeroUI `Chip` status badge

**Status chip mapping:**
- Settled: `Chip` color="success", label="PAID"
- Overdue: `Chip` color="danger", label="OVERDUE"
- Partial: `Chip` color="warning", label="{paid}/{total}"
- Due soon: `Chip` color="default", label="DUE"

**Max 5 items.** "See all" navigates to Expenses tab.

### 3.4 Spending Trend

6-month bar chart inside a HeroUI `Card`. Same data logic as current.

**Chart implementation:** Custom `View` rectangles (same approach as current — no charting library). Each bar is a `View` with dynamic height, fixed width (50% of column), and `rounded-md` (6px) top corners. This is simple enough that a library would be overkill.

- Current month bar: `accent-bright` (#4ade80)
- Other months: `border` color (light gray)
- Month labels below bars (current month label bold, others normal weight)
- Card has no title — the chart speaks for itself
- Chart height: 120px (matching current)

### 3.5 Removed Sections

The following sections from the current home screen are **removed** to reduce clutter:

- Weekly Activity Tracker (7-day dots)
- Savings Challenge card
- Quick Stats Row (members count, categories count)
- Settle Up section (absorbed into hero card)
- Trial card (moved to Settings > Billing section. Additionally, when trial is < 3 days from expiring, show a HeroUI `Alert` status="warning" banner at the top of the **Home screen only**, with a "View plans" action button)

## 4. Expenses Screen (`app/(tabs)/expenses.tsx`)

Restyle with HeroUI components. Keep existing data logic and FlatList performance settings.

### Layout

```
Expenses
£1,240.00 total · 23 expenses

[🔍 Search expenses...              ]

┌────────┐ ┌────────┐
│Overdue │ │Due soon│
│   3    │ │   5    │
└────────┘ └────────┘

[All] [Rent] [Groceries] [Bills] ...

┌──────────────────────────────────────┐
│ 🏠 March Rent         £650.00  PAID │
│ ⚡ Electric            £89.00  OVERDUE│
└──────────────────────────────────────┘
```

**Changes from current:**
- Header: plain `Text` (28px bold), no dark `HeroPanel`
- Search bar: HeroUI `Input` with search icon prefix, `surface-secondary` background
- Stat cards: HeroUI `Card` variant="secondary" — overdue count in `danger` color, due-soon in `foreground`
- Filter pills: HeroUI `Chip` components (pressable, selected state via color)
- Expense rows: HeroUI `Card` variant="default" with pressable wrapper
- Status badges: HeroUI `Chip` (same mapping as home screen)
- Remove "Add expense" button from list header (FAB handles creation)
- Background: `background` token
- FlatList config unchanged: `initialNumToRender={15}`, `maxToRenderPerBatch={10}`, `windowSize={5}`

## 5. Groups Screen (`app/(tabs)/groups.tsx` — renamed from `breakdown.tsx`)

Consolidates: current Breakdown tab + Members view + Group detail into one cohesive screen.

### Layout

```
Groups                          [Manage]

┌─── Active Group Card ─────────────────┐
│  🏠 Flat 4B, Camden                   │
│  4 members · £2,340 this month         │
│  ████████░░░░  72% settled             │
└────────────────────────────────────────┘

Members
┌────────────────────────────────────────┐
│ [JW] Josh Wiggins    -£142.50    OWE  │
│ [SK] Sarah Kim       +£89.00   OWED   │
│ [TM] Tom Murray       £0.00  SETTLED  │
└────────────────────────────────────────┘

Spending Breakdown
🏠 Rent         ████████████  62%  £1,450
⚡ Bills         ████░░░░░░░  18%  £420
🛒 Groceries    ██░░░░░░░░░  12%  £280

[All] [Jan] [Feb] [Mar] ...

Expenses (filtered list)
```

**Components:**
- Group card: HeroUI `Card` with settlement progress bar (`accent-bright`)
- Member list: HeroUI `Avatar` + name + balance. Red text for owing, green for owed, `muted` for settled
- Category breakdown: same horizontal bar pattern from current breakdown (it's effective), restyled with HeroUI `Card` wrapper
- Month selector: horizontal `Chip` scroll
- "Manage" button (top right): navigates to `/group-edit`
- Mark payment: HeroUI `Button` variant="secondary" on each expense item
- Expense list: same FlatList with HeroUI components

**Data sources:** Reuses `useUserBreakdown`, `useGroup`, `useMarkPayment` hooks unchanged.

## 6. Settings Screen (`app/(tabs)/settings.tsx`)

Restyle with HeroUI components. Add dark mode toggle.

### Layout

**Profile card:** HeroUI `Card` with `Avatar` (64px, image or fallback) + name + email + member since.

**Profile form:** HeroUI `Card` containing:
- `TextField` + `Input` for: First name, Last name, Phone, Country, Avatar URL
- `Button` variant="primary" for "Save profile"

**Notifications:** HeroUI `Card` containing:
- 4x `ControlField` + `Switch` + `Label` + `Description` rows
- Same notification keys as current

**Appearance (new section):** HeroUI `Card` containing:
- Single `ControlField` + `Switch` for dark mode toggle
- Animated sun/moon icons in switch thumb (using `Switch.StartContent` / `Switch.EndContent`)

**Billing:** HeroUI `Card` with plan info + `Button` for manage billing / view plans.

**Quick Links:** Compact list (not full-width buttons) — each link is a pressable row with icon + label + chevron.

**Sign Out:** HeroUI `Button` variant="danger" at bottom.

**Feedback replacement:** Use HeroUI `Toast` for "Saved" confirmation instead of `Alert.alert`. Use HeroUI `BottomSheet` for sign-out confirmation instead of `Alert.alert`.

## 7. Modal Screens

All modal/stack screens follow the design system:

- Background: `background` token
- Content sections: HeroUI `Card`
- Actions: HeroUI `Button`
- Forms: HeroUI `TextField` / `Input`
- Status: HeroUI `Chip`
- Success/error feedback: HeroUI `Toast` (replaces `Alert.alert` for non-destructive)
- Destructive confirmations: HeroUI `BottomSheet` (replaces `Alert.alert` for destructive actions like delete)
- Loading states: HeroUI `Skeleton` with `isLoading` prop and shimmer animation

**Screens affected:**
- `/expenses/new` — new expense form
- `/expenses/[expenseId]` — expense detail
- `/expenses/[expenseId]/edit` — edit expense
- `/activity` — activity log
- `/analytics` — charts and analytics
- `/notifications` — notification list
- `/onboarding` — onboarding flow
- `/members` — **kept as a standalone screen** for detailed member management (invite, remove, role changes). The Groups tab shows a summary member list; tapping a member or the "Manage" button navigates here.
- `/group-edit` — edit group
- `/pricing` — plan selection
- `/recurring` — recurring expense management

## 7.1 Auth Screens (`app/(auth)/*`)

The auth screens (`login.tsx`, `signup.tsx`, `forgot-password.tsx`, `reset-password.tsx`) currently import `AppButton` and `TextField` from `components/ui.tsx`. Since `ui.tsx` is being deleted, these screens **must** be restyled with HeroUI Native components.

**Changes:**
- `AppButton` → HeroUI `Button`
- `TextField` → HeroUI `TextField` + `Input`
- Background: `background` token
- Card wrapper: HeroUI `Card` for the form section
- Logo/branding area: centered "Commune" text (28px bold) + subtitle
- Error messages: inline `Text` with `danger` color (keep current pattern)
- Google OAuth button: HeroUI `Button` variant="secondary" with Google icon
- Link text (e.g., "Forgot password?"): keep as expo-router `Link` with `accent` color

**Auth screens are included in migration Step 10 ("Restyle all modal screens").**

> **Note on currency in examples:** All `£` symbols in this spec are display-only examples. The actual currency symbol comes from the group's `currency` field via `formatCurrency()` from `@commune/utils`.

## 8. File Structure Changes

### Deleted Files
- `components/ui.tsx` — replaced by HeroUI Native components
- `tailwind.config.js` — replaced by Uniwind CSS theme config

### New Files
- `components/theme.ts` — Uniwind theme configuration (color tokens, light/dark CSS layers)
- `components/providers.tsx` — HeroUI `Provider` + `ToastProvider` wrapper
- `stores/theme.ts` — Zustand store for theme preference (light/dark), persisted to AsyncStorage

### Modified Files
- `app/_layout.tsx` — wrap app in HeroUI Provider, read theme preference on startup
- `app/(tabs)/_layout.tsx` — rewrite: light tab bar, profile header, 4 tabs + FAB
- `app/(tabs)/index.tsx` — rewrite: hero debt card, quick actions, recent expenses, trend chart
- `app/(tabs)/expenses.tsx` — restyle: HeroUI components, light theme
- `app/(tabs)/breakdown.tsx` — rename to `groups.tsx`, rewrite: consolidated group view
- `app/(tabs)/settings.tsx` — restyle: HeroUI components, add dark mode toggle
- `app/(auth)/login.tsx` — restyle: HeroUI Button, TextField, Input
- `app/(auth)/signup.tsx` — restyle: HeroUI Button, TextField, Input
- `app/(auth)/forgot-password.tsx` — restyle: HeroUI Button, TextField, Input
- `app/(auth)/reset-password.tsx` — restyle: HeroUI Button, TextField, Input
- `components/group-switcher.tsx` — restyle: use HeroUI Select
- `components/TrialExpiryBanner.tsx` — restyle: use HeroUI Alert
- `global.css` — update: Uniwind theme layers with color tokens
- `package.json` — add `heroui-native`, `uniwind`; remove `nativewind`
- `babel.config.js` — update for Uniwind
- `metro.config.js` — update for Uniwind
- All modal screens — restyle with HeroUI components

### Unchanged
- All hooks (`hooks/*`) — data layer stays the same
- All stores (`stores/auth.ts`, `stores/group.ts`) — unchanged except new `stores/theme.ts`
- Shared packages (`@commune/api`, `@commune/types`, `@commune/utils`) — unchanged
- `app.json` — unchanged

## 9. Dependencies

### Add
- `heroui-native` — component library
- `uniwind` — Tailwind v4 for React Native (required by HeroUI Native)

### Remove
- `nativewind` — replaced by Uniwind

### Keep
- `expo-router` — navigation (unchanged)
- `@react-navigation/native` — tab navigator (unchanged)
- `react-native-reanimated` — required by HeroUI Native animations
- `react-native-safe-area-context` — safe area handling
- `@expo/vector-icons` — Ionicons (still used alongside HeroUI)
- `zustand` — state management
- `@tanstack/react-query` — data fetching
- `@supabase/supabase-js` — backend
- `@react-native-community/datetimepicker` — date picker (HeroUI has no equivalent)

## 10. Migration Strategy

**Approach A: Component-First Rebuild.** Rebuild the design system first (theme + provider), then migrate all screens in a single pass.

**Order:**
1. Install HeroUI Native + Uniwind, remove NativeWind. **Run API Verification Gate** — audit actual component exports, props, variants, and theming API against this spec. Update spec if any discrepancies found before proceeding.
2. Configure Uniwind theme (color tokens, light/dark CSS layers)
3. Set up HeroUI Provider + ToastProvider in root layout
4. Create theme store (Zustand + AsyncStorage persistence)
5. Rewrite tab layout (light bar, profile header, 4 tabs + FAB)
6. Rewrite Home screen
7. Restyle Expenses screen
8. Rewrite Groups screen (renamed from Breakdown)
9. Restyle Settings screen (+ dark mode toggle)
10. Restyle auth screens (login, signup, forgot-password, reset-password)
11. Restyle all remaining modal screens (expense detail/new/edit, activity, analytics, notifications, onboarding, members, group-edit, pricing, recurring)
12. Delete `components/ui.tsx` and `tailwind.config.js`
13. Test light/dark mode across all screens
14. Accessibility pass — verify all pressable elements have labels

**No feature changes** — this is purely visual. All data hooks, stores, navigation routes, and business logic remain unchanged.
