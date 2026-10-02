# Commune — Mobile Design System

Source of truth for the mobile redesign. HTML mockups in this folder are the target; live code should match them.

## Stack

- **UI library:** [`heroui-native`](https://github.com/heroui-inc/heroui-native) — the app's component system. **All screens must use it.**
- **Icons:** `@tabler/icons-react-native` — no Ionicons, no emoji as icons.
- **Typography:** system font, weights 400 / 500 / 600 / 700.
- **Palette:** sage accent (`#7a9b7e`-ish), warm off-white surfaces, soft shadows, generous padding.

## Component rules

| Need | Use | Don't use |
|---|---|---|
| Primary action | `<Button variant="primary" size="lg"><Button.Label>…</Button.Label></Button>` | Raw `Pressable` with inline styles |
| Card / tile | `<Card><Card.Body>…</Card.Body></Card>` | Raw `View` with `borderRadius` |
| Selectable tile | `<Pressable>` wrapping `<Card>`, sage border + checkmark chip when selected | Checkbox + text row |
| Sheet / picker | HeroUI `bottom-sheet` or `ActionSheetIOS` | `Alert.alert` with buttons |
| List row | `<ListGroup>` / `<ListGroup.Item>` | Hand-rolled flex row |
| Form input | `<Input>` | Bare `<TextInput>` |

Button variants available: `primary | secondary | tertiary | outline | ghost | danger | danger-soft`.

## Screens (status)

Mockups live in this folder; see [README.md](./README.md) for the file map.

| Screen | Mockup | Live code | Migrated to HeroUI |
|---|---|---|---|
| Onboarding | `remaining-screens.html` | `app/onboarding.tsx` | ⚠️ partial (tiles + Continue done) |
| Home / For You | `all-screens.html` | `app/(tabs)/index.tsx` | ❌ |
| Expenses list | `all-screens.html` | `app/(tabs)/expenses.tsx` | ❌ |
| Groups list | `all-screens.html` | `app/(tabs)/groups.tsx` | ❌ |
| Profile / Settings | `all-screens.html` | `app/(tabs)/settings.tsx` | ❌ |
| Notifications | `recommended.html` | `app/notifications.tsx` | ❌ |
| Settle up | `recommended.html` | `app/settle-up.tsx` | ❌ |
| Analytics | `recommended.html` | `app/analytics.tsx` | ❌ |
| Recurring | `recommended.html` | `app/recurring.tsx` | ❌ |
| Activity | `recommended.html` | `app/activity.tsx` | ❌ |
| Group hub | `remaining-screens.html` | `app/group-hub.tsx` | ❌ |
| Member profile | `remaining-screens.html` | `app/member-profile.tsx` | ❌ |
| Expense detail | `remaining-screens.html` | `app/expenses/[id].tsx` | ❌ |
| New expense | `remaining-screens.html` | `app/expenses/new.tsx` | ❌ |

## Why the app doesn't look like the mockups yet

Earlier redesign passes used raw `Pressable` + `View` + inline styles. That gives plain rectangles with no shadow, no radius system, no touch feedback, no consistent typography. The mockups look polished because they use HeroUI's card/button/list primitives. The fix is mechanical: swap raw primitives for HeroUI ones screen-by-screen, matching the mockup. Onboarding is the reference implementation — copy that pattern.

## Contributing

1. Open the mockup HTML file for the screen you're editing.
2. Match the live screen to the mockup using HeroUI components only.
3. If a HeroUI component doesn't exist for what you need, compose from `Pressable` + `Card`, not from scratch.
4. When code and mockup diverge, the mockup wins — update code, not the mockup.
