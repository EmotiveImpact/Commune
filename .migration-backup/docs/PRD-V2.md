# Commune — Product Requirements Document

**Version:** 2.0
**Date:** 2026-03-22
**Platform:** Web first (Vite + React), Mobile second (Expo)
**Previous:** [PRD V1.1](./PRD.md) — covers Phases 1-7, features F1-F19

---

## Table of Contents

1. [Product Overview](#product-overview)
2. [Competitive Landscape](#competitive-landscape)
3. [Market Opportunity](#market-opportunity)
4. [Pricing & Tier Strategy (Revised)](#pricing--tier-strategy-revised)
5. [Group Types & Multi-Market Positioning](#group-types--multi-market-positioning)
6. [V1 Status — What's Built](#v1-status--whats-built)
7. [V2 Feature Requirements — Stage 1](#v2-feature-requirements--stage-1)
8. [V2 Feature Requirements — Stage 2](#v2-feature-requirements--stage-2)
9. [V2 Feature Requirements — Stage 3](#v2-feature-requirements--stage-3)
10. [V2 Feature Requirements — Stage 4](#v2-feature-requirements--stage-4)
11. [Need a Decision — Items 17-29](#need-a-decision--items-17-29)
12. [Updated Data Model Changes](#updated-data-model-changes)
13. [Edge Cases (V2 Additions)](#edge-cases-v2-additions)

---

## Product Overview

Commune is a shared expense and communal money management platform for groups of people who live, work, build, travel, or organise together. It serves **six distinct markets** through a single product with group-type-aware features.

See [VISION.md](./VISION.md) for full product vision, positioning, and philosophy.
See [PRD V1.1](./PRD.md) for the complete V1 data model, feature specs (F1-F19), split logic, screen specs, and phased build plan.

---

## Competitive Landscape

*Research conducted March 2026 across Trustpilot, G2, Capterra, Reddit, Product Hunt, and app store reviews.*

### Direct Competitors

| App | Rating (Trustpilot) | Pricing | Key Weakness |
|-----|-------------------|---------|-------------|
| **Splitwise** | 1.8/5 (65% 1-star) | Free (capped at 3-5 expenses/day) / Pro £4.99/mo | Aggressive monetisation, daily caps, 10-sec countdown ads, paywalled search |
| **Tricount** | 3.5/5 | Free (acquired by bunq) | Destabilised by acquisition — data loss, removed web version, sync bugs |
| **Settle Up** | 4+/5 | Free (ads) / Premium ~£0.99/mo | Unreliable sync ("1 in 50 attempts works"), invasive ads |
| **Splid** | 4+/5 | Free / One-time £4.99 | Extremely basic, no receipt scanning, no ongoing use |
| **Cino** | N/A | Per-transaction fees | EU-only, per-transaction model |

### Adjacent Tools (Not Direct Competitors)

| Tool | What It Does | Why It's Not a Threat |
|------|-------------|----------------------|
| **Billr / Tab** | Restaurant bill splitting (photo → item assignment) | Single-meal only, no ongoing tracking |
| **Cospend / IHateMoney** | Self-hosted open-source expense sharing | Requires Nextcloud/technical setup, not consumer-grade |
| **Monzo Split / Revolut** | Expense splitting within banking apps | Feature-within-a-bank, lacks depth, ecosystem-locked |
| **YNAB / Monarch** | Personal/couple budgeting | Individual budgeting, no "who owes whom" |

### Key Market Data

- Bill splitting apps market: **$612M (2025)**, 7.3% CAGR
- Expense management software: **$7.7B (2025)** → $13.8B (2031), 10.1% CAGR
- Co-living market: **$7.7-8.3B (2024)** → **$16B+ (2030)**, 13.5% CAGR
- Splitwise: ~31M downloads, ~$6.6M annual revenue (~$0.21/download — deep monetisation problems)
- 85+ million U.S. adults used a bill splitting app in 2024
- 50% of Gen Z/millennial travellers had money-related disagreements on trips; 20% lost a friendship

---

## Market Opportunity

### What Nobody Has Built

1. **Resident-facing communal living tools** — Co-living software (ColivHQ, Bidrento) serves landlords, not residents
2. **Group-type-aware expense management** — Every competitor is generic "split a bill"; nobody adapts to context
3. **All-in-one household platform** — Users cobble together 3-4 apps (Splitwise + OurHome + shopping lists + WhatsApp)
4. **Integrated settlement** — Most apps track debts but don't facilitate payment
5. **Couples as a financial unit within groups** — 501-vote Splitwise feature request, open since 2016, never built

### Commune's Existing Advantages Over All Competitors

- Recurring expenses as a core feature (not paywalled)
- Rich analytics dashboard with charts
- Bulk mark-as-paid payment tracking
- Monthly PDF statements
- Activity log with CSV export
- Web push notifications with bell badge
- Member monthly totals
- Free invited members (only leader pays)
- Six group types serving six markets
- Google OAuth (one-tap sign-in reduces friction)
- Token-based invite system (link-based, no app download needed)

---

## Pricing & Tier Strategy (Revised)

### Subscription Model

- **Billing entity:** Per-user (the group leader/creator pays)
- **Invited members:** Free — full participation in groups they're invited to, cannot create own groups
- **Trial:** 7-day free Pro trial for new signups

### Tier Comparison

| | Standard (£4.99/mo) | Pro (£9.99/mo) | Agency (£29.99/mo) |
|--|---------------------|----------------|-------------------|
| **Groups** | 1 | 5 | Unlimited |
| **Members per group** | 8 | 15 | Unlimited |
| **Core features** | Expenses, splits, recurring, breakdown, activity log, push notifications, payment links, multi-currency | Everything in Standard | Everything in Pro |
| **Settlement** | Smart settlement (min transactions) | Smart settlement | Smart settlement |
| **Templates** | Auto-split templates | Auto-split templates | Auto-split templates |
| **Analytics** | — | Spending charts, category breakdowns, trends | Analytics |
| **Exports** | — | CSV export, PDF monthly statements | Exports |
| **Smart features** | — | Receipt OCR, item-level splitting, Splitwise import | Smart features |
| **Billing options** | Monthly only | Monthly + annual (save 20%) | Monthly + annual |
| **Community tools** | — | — | Group fund/pot, member proration, cross-group reporting |
| **Integration** | — | — | Open Banking (future), API access (future) |
| **Support** | Standard | Standard | Priority |
| **Dark mode** | Yes | Yes | Yes |

### Pricing Changes from V1

| Change | V1 | V2 | Rationale |
|--------|----|----|-----------|
| Standard members | 5 | **8** | Real shared houses are 6-7 people |
| Pro groups | 3 | **5** | Life spans more than 3 contexts (home + trip + couple + work + project) |
| Analytics | All tiers | **Pro+** | Creates genuine feature differentiation between tiers |
| CSV/PDF export | All tiers | **Pro+** | Power user feature, justifies upgrade |
| Annual billing | Planned but not built | **Pro+ only** | Gives Pro a pricing advantage over Standard |

### Special Pricing (V2 Addition)

| Option | Price | Duration | Target |
|--------|-------|----------|--------|
| **Trip Pass** | £2.99 | 14 days | Casual travellers who won't commit to monthly |

---

## Group Types & Multi-Market Positioning

Commune serves six markets through one product. The group type selected at creation determines which features are surfaced prominently in the UI.

### Group Type Matrix

| Group Type | Primary Users | Key Needs | Priority Features |
|-----------|--------------|-----------|-------------------|
| **Home** | Roommates, shared houses, co-living | Recurring bills, proration, house fund, accountability | Auto-split templates, member proration, group fund, nudge reminders |
| **Couple** | Partners | Shared budgeting, "who paid what", linked finances | Couple linking (future), spending insights, simplified settlement |
| **Workspace** | Coworking, shared offices, teams | Office supply splits, shared lease, equipment costs | Receipt OCR, auto-split templates, exports |
| **Project** | Freelancers, event organisers, committees | Budget tracking, milestone expenses, contributor tracking | Group fund, budget tracking, CSV export |
| **Trip** | Travel groups, holidays | Multi-currency, quick entry, receipt scanning, per-day splitting | Receipt OCR, item-level splitting, multi-currency, offline mode |
| **Other** | Clubs, sports teams, friend groups | Flexible, general-purpose | All features available, none emphasised |

### Group-Type-Aware UI Behaviour (Stage 3)

When a user creates a group, the selected type should influence:
- Which features are surfaced in the sidebar or quick-actions
- Default settings (e.g., Trip groups default to multi-currency prominence)
- Onboarding hints and empty states
- Feature discovery prompts ("Did you know you can set auto-split rules for rent?")

---

## V1 Status — What's Built

| Feature | Status | Notes |
|---------|--------|-------|
| Google OAuth | ✅ Built | Full sign-in flow |
| Multi-currency | ✅ Built | Group + expense level |
| Push notifications | ✅ Built | Web Push API + service worker |
| Mobile app (Expo) | ✅ Built | Core screens, needs polish |
| CSV/PDF export | ✅ Built | Expenses + activity log |
| Group analytics/charts | ✅ Built | Recharts — pie, bar, line |
| Monthly statements | ✅ Built | PDF generation edge function |
| Activity log | ✅ Built | Full tracking + CSV export |
| Payment provider links | ✅ Built | Revolut, Monzo, PayPal, bank transfer |
| Invite landing page | ✅ Built | Token validation + accept flow |
| Couple group type | ✅ UI label | No special couple logic yet |
| Receipt upload | ⚠️ Partial | File upload works, no OCR parsing |
| PWA/offline | ⚠️ Partial | Navigation cache only, no offline writes |
| In-app settlement | ⚠️ Partial | Payment links only, no direct payments |
| Dark mode | ❌ Not built | Light theme only |
| Smart settlement | ❌ Not built | No debt simplification algorithm |
| Splitwise import | ❌ Not built | No import tools |
| Item-level splitting | ❌ Not built | Whole-expense splits only |
| Auto-split templates | ❌ Not built | Manual config per expense |
| Move-in/out proration | ❌ Not built | No proration logic |
| House fund / pot | ❌ Not built | IOU tracking only |
| Annual billing | ❌ Not built | Monthly billing only |
| Open Banking | ❌ Not built | Manual entry only |

---

## V2 Feature Requirements — Stage 1

*Theme: Strengthen the foundation — universal improvements that benefit every group type.*

### F20: Dark Mode

**Description:** System-wide dark theme with manual toggle and system preference detection.

**Requirements:**
- F20.1: Dark colour scheme using Mantine's `colorScheme` system
- F20.2: Toggle in settings page (Light / Dark / System)
- F20.3: Persist preference in localStorage
- F20.4: Respect `prefers-color-scheme` when set to System
- F20.5: All custom CSS classes (commune-soft-panel, commune-stat-card, etc.) support dark variants
- F20.6: Mobile app dark mode via NativeWind/system theme

**Tier:** All tiers

### F21: Smart Settlement (Minimum Transactions Algorithm)

**Description:** Optimise group debts into the minimum number of transactions needed to settle all balances.

**Requirements:**
- F21.1: Algorithm in `packages/core/src/settlement.ts`
- F21.2: Input: all expense participants and payment records for a group
- F21.3: Output: simplified list of "Person A pays Person B £X" with minimum transaction count
- F21.4: Uses net-balance approach: calculate each member's net position, then greedily match largest creditor with largest debtor
- F21.5: Settlement view accessible from group dashboard or breakdown page
- F21.6: Shows both "raw debts" and "simplified settlement" views
- F21.7: Integrates with payment provider links (tap a settlement → opens Revolut/Monzo/PayPal with pre-filled amount)
- F21.8: Works across all group types

**Tier:** All tiers (Standard+)

### F22: Auto-Split Templates

**Description:** Saved split configurations that can be applied to new expenses without manual setup each time.

**Requirements:**
- F22.1: New `split_templates` table: id, group_id, name, split_method, participants (jsonb), created_by, created_at
- F22.2: Create template from an existing expense ("Save this split as template")
- F22.3: Create template manually (name, select members, set split method + shares)
- F22.4: Apply template when creating new expense (auto-fills participants + split config)
- F22.5: Edit and delete templates
- F22.6: Templates are group-scoped (each group has its own templates)
- F22.7: Suggested templates based on group type (e.g., Home groups prompted to create "Rent" template)
- F22.8: RLS: only active group members can read/write templates for their groups

**Tier:** All tiers (Standard+)

### F23: Annual Billing

**Description:** Annual subscription option at a 20% discount for Pro and Agency tiers.

**Requirements:**
- F23.1: New Stripe prices for annual billing (Pro: £95.88/yr, Agency: £287.88/yr)
- F23.2: Toggle on pricing page between monthly and annual
- F23.3: Annual pricing displayed as "£X/mo billed annually" with savings badge
- F23.4: Stripe Checkout supports both billing intervals
- F23.5: Webhook handles annual subscription events
- F23.6: Settings page shows billing interval and next renewal date
- F23.7: Upgrade from monthly to annual allowed (prorated via Stripe)

**Tier:** Pro and Agency only (Standard remains monthly only)

### F24: Standard Plan Member Limit Increase

**Description:** Increase Standard plan member limit from 5 to 8.

**Requirements:**
- F24.1: Update `fn_check_member_limit()` trigger: standard plan allows 8 members per group
- F24.2: Update `PLAN_LIMITS` in `use-plan-limits.ts`: standard members = 8
- F24.3: Update pricing page copy
- F24.4: Update VISION.md pricing table

**Tier:** Standard

### F25: Draft Saving for Expense Entry

**Description:** Persist in-progress expense form data so switching apps or accidentally navigating away doesn't lose input.

**Requirements:**
- F25.1: Auto-save expense form state to localStorage on every field change
- F25.2: On expense form mount, check for saved draft and offer to restore
- F25.3: Clear draft on successful expense submission
- F25.4: Draft is group-scoped (one draft per group)
- F25.5: "Discard draft" option in restore prompt
- F25.6: Mobile app: same behaviour using AsyncStorage

**Tier:** All tiers

---

## V2 Feature Requirements — Stage 2

*Theme: Differentiate Pro tier — advanced tools, migration, and growth features.*

### F26: Receipt OCR (AI Parsing)

**Description:** Upgrade existing receipt upload to automatically extract expense data (amount, merchant, date, line items) from receipt photos.

**Requirements:**
- F26.1: Edge function `parse-receipt` accepts image, returns structured data
- F26.2: Uses AI vision model (Claude or GPT-4V) to extract: total amount, merchant name, date, currency, line items (if itemised)
- F26.3: Expense creation form: "Scan Receipt" button opens camera/file picker
- F26.4: After scan, auto-fills: title (merchant), amount (total), date, category (best guess)
- F26.5: User can review and adjust all auto-filled fields before submitting
- F26.6: If itemised receipt detected, offer item-level splitting flow (F27)
- F26.7: Store original receipt image as attachment (existing receipt_url flow)
- F26.8: Rate limit: 20 scans per user per day
- F26.9: Mobile app: native camera integration via Expo ImagePicker

**Tier:** Pro and Agency

### F27: Item-Level Splitting

**Description:** Split a single expense by individual line items, assigning specific items to specific people.

**Requirements:**
- F27.1: New `expense_line_items` table: id, expense_id, description, amount, quantity, created_at
- F27.2: New `line_item_assignments` table: id, line_item_id, user_id, quantity_share, amount_share
- F27.3: "Split by items" tab alongside equal/percentage/custom in expense form
- F27.4: UI: list items, tap to assign to participants (multi-select per item)
- F27.5: Handle shared items (e.g., shared starter split equally among assignees)
- F27.6: Auto-calculate tax/tip/service charge proportionally across assigned items
- F27.7: Validate: sum of all item assignments = expense total
- F27.8: Integrates with receipt OCR (F26) — scanned items pre-populate the list
- F27.9: Expense detail view shows item-level breakdown

**Tier:** Pro and Agency

### F28: Splitwise Import Wizard

**Description:** Import expense history from Splitwise CSV export.

**Requirements:**
- F28.1: Import page accessible from settings or onboarding
- F28.2: Accept Splitwise CSV export format (standard export columns)
- F28.3: Parse: date, description, category, cost, currency, participants, shares
- F28.4: Map Splitwise participants to Commune group members (by email or manual mapping)
- F28.5: Preview import with conflict detection before committing
- F28.6: Option to mark imported expenses as "historical" (no payment tracking)
- F28.7: Import creates expenses + expense_participants, skips payment_records for historical data
- F28.8: Handle multi-currency imports
- F28.9: Progress indicator for large imports
- F28.10: Maximum import size: 5000 expenses

**Tier:** Pro and Agency

### F29: Tier-Gated Features

**Description:** Move analytics, exports, and statements behind Pro tier gate.

**Requirements:**
- F29.1: Analytics page (`/analytics`): Standard users see teaser with upgrade prompt, Pro+ see full charts
- F29.2: CSV export buttons: Standard users see disabled button with "Pro feature" tooltip
- F29.3: PDF statement download: Standard users see upgrade prompt
- F29.4: `usePlanLimits()` hook extended with `canAccessAnalytics`, `canExport`, `canDownloadStatements`
- F29.5: Graceful degradation — never hide the navigation item, show the page with upgrade CTA
- F29.6: Mobile app: same gating logic

**Tier:** Gating mechanism (moves features to Pro+)

### F30: Trip Pass Pricing

**Description:** A 14-day one-time purchase for casual travellers.

**Requirements:**
- F30.1: New subscription plan type: `trip_pass`
- F30.2: Price: £2.99, duration: 14 days, non-renewable
- F30.3: Trip pass grants Pro-level features for the duration
- F30.4: Available from pricing page with "Planning a trip?" positioning
- F30.5: Stripe Checkout with `mode: 'payment'` (one-time, not subscription)
- F30.6: On purchase, create subscription row with `plan: 'trip_pass'`, `status: 'active'`, `current_period_end: now() + 14 days`
- F30.7: After expiry, user reverts to Standard (or free if invited member)
- F30.8: One trip pass active at a time; can purchase another after expiry

**Tier:** One-time purchase, grants Pro features for 14 days

### F31: Offline Expense Entry (PWA Enhancement)

**Description:** Allow users to create expenses while offline, syncing when connectivity returns.

**Requirements:**
- F31.1: Service worker intercepts expense creation requests when offline
- F31.2: Store pending expenses in IndexedDB
- F31.3: Visual indicator: "You're offline — expenses will sync when you're back"
- F31.4: On reconnection, POST pending expenses to Supabase
- F31.5: Conflict resolution: if expense creation fails on sync, show error with retry option
- F31.6: Offline mode shows cached group data (members, recent expenses) as read-only
- F31.7: Mobile app: same behaviour via React Native offline storage

**Tier:** All tiers (critical for Trip groups)

### F32: Payment Nudge Reminders

**Description:** Automated reminders for overdue payments.

**Requirements:**
- F32.1: "Nudge" button on breakdown/settlement view next to unpaid members
- F32.2: Sends push notification to the owing member: "Hey, you've owed £X for Y days"
- F32.3: Auto-nudge option: configurable per group (off / after 3 days / after 7 days / after 14 days)
- F32.4: Rate limit: maximum 1 nudge per debt per 3 days
- F32.5: Nudge history visible to admins
- F32.6: Group setting: "Allow nudge reminders" toggle (on by default)
- F32.7: Email nudge in addition to push notification

**Tier:** All tiers

---

## V2 Feature Requirements — Stage 3

*Theme: Depth, group intelligence, and market-specific features.*

### F33: Group Fund / Shared Pot

**Description:** A communal fund that members contribute to monthly for shared purchases.

**Requirements:**
- F33.1: New `group_funds` table: id, group_id, name, target_amount, current_balance, currency, created_by, created_at
- F33.2: New `fund_contributions` table: id, fund_id, user_id, amount, contributed_at, note
- F33.3: New `fund_expenses` table: id, fund_id, description, amount, spent_by, spent_at, receipt_url
- F33.4: Create fund with name and optional monthly target (e.g., "House supplies — £50/mo")
- F33.5: Members contribute to the fund (track who contributed how much)
- F33.6: Expenses paid from the fund (track what was bought and by whom)
- F33.7: Fund balance = sum(contributions) - sum(fund_expenses)
- F33.8: Dashboard widget showing fund balance and recent activity
- F33.9: Monthly contribution tracking: who has contributed this month, who hasn't
- F33.10: RLS: only active group members can access fund data

**Tier:** Agency (future: consider Pro)

**Primary group types:** Home, Project, Trip

### F34: Member Proration (Join/Leave Mid-Cycle)

**Description:** Automatically prorate recurring expenses when members join or leave a group mid-billing-cycle.

**Requirements:**
- F34.1: Track `effective_from` and `effective_until` dates on group_members
- F34.2: When a member joins mid-month, recurring expenses auto-prorate their share based on remaining days
- F34.3: When a member leaves mid-month, their share is prorated based on days present
- F34.4: Proration calculation: `(member_share * days_present) / total_days_in_period`
- F34.5: Other members' shares adjust to absorb the prorated difference
- F34.6: Proration is visible in breakdown: "Prorated: 15/30 days"
- F34.7: Admin can override proration (force full share or custom amount)
- F34.8: Historical proration preserved for audit

**Tier:** Agency

**Primary group types:** Home, Workspace, Project

### F35: Group Budget Tracking

**Description:** Groups can set a monthly spending budget and track actual spending against it.

**Requirements:**
- F35.1: New `group_budgets` table: id, group_id, month, budget_amount, currency, created_by
- F35.2: Set monthly budget from group settings
- F35.3: Dashboard widget: budget bar showing spent vs. budget with percentage
- F35.4: Warning when approaching budget (80% threshold)
- F35.5: Alert when budget exceeded
- F35.6: Budget history by month
- F35.7: Category-level budgets (optional): set limits per category (e.g., groceries £200, utilities £150)

**Tier:** Pro and Agency

**Primary group types:** Home, Project, Trip

### F36: Group-Type-Aware UI

**Description:** Contextual UI that surfaces relevant features based on the selected group type.

**Requirements:**
- F36.1: Dashboard quick-actions vary by group type:
  - Home: "Add recurring bill", "View settlement", "Set auto-split"
  - Trip: "Scan receipt", "Quick expense", "View settlement"
  - Couple: "Add expense", "View balance", "Spending insights"
  - Workspace: "Add shared cost", "Scan receipt", "Export"
  - Project: "Add expense", "View budget", "Export"
- F36.2: Empty states include group-type-specific copy and suggestions
- F36.3: Feature discovery prompts based on group type (e.g., Home → "Set up auto-split for rent")
- F36.4: Default expense categories ordered by relevance to group type
- F36.5: Onboarding flow adapts to group type (e.g., Trip → multi-currency setup prompt)

**Tier:** All tiers

### F37: Cross-Group Debt Netting

**Description:** If a user is in multiple groups and owes/is owed by the same person across groups, net the amounts.

**Requirements:**
- F37.1: Cross-group settlement view accessible from user's top-level dashboard
- F37.2: Algorithm: aggregate net balances per person-pair across all groups
- F37.3: Display: "Across all groups, you owe Person A £X" or "Person B owes you £Y"
- F37.4: Opt-in: users must enable cross-group netting in settings
- F37.5: Does not modify group-level data; display-only aggregation
- F37.6: Payment links work from cross-group view

**Tier:** Pro and Agency

### F38: Couple Mode (Linked Members)

**Description:** Two members can be linked as a financial unit within a group, consolidating their debts and contributions.

**Requirements:**
- F38.1: "Link as couple" action in group member management (admin or self-service)
- F38.2: Linked members' net balances are combined for settlement purposes
- F38.3: In settlement view, couple appears as one unit: "John & Jane owe £X"
- F38.4: Individual expense tracking preserved — linking only affects settlement calculation
- F38.5: Unlinking restores individual settlement
- F38.6: Works with smart settlement algorithm (F21)
- F38.7: Couple group type auto-links the two members

**Tier:** All tiers (Standard+)

**Primary group types:** Couple (automatic), any group (manual linking)

---

## V2 Feature Requirements — Stage 4

*Theme: Infrastructure bets and platform expansion.*

### F39: Open Banking / Transaction Import

**Description:** Connect bank accounts to auto-detect and import shared expenses.

**Requirements:**
- F39.1: Integration with Plaid (US/global) or TrueLayer/GoCardless (UK/EU)
- F39.2: User connects bank account in settings (OAuth flow)
- F39.3: Daily transaction sync (or on-demand)
- F39.4: AI categorisation of transactions as potential shared expenses
- F39.5: "Review & import" flow: user confirms which transactions to add as group expenses
- F39.6: Auto-match recurring transactions to existing recurring expenses
- F39.7: Privacy: bank data is only used for expense detection, never stored raw
- F39.8: Disconnect bank account at any time, all sync data deleted

**Tier:** Agency

### F40: In-App Payment Settlement

**Description:** Actually transfer money between group members within Commune.

**Requirements:**
- F40.1: Stripe Connect integration for peer-to-peer transfers
- F40.2: Users onboard to Stripe Connect (KYC verification)
- F40.3: "Pay now" button on settlement view initiates transfer
- F40.4: Automatic payment record creation on successful transfer
- F40.5: Transaction fees transparent to users
- F40.6: Fallback to payment links for users who haven't onboarded to Stripe Connect

**Tier:** Pro and Agency

### F41: Chore Rotation (Home Groups)

**Description:** Household chore management with rotation scheduling.

**Requirements:**
- F41.1: New `chores` table: id, group_id, name, frequency, assigned_to, next_due, created_by
- F41.2: Create chores with name and frequency (daily, weekly, biweekly, monthly)
- F41.3: Auto-rotate assignment among group members
- F41.4: "Done" button marks chore as complete, advances to next assignee
- F41.5: Chore history and completion tracking
- F41.6: Nudge reminders for overdue chores
- F41.7: Chore view in sidebar navigation (Home groups only)

**Tier:** All tiers

**Primary group types:** Home

### F42: Shared Shopping Lists (Home Groups)

**Description:** Collaborative shopping lists for household items.

**Requirements:**
- F42.1: New `shopping_lists` table: id, group_id, name, created_by, created_at
- F42.2: New `shopping_items` table: id, list_id, name, quantity, added_by, checked, checked_by
- F42.3: Create, edit, delete shopping lists
- F42.4: Add/remove/check items in real-time
- F42.5: "Convert to expense" action: turn a completed shopping list into a group expense
- F42.6: Shopping list view in sidebar (Home groups primarily)

**Tier:** All tiers

**Primary group types:** Home

---

## Need a Decision — Items 17-29

*These items were identified during competitive research and market analysis. They require further discussion before being scheduled for implementation.*

### Item 17: Shared Shopping Lists — Scope Decision

**Question:** Should shopping lists be a standalone feature (F42) or integrated as part of a broader "household management" module alongside chores?

**Context:** Reddit users report using 3-4 separate apps. Building chores + shopping lists makes Commune an all-in-one platform but risks scope creep and diluting the core expense management value.

**Options:**
- A) Build as standalone features (F41 + F42 independently)
- B) Build as a "Household" module (combined feature)
- C) Defer entirely — stay focused on expense management only

### Item 18: Trip Pass Pricing (£2.99/14 days) — Validation Needed

**Question:** Is a one-time trip pass the right monetisation for casual travellers, or does it cannibalise monthly subscriptions?

**Context:** Reddit users want per-trip pricing. But if a group of 6 uses Commune for 2 weeks, only the creator buys the trip pass — the others are free invited members. Revenue per trip: £2.99 vs £9.99 for a monthly Pro sub.

**Options:**
- A) Launch trip pass as designed (£2.99/14 days)
- B) Higher price (£4.99/14 days) to reduce cannibalisation
- C) No trip pass — use 7-day free trial as the trip solution
- D) Trip pass grants Standard features only, not Pro

### Item 19: B2B2C Co-Living Operator Channel

**Question:** When and how should Commune approach co-living operators (Common, The Collective, Vonder) as a distribution channel?

**Context:** $16B+ co-living market by 2030. Operators manage hundreds of residents. If operators offer Commune to residents, that's a distribution channel. But it requires different pricing, onboarding, and possibly white-labelling.

**Decision needed:** Park until product-market fit is proven with direct users, or start conversations now?

### Item 20: Shared Budget Planning for Groups

**Question:** Should group budgets (F35) be a Pro feature or an Agency feature?

**Context:** Group budgets are useful across all group types (Home, Trip, Project). Making it Agency-only limits the audience. Making it Pro includes it in the tier most likely to benefit.

**Current placement:** Pro and Agency. Confirm or adjust.

### Item 21: Per-Group/Per-Household Pricing Model

**Question:** Should Commune ever switch from per-user to per-group pricing?

**Context:** The current model (leader pays, members free) is effectively per-group already. But the billing entity is the user, not the group. A true per-group model would mean the group has a subscription, not the person.

**Decision:** Current model works. Revisit only if churn data suggests otherwise. **No action needed.**

### Item 22: PWA / Offline Improvements — Priority Level

**Question:** How much should be invested in offline capability for the web app?

**Context:** Critical for Trip groups (no internet while travelling). Less important for Home/Workspace groups (always online). Currently partial (navigation cache only).

**Current placement:** Stage 2 (F31). Confirm priority.

### Item 23: Draft Saving — Verify If Needed

**Question:** Does Commune currently lose form data when switching apps?

**Context:** This is a top-5 Splitwise complaint. If Commune already preserves form state (via React state management), this is already solved. If not, it's a Stage 1 quick fix.

**Action:** Test current behaviour. If broken, implement F25. If working, remove from roadmap.

### Item 24: Voice/NLP Interface

**Question:** Should Commune support voice commands like "split last Uber with John"?

**Context:** Emerging trend in expense apps. Would differentiate significantly but is a major engineering effort (speech-to-text, NLP parsing, intent mapping).

**Decision:** Defer to Stage 5+. Not a near-term priority. **Parked.**

### Item 25: Crypto/Blockchain Settlement

**Question:** Should Commune support crypto settlement (e.g., USDC, Solana)?

**Context:** SPLITDO exists on Solana but is extremely niche. No mainstream adoption of crypto for group expense settlement.

**Decision:** Not a priority. **Parked indefinitely.**

### Item 26: Guest Access Without Account

**Question:** Is a no-account guest link needed given the existing invite system?

**Context:** Discussed extensively. The invite system already provides a link → sign up → free account flow. Google OAuth makes sign-up one tap. The remaining friction is minimal for a web app (no download required).

**Decision:** Not needed. Existing invite + free member system is sufficient. **Closed.**

### Item 27: Privacy / GDPR / Self-Hosting

**Question:** Should Commune offer a self-hosted version?

**Context:** European users value data sovereignty. Cospend/IHateMoney appeal to this niche. But self-hosting fragments the user base and is expensive to support.

**Decision:** Ensure GDPR compliance in the product (data export, account deletion — already built). Do not build self-hosting. **Closed — GDPR compliance only.**

### Item 28: Cross-Group Debt Netting

**Question:** Is cross-group netting a Pro feature or an Agency feature?

**Context:** Placed in Stage 3 as Pro+. Makes sense for anyone in multiple groups (which is a Pro user by definition, since Standard only gets 1 group).

**Current placement:** Pro and Agency (F37). Confirm.

### Item 29: Smart Notifications for Late Payers

**Question:** How aggressive should nudge reminders be by default?

**Context:** "Nudge" is emotionally charged. Too aggressive = feels like harassment. Too passive = debts go uncollected. The default setting matters.

**Current placement:** Stage 2 (F32). Default: off, user opts in per group.

**Recommendation:** Default to "gentle" (after 7 days, single reminder). Let admin configure aggressiveness.

---

## Updated Data Model Changes

### New Tables (V2)

```
split_templates (F22)
  id: uuid PK
  group_id: uuid FK → groups
  name: text NOT NULL
  split_method: split_method NOT NULL
  participants: jsonb NOT NULL  -- [{user_id, share_percentage?, share_amount?}]
  created_by: uuid FK → users
  created_at: timestamptz

expense_line_items (F27)
  id: uuid PK
  expense_id: uuid FK → expenses
  description: text NOT NULL
  amount: numeric(12,2) NOT NULL
  quantity: int NOT NULL DEFAULT 1
  created_at: timestamptz

line_item_assignments (F27)
  id: uuid PK
  line_item_id: uuid FK → expense_line_items
  user_id: uuid FK → users
  quantity_share: numeric(5,2) NOT NULL
  amount_share: numeric(12,2) NOT NULL
  UNIQUE(line_item_id, user_id)

group_funds (F33)
  id: uuid PK
  group_id: uuid FK → groups
  name: text NOT NULL
  target_amount: numeric(12,2) nullable
  currency: text NOT NULL
  created_by: uuid FK → users
  created_at: timestamptz

fund_contributions (F33)
  id: uuid PK
  fund_id: uuid FK → group_funds
  user_id: uuid FK → users
  amount: numeric(12,2) NOT NULL
  contributed_at: timestamptz NOT NULL DEFAULT now()
  note: text nullable

fund_expenses (F33)
  id: uuid PK
  fund_id: uuid FK → group_funds
  description: text NOT NULL
  amount: numeric(12,2) NOT NULL
  spent_by: uuid FK → users
  spent_at: timestamptz NOT NULL DEFAULT now()
  receipt_url: text nullable

group_budgets (F35)
  id: uuid PK
  group_id: uuid FK → groups
  month: date NOT NULL
  budget_amount: numeric(12,2) NOT NULL
  currency: text NOT NULL
  created_by: uuid FK → users
  UNIQUE(group_id, month)

chores (F41)
  id: uuid PK
  group_id: uuid FK → groups
  name: text NOT NULL
  frequency: text NOT NULL  -- daily, weekly, biweekly, monthly
  assigned_to: uuid FK → users
  next_due: date NOT NULL
  created_by: uuid FK → users
  created_at: timestamptz

shopping_lists (F42)
  id: uuid PK
  group_id: uuid FK → groups
  name: text NOT NULL
  created_by: uuid FK → users
  created_at: timestamptz

shopping_items (F42)
  id: uuid PK
  list_id: uuid FK → shopping_lists
  name: text NOT NULL
  quantity: int NOT NULL DEFAULT 1
  added_by: uuid FK → users
  checked: boolean NOT NULL DEFAULT false
  checked_by: uuid FK → users nullable
  created_at: timestamptz
```

### Modified Tables (V2)

```
group_members — additions:
  effective_from: date nullable  -- for proration (F34)
  effective_until: date nullable  -- for proration (F34)
  linked_partner_id: uuid FK → group_members nullable  -- for couple mode (F38)

subscriptions — additions:
  plan enum updated: 'free' | 'standard' | 'pro' | 'agency' | 'trip_pass'
  billing_interval: text DEFAULT 'month'  -- 'month' | 'year' | 'once'
```

---

## Edge Cases (V2 Additions)

### Smart settlement with partial payments
- If some debts are already partially paid, the algorithm accounts for remaining balances only
- Settled debts are excluded from the simplification

### Template applied but member has left
- If a split template references a member who has since left the group, that member is excluded and shares are recalculated among remaining participants
- User is warned: "Template adjusted — [name] is no longer in this group"

### Trip pass expires mid-use
- Expenses created during the trip pass remain accessible
- Pro features (analytics, OCR) become gated after expiry
- User can purchase another trip pass or upgrade to Pro

### Member proration edge cases
- Member joins on the 1st of the month: full share (no proration)
- Member joins on the last day: 1/30th (or 1/28th etc.) share
- Member leaves and rejoins same month: two proration periods calculated separately

### Receipt OCR fails or returns wrong data
- User always has manual override (all fields editable)
- "Scan failed" state shows manual entry form with helpful message
- No expense is created until user confirms the data

### Cross-group netting with different currencies
- Netting only applies to debts in the same currency
- Multi-currency debts are shown separately: "You owe John £20 and $15"

### Group fund goes negative
- Fund balance can go negative (overspending allowed)
- Negative balance shown clearly in UI: "Fund overdrawn by £X"
- Admin can request additional contributions

---

*End of PRD V2. For V1 features (F1-F19), data model, split logic specifications, screen specs, and original phased build plan, see [PRD V1.1](./PRD.md).*
