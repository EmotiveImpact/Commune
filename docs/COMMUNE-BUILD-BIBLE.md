# Commune — Complete Session Reference

**Date:** March 23-27, 2026
**Session Scope:** Competitive research → V2-V4 feature build → Quality review → Polish

---

## 1. COMPETITIVE RESEARCH FINDINGS

### Market Size
| Market | Size (2025) | Projected | Growth |
|--------|------------|-----------|--------|
| Bill Splitting Apps | $612M | $658M (2026) | 7.3% CAGR |
| Expense Management Software | $7.7B | $13.8B (2031) | 10.1% CAGR |
| Co-Living Market | $7.7-8.3B | $16B+ by 2030 | 13.5% CAGR |
| Embedded Finance | — | $570.9B by 2030 | Explosive |

### Key Stat
> 85+ million U.S. adults used a bill splitting app at least once in 2024

### Competitor Analysis

#### Splitwise
- **Trustpilot:** 1.8/5 (65% are 1-star)
- **Revenue:** ~$6.6M on 31M downloads ($0.21 per download)
- **Top complaints (ranked by frequency):**
  1. Daily expense cap (3-5/day on free tier)
  2. 10-second countdown timer before each expense
  3. Aggressive upselling modals
  4. No communication about changes
  5. Multi-currency paywalled
  6. No draft saving
  7. Deletion affects everyone
  8. No item-level splitting
  9. Payment processing issues
- **501-vote feature request (since 2016, never built):** Couple/family account

#### Tricount
- **Rating:** 4.84/5 Play Store, 3.5/5 Trustpilot
- **Status:** Acquired by bunq (European neobank) — causing instability
- **Issues post-acquisition:** Data loss, web version removed, CSV export removed, sync bugs
- **Strength:** Completely free, no ads, no limits

#### Settle Up
- **Strength:** Unlimited free transactions, weighted contributions, cross-platform
- **Weakness:** Sync is terrible ("out of 50 sync attempts, only 1 works"), invasive ads

#### Splid
- Simple, no limits on free tier, 150+ currencies
- Extremely basic, no receipt scanning, not designed for ongoing use

#### Others
- **Billr/Tab:** Restaurant-only receipt splitting, different niche entirely
- **Cospend/IHateMoney:** Self-hosted, developer-only, not consumer-grade
- **Spendshare:** Does not exist as a commercial product

### The Market Opportunity
> The market leader (Splitwise) has a 1.8/5 trust rating and $6.6M revenue on 31M downloads, the co-living market is growing at 13.5% CAGR toward $16B, and nobody has built a dedicated tool for people who live together.

### What Users Want (from Reddit, Trustpilot, G2, forums)
1. No-download group joining (web link)
2. Smart settlement (minimum transactions)
3. Receipt OCR with item-level splitting
4. Recurring expense automation
5. Bank feed integration
6. All-in-one household management (expenses + chores + shopping)
7. Couple mode (two people as one financial unit)
8. Transparent, trust-preserving pricing
9. Per-trip pricing (7-10 day pass)
10. Better export/reporting

### Pricing Psychology
- Users expect core splitting to be free
- Will pay one-time fee ($5-10) more readily than subscription
- $3-5/month seen as excessive for a splitter
- Per-group pricing aligns better with network-effect products
- Splitwise's aggressive monetization destroyed trust

### Switching Behaviour
| From | To | Why |
|------|----|-----|
| Splitwise | Tricount | Free, no paywalls |
| Splitwise | Settle Up | No daily limits |
| Splitwise | Spliit (open source) | Free, self-hostable |
| Splitwise | SplitPro (open source) | Multi-currency, import |
| Splitwise | Google Sheets | Full control, no vendor risk |

---

## 2. PRODUCT VISION

### Core Concept
Commune is a **hub-based communal living and shared space operating system**. Each house, group, or shared space becomes its own personalised financial and social hub.

### What Makes It Different
> Most finance or household apps go straight to function and skip identity. Commune gives each group clarity, warmth, social texture, instant orientation, and emotional attachment.

### The "Hub" Idea (from user conversations)
Each Commune should have a clean, high-impact overview page that works like a social/product landing page:

**First impression (no scrolling):**
1. What is this house/group?
2. Who's in it?
3. What is the money for?
4. What is the current state?
5. What do I personally owe or need to do?

**Then depth:**
- Scroll for more detail
- Tap into categories
- Open individual breakdowns
- Move into documents, payments, history, tasks, and member activity

### Design Principles
- The first viewport should answer 5 things without scrolling
- Hook first (Instagram-style), detail underneath
- Customisable identity (cover photo, avatar, tagline)
- Social texture without becoming noisy
- Make it feel like a place, not a spreadsheet

### Navigation Structure
```
Account level → one user, many hubs
Hub level → one shared group space (members, money, roles, identity)
Inside each hub → overview, breakdown, people, activity, settings
```

---

## 3. GROUP TYPES & SUB-TYPES

### Top-Level Types
| Type | Sub-types | Key Features |
|------|-----------|-------------|
| **Home** | Shared house, Student, Family, Co-living, High-turnover | Recurring bills, auto-splits, house info, chores |
| **Couple** | Living together, Not together, Engaged, Married | Couple linking, spending insights |
| **Workspace** | Coworking, Shared office, Team, Freelancers | Receipt scanning, exports, auto-splits, billing dashboard |
| **Project** | — | Budget tracking, fund management, exports |
| **Trip** | Holiday, Weekend, Festival, Business, Backpacking | Multi-currency, quick entry, receipt scanning |
| **Other** | — | All features available |

### Positioning
Commune is home-first but not home-only. It's for any ongoing shared space where 2+ people need shared financial truth, clear responsibilities, group-level visibility, and less operational friction.

---

## 4. PRICING TIERS

| Plan | Price | Annual | Members | Groups | Key Features |
|------|-------|--------|---------|--------|-------------|
| Standard | £4.99/mo | £49.90/yr (2 months free) | 8 | 1 | Core features, settlement, templates |
| Pro | £9.99/mo | £99.90/yr (2 months free) | 15 | 5 | Analytics, exports, OCR (50/mo), import, annual billing |
| Agency | £29.99/mo | £299.90/yr (2 months free) | Unlimited | Unlimited | Funds, proration, cross-group, unlimited OCR, priority support |
| Trip Pass | £2.99 (one-time) | — | — | — | 14-day Pro access (planned) |

### Receipt Scan Limits
| Plan | Scans/Month |
|------|------------|
| Standard | 10 |
| Pro | 50 |
| Agency | Unlimited |

---

## 5. FEATURES BUILT (V1-V4)

### V1 — Foundation (Phases 1-7)
- Google OAuth authentication
- Multi-currency (group + expense level)
- Expense creation, editing, archiving
- Split methods (equal, percentage, custom)
- Recurring expenses (daily, weekly, monthly, yearly)
- Group management (create, edit, invite, 6 types)
- Member management (roles: owner/admin/member)
- Push notifications (Web Push API + service worker)
- Activity log with CSV export
- CSV/PDF export (expenses + statements)
- Payment provider links
- Monthly PDF statements (edge function)
- Group analytics/charts (Recharts)
- Dashboard with quick actions
- Breakdown page
- Stripe integration (checkout, portal, webhooks)
- Subscription management
- Plan limits enforcement (Postgres triggers)
- 7-day Pro trial
- Free invited members
- Email notifications
- RLS on all tables
- GDPR compliance (data export, account deletion with 14-day grace period)

### V2 — Competitive Differentiation (Stages 1-4)
- **F20:** Dark mode (light/dark/system with Mantine)
- **F21:** Smart settlement algorithm (minimum transactions, cents-based)
- **F22:** Auto-split templates (create, apply, edit, delete)
- **F23:** Annual billing (20% discount, SegmentedControl toggle)
- **F24:** Standard member limit 5→8
- **F25:** Draft saving for expense form (localStorage, debounced)
- **F28:** Splitwise import wizard (4-step: upload, map, preview, import)
- **F29:** Tier-gated features (analytics/exports behind Pro)
- **F32:** Payment nudge reminders (push + email, 3-day cooldown, group toggle, admin history)
- **F33:** Group funds / shared pots (create, contribute, track, progress bars)
- **F34:** Member proration (join/leave mid-cycle, redistribution, admin date override)
- **F35:** Group budgets (monthly + category-level, alert thresholds)
- **F36:** Group-type-aware UI (quick actions, empty states, category ordering, onboarding tips)
- **F37:** Cross-group debt netting (opt-in toggle, per-group view)
- **F38:** Couple mode (linked members settle as one unit, auto-link trigger)

### V3 — Hub System & Intelligence (Stages 5-7)
- **F43:** Group Hub landing page (cover photo, avatar, tagline, health badge, members, breakdown, activity, quick actions)
- **F44:** Member profile pages (settlement status, payment methods, shared groups, recent activity, quick pay)
- **F45:** Pinned announcements (admin-editable, hub banner)
- **F46:** House essentials (Wi-Fi, bins, landlord, emergency, house rules)
- **F47:** Group sub-types
- **F48:** Cross-Hub Command Centre (priorities, smart nudges, group status pills)
- **F49:** Expense approval flows (configurable threshold, admin approve/reject)
- **F50:** Command Centre upgrade (smart predictive nudges)
- **F51:** Chores/tasks system (create, assign, rotate, complete, overdue)
- **F52:** Multiple payment methods per user
- **F53:** Account deletion with 14-day grace period

### V4 — Trust, Mobile, Polish
- **Trust layer:** Edit history trigger on expenses, expense flagging/query mechanism, universal approval visibility
- **Smart nudges:** Real settlement data (replaced empty arrays with actual calculations)
- **Payment psychology:** Softer language across all money UI ("outstanding" not "you owe", "coming your way" not "owed to you")
- **Receipt OCR:** Gemini 2.0 Flash edge function (~$0.0003/scan), plan-based limits
- **Memory layer:** Group memories for shared culture/identity
- **Activity page:** 2-column layout (1/3 context sidebar + 2/3 feed)
- **Mobile parity:** Group Hub, Command Centre, settlement hooks, funds, templates, member profiles
- **Payment providers:** Added Wise, Starling, Venmo, Cash App (total: 7 providers)
- **PayPal fix:** Corrected URL construction (paypal.me/username not paypal.com/paypalme/...)

---

## 6. ARCHITECTURE

### Tech Stack
| Layer | Technology |
|-------|-----------|
| Web | React 19, Vite, TypeScript, Mantine 9, TanStack Router, TanStack Query, Zustand |
| Mobile | Expo, React Native, HeroUI Native |
| Backend | Supabase (PostgreSQL, Auth, RLS, Edge Functions, Storage) |
| Payments | Stripe (checkout, subscriptions, webhooks) |
| Email | Resend |
| Push | Web Push API + VAPID |
| OCR | Google Gemini 2.0 Flash |
| Monorepo | Turborepo, pnpm workspaces |
| Validation | Zod (shared schemas in packages/core) |
| Charts | Recharts |

### Project Structure
```
commune/
├── apps/
│   ├── web/              # Vite + React + Mantine 9
│   ├── mobile/           # Expo + React Native
│   └── landing/          # Next.js marketing site
├── packages/
│   ├── core/             # Business logic, splits, settlement, schemas
│   ├── types/            # Shared TypeScript types and enums
│   ├── utils/            # Date helpers, currency formatting
│   └── api/              # Supabase client, queries, mutations (30+ modules)
├── supabase/
│   ├── migrations/       # 55+ sequential SQL migrations
│   └── functions/        # 7 Edge Functions
└── docs/                 # PRDs, vision, plans
```

### Edge Functions
| Function | Purpose |
|----------|---------|
| create-checkout-session | Stripe checkout |
| create-portal-session | Stripe billing portal |
| generate-statement | Monthly PDF statements |
| stripe-webhook | Subscription event handling |
| send-notification | Email + push notifications |
| payment-reminders | Auto-nudge cron job |
| parse-receipt | Receipt OCR via Gemini Flash |

### Key Architectural Decisions
- RLS everywhere — Row Level Security on all tables
- Server validates critical logic — Postgres triggers for split sums, plan limits
- Direct Supabase client + RLS — No edge functions for regular CRUD
- Edge Functions for async — Webhooks, email, cron, PDF, OCR
- Shared packages — Business logic in core, types in types, API in api
- Hub-first navigation — Groups accessed via hub landing pages
- Settlement-driven status — Health badges and command centre derive from settlement hook

---

## 7. NAVIGATION STRUCTURE

### Sidebar
```
Pinned:
  Dashboard        → /
  My Groups        → /groups

Money:
  Expenses         → /expenses
  Recurring        → /recurring
  Templates        → /templates
  Funds            → /funds
  Billing          → /billing (workspace only)

Insights:
  Command Centre   → /overview
  Breakdown        → /breakdown
  Analytics        → /analytics

Team:
  Members          → /members
  Operations       → /chores
  Activity         → /activity
```

### Profile Menu (avatar dropdown)
- Profile → /profile
- Settings → /settings
- Manage plan → /pricing

### Key User Flows
```
Login → Dashboard (no group: "Select a group" prompt)
     → My Groups → Click card → Group Hub → Members/Expenses/Activity
     → Command Centre (cross-group priorities)
```

---

## 8. MOBILE vs WEB PARITY

### Features on Both ✅
- Expenses (CRUD)
- Recurring expenses
- Activity log
- Analytics
- Dashboard
- Chores/Operations
- Group edit
- Group cycle close
- Pricing
- Onboarding
- Dark mode
- Settings

### Web Only (not on mobile) ❌
- Group Hub landing page (rich version)
- Command Centre (cross-group)
- Member profiles (detail view)
- Approval flows
- Smart settlement view
- Billing dashboard
- Funds management
- Templates management
- Import wizard
- Breakdown (detailed)
- Couple linking UI
- Activity 2-column layout

### Mobile Hooks Not Yet Created
- use-approvals
- use-settlement
- use-group-hub (full version)
- use-templates
- use-funds
- use-budgets
- use-workspace-billing
- use-workspace-governance
- use-payment-methods
- use-receipts
- use-nudges / use-smart-nudges
- use-couple-linking
- use-cross-group
- use-auth-listener
- use-push-notifications

---

## 9. TRUST & TRANSPARENCY LAYER

### What's Built
- Activity log captures creates, deletes, and now updates (edit history trigger)
- Expense flagging/query mechanism (non-admin can flag, admin can dismiss)
- Approval status shown for ALL group types (not just workspace)
- "Approved by [Name] on [Date]" / "Rejected by [Name] on [Date]" alerts
- Receipt upload and deletion
- Payment tracking (mark as paid/unpaid)

### What's Not Built
- Full dispute resolution flow (formal back-and-forth)
- Edit diff display (showing old vs new values in activity)
- Complete audit trail UI (dedicated audit view)

---

## 10. SMART NUDGES

### How They Work
- Edge function `payment-reminders` runs on cron
- `packages/api/src/smart-nudges.ts` generates context-aware nudges
- Now uses REAL settlement data (previously had empty transaction arrays)
- Displayed on Command Centre (overview page)

### Nudge Types
- `overdue_bills` — expenses past due date
- `others_pending` — "Waiting on X others" (people who owe you)
- `unsettled_purchases` — "Settle up in [GroupName]" (you owe money)
- `budget_warning` — spending approaching/exceeding budget
- `spending_spike` — month-over-month increase

### Language (Payment Psychology)
- "You owe £50" → "£50 outstanding"
- "3 people owe you" → "Waiting on 3 others"
- "Over budget" → "Heads up on spending"
- "All settled!" → "All squared away!"
- "Owed to you" → "Coming your way"

---

## 11. RECEIPT OCR SYSTEM

### Architecture
```
User uploads photo → Supabase Storage
                   → Edge Function (parse-receipt)
                   → Google Gemini 2.0 Flash (vision)
                   → Returns {amount, vendor, date, currency, lineItems[]}
                   → Pre-fills expense form
```

### Cost
~$0.0003 per receipt (a third of a penny). 10,000 scans = $3.

### Environment Variable
```
GEMINI_API_KEY=AIzaSy... (set as Supabase secret)
```

### Scan Limits
Tracked per subscription with monthly reset. Standard: 10/mo, Pro: 50/mo, Agency: unlimited.

---

## 12. PAYMENT PROVIDERS

### Supported (7 total)
| Provider | URL Pattern | Regions |
|----------|-------------|---------|
| Revolut | revolut.me/username | UK, EU |
| Monzo | monzo.me/username | UK |
| PayPal | paypal.me/username | Global |
| Wise | wise.com/pay/username | Global |
| Starling | settleup.starlingbank.com/username | UK |
| Venmo | venmo.com/username | US |
| Cash App | cash.app/$cashtag | US, UK |
| Bank Transfer | Display only (sort code + account) | UK |

### Future: Crezco (Open Banking)
- One-click bank-to-bank payment links via Open Banking
- Works with ALL UK banks
- ~$0.20-0.50 per payment request
- Automatic settlement confirmation via webhooks
- Post-launch feature (V5)

---

## 13. DATABASE (Supabase)

### Key Tables
- groups (with avatar_url, cover_url, tagline, pinned_message, house_info, approval_threshold, subtype, nudges_enabled, space_essentials)
- group_members (with effective_from, effective_until, linked_partner_id)
- expenses (with approval_status, approved_by, approved_at, flagged_by, flagged_reason)
- expense_participants
- payment_records
- recurring_expenses
- activity_log
- user_payment_methods
- split_templates
- group_funds, fund_contributions, fund_expenses
- group_budgets (with category_budgets, alert_threshold)
- chores, chore_completions
- payment_nudges
- group_memories
- group_cycle_closures
- subscriptions (with receipt_scan_count, receipt_scan_reset_at)

### Storage Buckets
- avatars (user profile photos)
- receipts (expense receipt uploads)
- group-images (group avatars + cover photos)

### Edge Function Secrets
- STRIPE_SECRET_KEY
- STRIPE_WEBHOOK_SECRET
- RESEND_API_KEY
- VAPID_PRIVATE_KEY
- GEMINI_API_KEY

---

## 14. SECURITY

### RLS Policies
- All tables have RLS enabled
- Group-scoped access (members can only see their groups' data)
- Admin-only operations (edit group, manage members, approve expenses)
- Owner-only operations (delete group, transfer ownership)

### Edge Function Auth
- All functions validate JWT via Supabase auth
- parse-receipt uses --no-verify-jwt (handles auth manually for scan limit checking)

### RPC Functions Protected
- accept_group_invite
- accept_invite_by_token
- fn_transfer_group_ownership
- invite_group_member
- soft_delete_account
- validate_invite_token

### Account Deletion
- 14-day grace period (soft delete)
- Re-login within grace period reactivates
- After 14 days: hard delete or anonymise

---

## 15. REMAINING BACKLOG

### High Priority (before launch)
| Feature | Effort | Notes |
|---------|--------|-------|
| Landing page (full marketing site) | Medium | #1 launch blocker — currently skeleton |
| End-to-end testing with real users | Medium | Only way to find real UX issues |
| Mobile hub parity | Large | 15 hooks + 7 pages missing |

### Medium Priority (post-launch)
| Feature | Effort | Notes |
|---------|--------|-------|
| Trip pass pricing (F30) | Small | £2.99/14 days, Stripe config |
| PWA offline mode (F31) | Medium | IndexedDB for offline expense entry |
| Item-level splitting (F27) | Large | New schema + OCR integration |
| Edit diff display in activity | Small | Parse metadata.changes for readable diffs |

### Low Priority (V5+)
| Feature | Effort | Notes |
|---------|--------|-------|
| Open Banking / Crezco (F39) | Very large | Auto-detect expenses, auto-settle |
| In-app settlement / Stripe Connect (F40) | Very large | P2P transfers within Commune |
| Shopping lists (F42) | Medium | All-in-one household play |
| Full dispute resolution flow | Medium | Formal query/response/resolve chain |
| Photo strip / house memory board | Small | Richer culture layer |

### "Need a Decision" Items
| # | Item | Recommendation |
|---|------|---------------|
| 17 | Shopping lists | Defer — dilutes core value |
| 18 | Trip pass pricing | Build it — small effort, good revenue |
| 19 | B2B2C co-living channel | Defer — revisit after traction |
| 20 | Budget tier placement | Confirm Pro — already there |
| 22 | PWA/offline priority | High for Trip groups |
| 24 | Voice/NLP | Park indefinitely |
| 25 | Crypto settlement | Park indefinitely |

---

## 16. CHATGPT'S INDEPENDENT ASSESSMENT

> "This repo is no longer just 'Commune the expense app'. It is becoming: **Commune — a shared space operating system with financial truth, operational coordination, and emerging social identity.**"

### What ChatGPT said is strongest:
- Hub-based group system
- Group landing page / hub identity
- House health / status layer
- "You" lens (personal financial reality)
- Recurring bills and life admin
- Chores / responsibilities layer
- Cross-hub command centre
- Approval flows

### What ChatGPT said is weakest:
1. Mobile parity with web (60% of features missing)
2. Edit history / trust transparency
3. Memory and culture layer (shallow vs financial/operational)
4. Smart nudges (were approximate, now fixed)
5. Payment psychology polish (mechanics there, tone wasn't — now fixed)

### ChatGPT's verdict:
> "The best next suggestion: Make mobile match the web's best ideas, then strengthen the trust layer. The biggest next move is parity + trust + emotional polish, not another raw feature pile."

---

## 17. KEY DECISIONS MADE

1. **"Operations" not "Chores"** — Works across all group types (homes, workspaces, projects)
2. **Per-group pricing** — One person pays, everyone joins free. Avoids Splitwise's "per-user paywall" problem.
3. **No free tier, no guest links** — The invite system handles onboarding. Magic link / Google sign-in reduces friction to ~5 seconds.
4. **Soft delete with grace period** — 14 days before hard delete. Legal best practice.
5. **Gemini Flash for OCR** — 100x cheaper than GPT-4o, still reads receipts well.
6. **Sidebar renamed "Chores" to "Operations"** — Universal across group types.
7. **Command Centre** (not "Overview") — Clearer purpose naming.
8. **2-col max for data cards, 3-col for pricing/small items** — Consistent grid philosophy.
9. **Buttons at top (PageHeader)** not bottom of forms — SaaS convention.
10. **Activity page: 1/3 context sidebar + 2/3 feed** — Not equal columns.

---

## 18. ENVIRONMENT SETUP

### Required Environment Variables
```
VITE_SUPABASE_URL=https://rkjjqoqiymrmojdcvgjk.supabase.co
VITE_SUPABASE_ANON_KEY=...
STRIPE_SECRET_KEY=...
STRIPE_WEBHOOK_SECRET=...
VAPID_PRIVATE_KEY=...
RESEND_API_KEY=...
GEMINI_API_KEY=AIzaSyAaDkaMA-GQDwq7FPh8DbXZOLkollDt4RM
APP_URL=...
```

### Dev Server Ports
| App | Port | Command |
|-----|------|---------|
| Web | 5173 | `pnpm --filter @commune/web dev` |
| Landing | 3001 | `pnpm --filter @commune/landing dev` |
| Mobile | 8081 | `pnpm --filter @commune/mobile start` |

### Supabase
- Project ref: `rkjjqoqiymrmojdcvgjk`
- Project name: Commune Database
- Region: eu-west-2
- 55+ migrations applied
- MCP linked to different project (`vphjwvleffuwwgbjxups`) — use CLI for DB operations

### GitHub
- Repo: EmotiveImpact/Commune
- Branch: main
