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

---

## 19. IMPLEMENTATION DETAILS (for future sessions)

### How Mobile Parity Should Be Done

The web app has 31 hooks in `apps/web/src/hooks/`. Mobile has 16 in `apps/mobile/hooks/`. The pattern is identical — both use TanStack Query wrapping `@commune/api` functions.

**To port a web hook to mobile, copy the pattern exactly:**

```typescript
// Web: apps/web/src/hooks/use-settlement.ts
import { useQuery } from '@tanstack/react-query';
import { getGroupSettlement } from '@commune/api';

export const settlementKeys = {
  all: ['settlement'] as const,
  group: (groupId: string) => [...settlementKeys.all, groupId] as const,
};

export function useGroupSettlement(groupId: string, month?: string) {
  return useQuery({
    queryKey: settlementKeys.group(groupId),
    queryFn: () => getGroupSettlement(groupId, month),
    enabled: !!groupId,
  });
}
```

**Mobile version is identical** — just create `apps/mobile/hooks/use-settlement.ts` with the same code. The `@commune/api` package is shared.

**15 hooks to port:**
1. `use-approvals.ts` — `usePendingApprovals`, `useApproveExpense`, `useRejectExpense`
2. `use-settlement.ts` — `useGroupSettlement`
3. `use-group-hub.ts` — `useGroupHub`, `useMemberProfile`, `useUploadGroupImage`
4. `use-templates.ts` — `useTemplates`, `useCreateTemplate`, `useUpdateTemplate`, `useDeleteTemplate`
5. `use-funds.ts` — `useFunds`, `useFundDetails`, `useCreateFund`, `useAddContribution`, `useAddFundExpense`, `useDeleteFund`
6. `use-budgets.ts` — `useGroupBudget`, `useSetGroupBudget`
7. `use-workspace-billing.ts` — `useWorkspaceBilling`
8. `use-payment-methods.ts` — `usePaymentMethods`, `useAddPaymentMethod`, `useUpdatePaymentMethod`, `useDeletePaymentMethod`
9. `use-nudges.ts` — `useCanNudge`, `useSendNudge`, `useNudgeHistory`
10. `use-couple-linking.ts` — `useLinkedPairs`, `useLinkMembers`, `useUnlinkMembers`
11. `use-cross-group.ts` — `useCrossGroupSettlements`
12. `use-smart-nudges.ts` — `useSmartNudges`
13. `use-receipts.ts` — receipt management
14. `use-memories.ts` — `useMemories`, `useAddMemory`, `useDeleteMemory`
15. `use-receipt-ocr.ts` — `useReceiptScan`

**7 mobile pages to create:**
1. `apps/mobile/app/group-hub.tsx` — Full hub page (cover, avatar, tagline, health, members, breakdown, activity)
2. `apps/mobile/app/command-centre.tsx` — Cross-group overview (priorities, nudges, group pills)
3. `apps/mobile/app/member-profile.tsx` — Member detail (role, settlement, payment methods, shared groups)
4. `apps/mobile/app/funds.tsx` — Fund list + detail (contributions, expenses, progress)
5. `apps/mobile/app/templates.tsx` — Template list (split method badges, tap to apply)
6. `apps/mobile/app/billing.tsx` — Workspace billing (vendor breakdown, trends)
7. `apps/mobile/app/breakdown.tsx` — Settlement view (smart algorithm, pay buttons)

**Navigation wiring:**
- Register all new screens in `apps/mobile/app/_layout.tsx` as `Stack.Screen` entries
- Add Command Centre as a tab in `apps/mobile/app/(tabs)/_layout.tsx`
- Group Hub accessed via group-switcher tap or groups tab

**Styling pattern:** All mobile pages follow the same theme from `apps/mobile/app/group-hub.tsx`:
```typescript
const theme = colorScheme === 'dark'
  ? { bg: '#1a1b1e', surface: '#25262b', border: 'rgba(255,255,255,0.08)', text: '#c1c2c5', textDim: '#909296', accent: '#2d6a4f' }
  : { bg: '#f8f5f0', surface: '#ffffff', border: 'rgba(23,27,36,0.08)', text: '#1a1e2b', textDim: '#667085', accent: '#2d6a4f' };
```

---

### How the Trust Layer Works (Implementation Detail)

**Edit history trigger** — `supabase/migrations/20260325070000_add_expense_update_trigger.sql`:
```sql
CREATE OR REPLACE FUNCTION fn_log_expense_update()
RETURNS TRIGGER AS $$
BEGIN
  -- Skip if only is_active changed (that's a soft delete, already logged)
  IF OLD.amount = NEW.amount AND OLD.title = NEW.title AND OLD.category = NEW.category
     AND OLD.description IS NOT DISTINCT FROM NEW.description
     AND OLD.due_date = NEW.due_date AND OLD.approval_status IS NOT DISTINCT FROM NEW.approval_status
  THEN RETURN NEW; END IF;

  INSERT INTO activity_log (group_id, user_id, action, entity_type, entity_id, metadata)
  VALUES (
    NEW.group_id,
    auth.uid(),
    'expense_updated',
    'expense',
    NEW.id,
    jsonb_build_object(
      'title', NEW.title,
      'changes', jsonb_build_object(
        'amount', CASE WHEN OLD.amount != NEW.amount THEN jsonb_build_object('old', OLD.amount, 'new', NEW.amount) ELSE NULL END,
        'title', CASE WHEN OLD.title != NEW.title THEN jsonb_build_object('old', OLD.title, 'new', NEW.title) ELSE NULL END,
        'category', CASE WHEN OLD.category != NEW.category THEN jsonb_build_object('old', OLD.category, 'new', NEW.category) ELSE NULL END,
        'due_date', CASE WHEN OLD.due_date != NEW.due_date THEN jsonb_build_object('old', OLD.due_date, 'new', NEW.due_date) ELSE NULL END
      )
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_log_expense_update
  AFTER UPDATE ON expenses
  FOR EACH ROW EXECUTE FUNCTION fn_log_expense_update();
```

**Expense flagging** — `supabase/migrations/20260325080000_add_expense_flagging.sql`:
```sql
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS flagged_by uuid[] DEFAULT '{}';
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS flagged_reason text;
```

**Flag API** — `packages/api/src/expenses.ts`:
- `flagExpense(expenseId, reason)` — appends user ID to `flagged_by` array, sets `flagged_reason`
- `unflagExpense(expenseId)` — clears both fields

**Flag UI** — `apps/web/src/routes/_app/expenses/$expenseId.lazy.tsx`:
- Non-admin members see "Query this expense" button (orange, IconFlag)
- Opens modal with TextInput for reason + "Submit query" button
- When flagged: orange Alert banner shows "Queried by [name] — [reason]"
- Admins see "Dismiss" button inside the banner

**Approval visibility** — Same file:
- Green alert: "Approved by [Name] on [Date]" (all group types, not just workspace)
- Red alert: "Rejected by [Name] on [Date]"
- Names resolved from `group.members` using `approved_by` user ID

---

### How Smart Nudges Work (Implementation Detail)

**Before fix:** `packages/api/src/smart-nudges.ts` line 93 had `transactions: []` — empty array, so settlement-based nudges never fired.

**After fix:** The function now calls `getGroupSettlement(groupId)` for each group and passes real transaction data:

```typescript
// For each group, get REAL settlement data
for (const group of groups) {
  try {
    const settlement = await getGroupSettlement(group.id);
    settlements.push({
      groupId: group.id,
      groupName: group.name,
      transactions: settlement.transactions.map(t => ({
        fromUserId: t.fromUserId,
        toUserId: t.toUserId,
        amount: t.amount,
        currency: settlement.currency ?? group.currency,
      })),
    });
  } catch {
    // Skip groups where settlement fails
  }
}
```

**Nudge generation** in `packages/core/src/smart-nudges.ts`:
- Iterates settlement transactions
- If user owes someone (`fromUserId === userId`): generates `unsettled_purchases` nudge
- If someone owes user (`toUserId === userId`): generates `others_pending` nudge
- Checks budget data for `budget_warning` nudges
- Compares month-over-month spending for `spending_spike` nudges

---

### How Receipt OCR Works (Implementation Detail)

**Edge function:** `supabase/functions/parse-receipt/index.ts`

```typescript
// 1. Auth check (manual, function deployed with --no-verify-jwt)
const userClient = createClient(supabaseUrl, anonKey, {
  global: { headers: { Authorization: authHeader } },
});
const { data: { user } } = await userClient.auth.getUser();

// 2. Scan limit check
const { data: sub } = await supabase
  .from('subscriptions')
  .select('plan, receipt_scan_count, receipt_scan_reset_at')
  .eq('user_id', user.id)
  .single();

// Reset monthly counter if needed
const now = new Date();
const resetAt = sub?.receipt_scan_reset_at ? new Date(sub.receipt_scan_reset_at) : null;
if (!resetAt || resetAt.getMonth() !== now.getMonth()) {
  await supabase.from('subscriptions').update({
    receipt_scan_count: 0,
    receipt_scan_reset_at: now.toISOString(),
  }).eq('user_id', user.id);
}

// Check limit: standard=10, pro=50, agency=unlimited
const limits = { standard: 10, pro: 50, agency: Infinity };
const limit = limits[sub.plan] ?? 10;
if ((sub.receipt_scan_count ?? 0) >= limit) {
  return error('Monthly scan limit reached. Upgrade your plan for more scans.');
}

// 3. Call Gemini Flash
const geminiResp = await fetch(
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [
          { inlineData: { mimeType: mime_type, data: image_base64 } },
          { text: 'Extract from this receipt: total amount (number only), vendor/store name, date (YYYY-MM-DD), currency code (e.g. GBP, USD, EUR), and line items (array of {name, amount}). Return ONLY valid JSON.' }
        ]
      }]
    }),
  }
);

// 4. Parse response, increment counter, return structured data
```

**Client-side call** (`apps/web/src/routes/_app/expenses/new.lazy.tsx`):
```typescript
const { supabase } = await import('@commune/api');
const { data, error } = await supabase.functions.invoke('parse-receipt', {
  body: { image_base64: base64, mime_type: receiptFile.type },
});
// data = { amount, vendor, date, currency, line_items }
// Pre-fill form fields
```

---

### How the Activity Page 2-Column Layout Works

**File:** `apps/web/src/routes/_app/activity.lazy.tsx`

Uses Mantine `Grid` (not `SimpleGrid`) for unequal columns:
```tsx
<Grid gap="lg">
  {/* Left — context sidebar (1/3) */}
  <Grid.Col span={{ base: 12, md: 4 }}>
    <Stack gap="lg">
      {/* Quick stats: total events, most active member */}
      {/* Filter chips: by type (expenses, payments, chores, approvals) */}
      {/* Pending items: things waiting on you */}
      {/* Members list: who's in this group */}
    </Stack>
  </Grid.Col>

  {/* Right — activity feed (2/3) */}
  <Grid.Col span={{ base: 12, md: 8 }}>
    <Stack gap="lg">
      {/* Timeline of events with avatars, descriptions, timestamps */}
      {/* Pagination */}
    </Stack>
  </Grid.Col>
</Grid>
```

On mobile (base), both columns stack full-width. On desktop (md+), sidebar is 4/12 and feed is 8/12.

---

### How the Group Hub Page Works

**Route:** `apps/web/src/routes/_app/groups/$groupId/index.lazy.tsx`
**Hook:** `useGroupHub(groupId)` → calls `getGroupHub(groupId)` from `@commune/api`

**API returns:** Group details + members + this month's expense summary (per-member totals, category totals, monthly total)

**Page sections (top to bottom):**
1. **Cover photo hero** — Full-width cover (or gradient fallback by group type), overlaid avatar + name + tagline + type badge + member count + health badge
2. **Pinned announcement** — Orange-bordered banner if `group.pinned_message` exists
3. **House essentials** — Wi-Fi, bins, landlord, emergency (from `group.house_info` JSONB)
4. **Key stats** — 3 cards: total monthly spend, active members, active expenses
5. **Your position** — Settlement status card: "You owe £X" or "You're owed £X" or "All squared away"
6. **Recent activity** — Last 5 activity log entries with avatars and relative timestamps
7. **Members** — Grid of member cards with avatars, roles, monthly shares, settlement badges
8. **Monthly breakdown** — Category-by-category with progress bars and per-person splits
9. **Quick actions** — "View Dashboard" / "Add Expense" / "Settle Up" buttons

**Health badge logic:**
- Settlement has no transactions → "All settled" (green)
- Has overdue expenses → "Bills overdue" (red)
- Has outstanding settlements → "Payments pending" (amber)
- Otherwise → "On track" (blue)

---

### How Payment Provider URLs Are Constructed

**File:** `packages/api/src/payment-methods.ts` (or inline in settlement components)

```typescript
function buildPaymentUrl(provider: string, value: string): string | null {
  switch (provider) {
    case 'revolut': return `https://revolut.me/${value}`;
    case 'monzo': return `https://monzo.me/${value}`;
    case 'paypal': return `https://paypal.me/${value}`;
    case 'wise': return `https://wise.com/pay/${value}`;
    case 'starling': return `https://settleup.starlingbank.com/${value}`;
    case 'venmo': return `https://venmo.com/${value}`;
    case 'cashapp': return `https://cash.app/$${value}`;
    case 'bank_transfer': return null; // Display only
    default: return null;
  }
}
```

**Important fix:** PayPal was previously building `paypal.com/paypalme/PayPal.me/username` — now correctly builds `paypal.me/username`.

---

### How Soft Delete / Account Deletion Works

**Migration:** Adds `deletion_requested_at` and `deletion_scheduled_for` to users table.

**Flow:**
1. User clicks "Delete account" in Settings
2. `soft_delete_account` RPC sets `deletion_requested_at = NOW()` and `deletion_scheduled_for = NOW() + 14 days`
3. User sees "Account scheduled for deletion on [date]" banner
4. If user logs back in within 14 days: `deletion_requested_at` is cleared, account reactivates
5. After 14 days: cron job (or manual process) hard deletes or anonymises the data

**Why 14 days:** Legal best practice. Allows recovery from accidental deletion. Gives time for any outstanding financial disputes.

---

### Grid Philosophy (Design Rule)

| Content Type | Grid | Example |
|-------------|------|---------|
| Data/content cards | `cols={{ base: 1, sm: 2 }}` | Member cards, fund cards, chore cards, stat cards |
| Pricing plans | `cols={{ base: 1, sm: 2, md: 3 }}` | 3 plans = 3 columns |
| Group cards | `cols={{ base: 1, sm: 2, md: 3 }}` | Multiple groups listing |
| Small action chips | 3-col fine | Quick actions on hub |
| Unequal layout | `Grid` with `span` | Activity: 4/12 sidebar + 8/12 feed |

**Never more than 3 columns on any page.** The app should feel calm, not busy.

---

### Button Placement Convention

**Primary actions go in `PageHeader` (top-right), not at the bottom of forms.**

```tsx
<PageHeader title="Members" subtitle="4 active members">
  {isAdmin && (
    <Group gap="sm">
      <Button variant="subtle" color="red" onClick={openLeave}>Leave</Button>
      <Button variant="light" component={Link} to={`/groups/${groupId}/edit`}>Settings</Button>
      <Button onClick={openInvite}>Invite member</Button>
    </Group>
  )}
</PageHeader>
```

**Order:** Destructive (left, subtle/outline) → Secondary (middle, light) → Primary (right, filled)
