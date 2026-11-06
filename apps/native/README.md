# Commune phone app (Expo)

The native iPhone and Android app, built from the approved phone design
(Home Direction B, the five-tab bar ending in Profile, the push menu behind
the burger, the Hub with its tabs under the photo, and the pay sheet with pay
links; prototype versions 5, 6 and 7). It is separate from `apps/mobile` and `apps/mobile-v2`, which are older
experiments.

## What it does

- **Home**: your standing on the dark band, the next step raised over it, your
  communes, what needs you (grouped by when it is due), what you are waiting on,
  and what other people did.
- **Hub**: the commune's photo with this week's pulse, then Overview, Money,
  Chores and Notes. The tabs sit under the photo (sticky) or at the bottom, as
  chosen in Settings under Layout; swiping sideways moves between them.
- **Expenses, Settle, Profile**: the commune's expenses, who you pay and who
  pays you, and you: where you stand in each currency (never added together)
  and how people pay you, with a favourite.
- **Menu** (the burger, top right): your communes, the rest of the commune in
  view (chores and tasks, notes, members, recurring bills, funds, templates),
  notifications, settings, help and sign out.
- **"I’ve paid"**: opens a sheet with the bill payer's pay links first (Monzo
  and PayPal with the amount filled in, Revolut, or bank details to copy), then
  records the payment. It stays a claim until the bill payer confirms it.
  Commune never moves money.
- **Confirm or "Not received"**, **Nudge**, **Mark done**, **Add an expense**
  (split equally), **How people pay you** (add, change, remove), notifications.

Uneven splits, receipts, corrections, invitations, new communes and adding chores or notes stay on the web
app for now.

## Motion

`src/ui/motion.tsx` holds the three springs every screen uses (smooth, snappy
and bouncy), the press scale and the rise-in with its stagger. It uses
Reanimated and Gesture Handler at the versions Expo SDK 54 expects. With
Reduce Motion on, moves become fades. Form sheets keep the native iOS drag.

## Where its data comes from

Screens never do arithmetic. `src/lib/derive.ts` works everything out from the
same commune snapshots the web app reads, and every command goes to the same
validated database functions with a request id.

| `EXPO_PUBLIC_COMMUNE_API` | Data |
| --- | --- |
| not set | Maya's demo communes, kept on the phone. Nothing leaves the device. |
| `http://127.0.0.1:3005` | A local API (`apps/local-api`). Use a disposable database and port, never 3002 for tests. |
| `same-origin` | A web build served next to the local API (used for browser checks). |

The hosted app (Neon Auth and the Data API) is not connected yet. That needs
Neon Auth sign-in to work from a phone, which is the next piece of work.

## Running it

It keeps its own lockfile so the web CI install is unchanged.

```sh
cd apps/native
pnpm install --ignore-workspace
pnpm start            # Expo Go or a simulator; press i or a
pnpm typecheck && pnpm test
pnpm export:web       # a static web build in dist/
```

`EXPO_PUBLIC_*` values are built into the bundle. After changing one, run
`npx expo start --clear` (or `expo export --clear`) so the old value is not reused.

The local API only listens on 127.0.0.1, so a real phone cannot reach it; the
iOS simulator can, and the Android emulator reaches it as `10.0.2.2`.
