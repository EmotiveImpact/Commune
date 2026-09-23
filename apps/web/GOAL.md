> **Current implementation note (2026-09-23):** This is the original Direction A
> visual brief. Its Maya/Park/Studio/Lisbon fixture and sessionStorage-only
> instructions are historical; the newer product requirement is a shared,
> PostgreSQL-backed local application. Keep the visual and interaction
> constraints, but do not restore fixture data or browser-only shared state.
> The local API and database setup are documented in `apps/local-api/README.md`
> and `infra/local/README.md`. Do not deploy the local auth adapter publicly.

Build the Commune **Vite** web app and ship it. Not mockups. Not Mantine. Not a new design.

**Product.** Commune is hub OS for shared spaces. Finance is the spine. Household / workspace / trip change defaults, not the product. First viewport: what this is, who’s here, what I owe, what’s due, where next.

**You are Maya Chen.** Hubs: 14 Park Street (Jordan Hale, Alex Rivera — you owe £42, Jordan owes £18, British Gas Friday, bins overdue, fund £420, Alex still £180), Studio East (even, ink Monday), Lisbon · Sept (you’re owed £64). This household is the product. Do not invent extra people, bills, or a fake API. Do not wait on a backend. Session in sessionStorage is v1.

**Stack.** `apps/web`: Vite + React 19.1.0 + TypeScript + wouter. pnpm only. Catalog pins. No Mantine. Copy Direction A into this Vite app.

**Look.** Source of truth: `artifacts/redesign-mockups/a-refined/` (`index.html`, `styles.css`) + `shared.css` + `shared.js`. Match that UI. Do not restyle. Do not open Direction D.

Sage `#2d6a4f`. Cream `#f5f1ea` / `#f8f5f0` / `#faf9f7`. Navy `#1a1e2b`. Inter. Logo: `logo.png` (cream Didone C on black); cream-only C is `logo-mark.svg`. Buttons 38px, radius 999px. Desktop rail 230px, always open. Create a commune (dashed) above the hub switcher. Basic nav by default; Advanced only from Settings. Upgrade = sage + white type, not lime. No MC in the desktop header. Sidebar footer / phone avatar go to Settings (page: you + plan left, rows right). Pay-me is a window.

**Logo.** Sidebar: mark 18×18 like nav icons; “Commune” 13.5px / 600, no tracking, not uppercase, same as nav labels. Phone header: mark 38×38 like the icon buttons.

**Login.** Keep the OLD split login from `.migration-backup/apps/web` (`_auth.lazy.tsx`, `_auth/login.lazy.tsx`): navy left (44px logo, COMMUNE, “for people who do life, together.”, “Effortlessly manage your shared expenses.”), form on the right. Form side cream `#f5f1ea`, not white. Welcome Back, email, password, Forgot, navy Log In, Google, Register Now. Same shell for signup, forgot, invite, onboard. Pill buttons.

Do not ship A’s navy gate login. Do not delete those mockups — leave `a-refined/?screen=login` etc for later.

**Flows.** Login (valid email + 8+ char password, or Google) → Home with the three hubs. Signup → onboard (name, type, currency) → hub-empty → add-expense window. Invite → join Park Street or sign in first. Home empty only when there are no communes.

**IA.** Home = all hubs + what needs Maya, not Park Street’s money page. Places = switcher. This Hub = selected house (cover, KPIs, you owe, right now, who owes whom, jumps, this week, notes, members). Page = place. Window = object/act. No URL for “pay Jordan”.

**Phone (≤560 or `?native=1`).** No rail. Navy header. Four tabs: Home, Hub, Expenses, Settle. Hamburger opens More (Create commune, Places, Notes, Funds, Recurring, Operations, Members, You & settings). No fifth tab. No FAB. Expense ledger becomes cards when narrow so category / amount / act still show. Choose and Mark paid same min-width.

**Add note.** Type chips. Extras follow type. The note textarea always stays.

**Run.** http://localhost:3000/ — reset, never start a second server on that port. Mockups may stay on :3001. Port household from `shared.js`. Continue `cursor/commune-redesign-mockups-6a48` and PR 11 if they exist. If `apps/web` already exists and is this Vite app, don’t scaffold twice — finish it.

**Build every screen, clickable.**

Birth: login, signup, forgot, invite, onboard, home-empty, hub-empty, add-expense, expense.

Week: Home, Places, This Hub, Expenses (+ empty), expense / expense-paid, Settle (+ Studio even), Pay, Recurring, Funds, Notes, note, note-new, Operations, Members, member-invite, Notices, Profile, Settings, commune-new.

Off Basic nav: templates, billing, activity, analytics, breakdown.

**Do not rebuild.** Old dashboard / Command Centre. Workspace invoices / approvals. Memories, couple linking, Splitwise, OCR. Cycle-close accounting. Mantine. Collapsing sidebar.

**Do not touch.** `artifacts/redesign-mockups/phone/`. `phone-expo/`. Direction D. Don’t iterate mockups instead of the app. Don’t deploy to Vercel. Don’t wire `@commune/api` in this job.

**Done.** Vite app at :3000, no Mantine. Old cream split login. Logo aligned as specified. Park / Studio / Lisbon switch This Hub. Studio Settle is even, not £42. Birth path and week path both work. Phone: four tabs + More. Click through in the browser (not one screenshot). Commit, push, update PR 11.
