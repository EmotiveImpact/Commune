# Commune — Product Requirements Document

**Version:** 3.0
**Date:** 2026-03-23
**Platform:** Web first (Vite + React), Mobile second (Expo)
**Previous:** [PRD V2](./PRD-V2.md) — covers competitive research, V2 Stages 1-4, features F20-F42
**Original:** [PRD V1.1](./PRD.md) — covers Phases 1-7, features F1-F19

---

## Table of Contents

1. [What Changed in V3](#what-changed-in-v3)
2. [Hub System — The Core Product Shift](#hub-system--the-core-product-shift)
3. [V3 Feature Requirements — Stage 5 (Hub & Identity)](#v3-feature-requirements--stage-5-hub--identity)
4. [V3 Feature Requirements — Stage 6 (Intelligence & Trust)](#v3-feature-requirements--stage-6-intelligence--trust)
5. [V3 Feature Requirements — Stage 7 (Responsibilities & Social)](#v3-feature-requirements--stage-7-responsibilities--social)
6. [Implementation Status — All Features](#implementation-status--all-features)
7. [Quality Review Fixes (Applied)](#quality-review-fixes-applied)
8. [Remaining Work — Prioritised Backlog](#remaining-work--prioritised-backlog)
9. [Updated Data Model Changes (V3)](#updated-data-model-changes-v3)
10. [Architecture Decisions](#architecture-decisions)

---

## What Changed in V3

V3 represents a **fundamental shift** in how Commune works. The product moved from being a "shared expense tracker" to a **hub-based communal living operating system**.

### Key Shifts

| Aspect | V2 | V3 |
|--------|----|----|
| **Entry point** | Dashboard with expense list | Group Hub — personalised landing page per group |
| **Group identity** | Name + type badge | Cover photo, avatar, tagline, pinned messages, house info |
| **Cross-group** | Basic debt netting | Command Centre with priorities, status pills, action items |
| **Member view** | Table of names | Clickable member profiles with settlement status, shared groups, quick pay |
| **Trust** | Manual tracking | Expense approval flows with configurable thresholds |
| **Responsibility** | Money only | Chores/tasks with rotation, completion tracking, overdue detection |
| **House essentials** | Not addressed | Wi-Fi, bins, landlord, emergency contacts, house rules |
| **Payment methods** | One per user | Multiple payment methods per user |
| **Settings** | Single page | Split into Profile (personal) + Settings (app config) |

### Product Philosophy (from user research)

> "Each Commune should have a clean, high-impact overview page that works like a social or product landing page. The first viewport should answer five things without scrolling: What is this? Who is involved? What is happening financially? What do I need to know right now? Where do I tap next?"

> "The overview page should be the hook. Then every section should open a deeper, more detailed page."

> "This product structure gives Commune a real product identity beyond expense splitting."

---

## Hub System — The Core Product Shift

### Concept

Each user has their own account, then they can create or join multiple **Commune Hubs**. Each hub is a distinct space with its own identity, members, finances, and settings.

### User Flow

```
Account level
  └── Multiple hubs
        └── Hub: Free Vicarage
              ├── Overview (hub landing page — the "hook")
              ├── Money (expenses, recurring, templates, funds)
              ├── People (members, profiles, settlement)
              ├── Activity (feed, history)
              ├── Chores (tasks, rotation)
              └── Settings (admin only)
```

### Hub Landing Page Structure

The first screen when entering a hub. Answers the five key questions instantly:

1. **Hero section** — Cover photo (or gradient fallback), group avatar, name, tagline, type badge, member count, health status badge, creation date
2. **Pinned announcement** — Admin-set message visible to all members (left-bordered accent panel)
3. **House essentials strip** — Wi-Fi, bins, landlord, emergency contact, house rules (icon-annotated, compact)
4. **Key stats** — Total monthly spend (with per-person split text), active members, active expenses
5. **Your Position card** — Personal settlement status, monthly share, payments needed, settle up button
6. **Recent Activity feed** — Last 8 items with avatars and relative timestamps
7. **Members section** — Avatar cards with monthly share, role badge (Owner crown/Admin star/Member), settlement status dot
8. **Monthly Breakdown** — Category breakdown with progress bars, percentages, per-person amounts
9. **Quick Actions** — View Dashboard, Add Expense, Settle Up

---

## V3 Feature Requirements — Stage 5 (Hub & Identity)

*Theme: Transform groups into personalised hub spaces with rich identity and social texture.*

### F43: Group Hub Landing Page

**Description:** A dedicated landing page for each group that serves as the primary entry point, showing identity, finances, members, and activity at a glance.

**Requirements:**
- F43.1: Route at `/groups/:groupId` with full hub layout
- F43.2: Cover photo hero with gradient fallback (per group type)
- F43.3: Group avatar with admin upload capability (FileButton)
- F43.4: Cover photo with admin upload capability
- F43.5: Name, tagline, type badge, member count displayed in hero overlay
- F43.6: Dark overlay gradient for text readability over images
- F43.7: Key stats row (total spend, members, expenses) using KPI cards
- F43.8: Per-person split text ("Split X ways - £Y/person") on total stat
- F43.9: Members grid with avatars, roles, monthly shares, settlement status badges
- F43.10: Monthly breakdown with category progress bars and per-person amounts
- F43.11: Quick action buttons (Dashboard, Add Expense, Settle Up)
- F43.12: Group cards on `/groups` page link to hub pages
- F43.13: Dark mode support for all hub elements

**Status:** ✅ Built
**Files:** `apps/web/src/routes/_app/groups/$groupId/index.lazy.tsx`, `groups/index.lazy.tsx`

### F44: Member Profile Page

**Description:** Click on any member to see their profile within the group context, including settlement status, payment methods, shared groups, and recent activity.

**Requirements:**
- F44.1: Route at `/members/:userId`
- F44.2: Profile header with avatar, name, email, role badge, join date
- F44.3: Settlement status badge (Settled/Owes X/Owed X) from live settlement data
- F44.4: "In This Group" stat cards (group name, role, status, type)
- F44.5: Payment methods list with provider name, label, default indicator, Pay button
- F44.6: Quick Pay banner when current user owes this member (links to payment method)
- F44.7: Shared groups section (privacy-respecting — only mutual groups shown)
- F44.8: Recent activity timeline with expense entries and payment records
- F44.9: Clickable member cards in members list linking to profile
- F44.10: Loading skeleton and empty/not-found states

**Status:** ✅ Built
**Files:** `apps/web/src/routes/_app/members/$userId.lazy.tsx`, `members.lazy.tsx`

### F45: Group Customisation (Pinned Messages)

**Description:** Admin-editable pinned announcement that appears on the hub landing page.

**Requirements:**
- F45.1: `pinned_message` text column on groups table
- F45.2: Textarea in group edit page for setting/clearing the message
- F45.3: Pinned message banner on hub page (left-bordered accent panel with pin icon)
- F45.4: Only shown when message exists
- F45.5: Supports multi-line text (pre-formatted whitespace)

**Status:** ✅ Built
**Files:** Migration `20260323310000`, edit page, hub page

### F46: House Info Essentials

**Description:** Structured practical information (Wi-Fi, bins, landlord, emergency) stored as JSON and displayed on the hub.

**Requirements:**
- F46.1: `house_info` JSONB column on groups table
- F46.2: 6 structured fields: Wi-Fi password, Bins day, Landlord name, Landlord phone, Emergency contact, House rules
- F46.3: Edit section in group settings with icons (Wi-Fi, phone, etc.)
- F46.4: Compact display strip on hub page below pinned message
- F46.5: Only populated fields shown; strip hidden when all empty
- F46.6: SimpleGrid layout (responsive 1-3 columns)

**Status:** ✅ Built
**Files:** Migration `20260323330000`, edit page, hub page

### F47: Owner Role Visual Distinction

**Description:** Group owners displayed with a distinct crown icon and orange badge, differentiating from regular admins.

**Requirements:**
- F47.1: Crown icon (IconCrown) for owners on hub member cards
- F47.2: "Owner" badge in orange (vs "Admin" in yellow, "Member" in gray)
- F47.3: Owner badge on members list page
- F47.4: Based on `group.owner_id` matching `member.user_id`

**Status:** ✅ Built
**Files:** Hub page, members.lazy.tsx

### F48: House Health Status

**Description:** A badge on the hub hero showing the financial health of the group at a glance.

**Requirements:**
- F48.1: Badge displayed in hero section next to type badge
- F48.2: States: "All settled" (green), "Payments pending" (orange), "Bills overdue" (red)
- F48.3: Derived from settlement data (transactions) and expense due dates
- F48.4: Updates reactively when settlement data changes

**Status:** ✅ Built
**Files:** Hub page (hero section)

### F49: Privacy Controls for Shared Groups

**Description:** Users can control whether other members can see their cross-group membership.

**Requirements:**
- F49.1: `show_shared_groups` boolean on users table (default true)
- F49.2: Toggle in Settings > Privacy section
- F49.3: `getMemberProfile` API respects the setting — returns empty shared groups when opted out
- F49.4: Persisted directly to database on toggle change

**Status:** ✅ Built
**Files:** Migration `20260323320000`, settings page, group-hub.ts API

---

## V3 Feature Requirements — Stage 6 (Intelligence & Trust)

*Theme: Add financial intelligence, trust features, and cross-hub awareness.*

### F50: Cross-Hub Command Centre

**Description:** Upgrade the Overview page into a personal command centre showing priorities across all groups.

**Requirements:**
- F50.1: Renamed from "Cross-Group Overview" to "Command Centre"
- F50.2: "Priority Actions" section showing top 3 debts with pay buttons (red accent)
- F50.3: "My Groups" section with avatar cards and status pills:
  - "Settled" (green dot) — no outstanding debts
  - "You owe £X" (red dot) — user owes money
  - "Waiting on X" (orange dot) — others owe the user
- F50.4: Group cards link to hub pages
- F50.5: Groups shown even when all settled (navigation always available)
- F50.6: Existing netting toggle and settlement details preserved below
- F50.7: Per-group settlement totals derived from cross-group data

**Status:** ✅ Built
**Files:** `apps/web/src/routes/_app/overview.lazy.tsx`

### F51: Expense Approval Flows

**Description:** Configurable threshold-based approval workflow for large expenses.

**Requirements:**
- F51.1: `approval_status` column on expenses: 'approved' | 'pending' | 'rejected' (default: 'approved')
- F51.2: `approved_by` and `approved_at` columns on expenses
- F51.3: `approval_threshold` column on groups (numeric, nullable — null = disabled)
- F51.4: When creating an expense, if amount > group.approval_threshold, set status to 'pending'
- F51.5: Pending expenses excluded from settlement calculations
- F51.6: Admin-only approve/reject API with admin authorization verification
- F51.7: "Pending Approvals" section at top of expenses list (admin-only, orange accent)
- F51.8: Approve/Reject buttons with success notifications
- F51.9: NumberInput for threshold in group edit page
- F51.10: Existing expenses default to 'approved' (no disruption)

**Status:** ✅ Built
**Files:** Migration `20260323340000`, `packages/api/src/approvals.ts`, expenses page, edit page

### F52: Multiple Payment Methods

**Description:** Users can save multiple payment providers (Revolut, Monzo, PayPal, bank transfer) instead of just one.

**Requirements:**
- F52.1: `user_payment_methods` table: id, user_id, provider, label, payment_link, payment_info, is_default, created_at, updated_at
- F52.2: Add/edit/delete methods in Profile page
- F52.3: One method marked as default (used for settlement pay buttons)
- F52.4: Settlement and member profile "Pay" buttons use the default method
- F52.5: Legacy single-method fields removed from profiles table

**Status:** ✅ Built
**Files:** Migration, `packages/api/src/payment-methods.ts`, profile page

### F53: Profile / Settings Split

**Description:** Separate the single settings page into a personal Profile page (avatar, name, payment methods) and an app Settings page (notifications, appearance, billing, privacy).

**Requirements:**
- F53.1: New `/profile` route for personal information
- F53.2: Settings page retains: Appearance, Notifications, Privacy, Subscription, Data, Danger Zone
- F53.3: Profile accessible from avatar menu in header
- F53.4: Settings accessible from avatar menu and sidebar

**Status:** ✅ Built
**Files:** `profile.lazy.tsx`, `settings.lazy.tsx`

---

## V3 Feature Requirements — Stage 7 (Responsibilities & Social)

*Theme: Expand beyond money into shared living responsibilities.*

### F41: Chore Rotation (Updated — Full Implementation)

**Description:** Household chore management with creation, assignment, recurring schedules, rotation, and completion tracking.

**Requirements:**
- F41.1: `chores` table: id, group_id, title, description, frequency (daily/weekly/biweekly/monthly/once), assigned_to, rotation_order (jsonb), next_due, created_by, is_active, created_at
- F41.2: `chore_completions` table: id, chore_id, completed_by, completed_at
- F41.3: RLS: active group members can SELECT/INSERT; admins can UPDATE/DELETE; active members can UPDATE for completion advancement
- F41.4: Pure logic: `calculateNextDue(frequency, lastDue)` and `getNextInRotation(rotationOrder, currentAssignee)`
- F41.5: `completeChore` API: insert completion, advance next_due, rotate assignment
- F41.6: Full chores page with overdue (red) vs upcoming sections
- F41.7: Create modal: title, description, frequency, assign to member
- F41.8: "Done" button per chore with success notification
- F41.9: Admin delete with soft-delete (is_active = false)
- F41.10: "Chores" nav link in Team group with checklist icon
- F41.11: Chore cards show: title, frequency badge, assignee avatar, due date, last completion info

**Status:** ✅ Built
**Files:** Migration `20260323350000`, `packages/core/src/chores.ts`, `packages/api/src/chores.ts`, `apps/web/src/routes/_app/chores.lazy.tsx`

---

## Implementation Status — All Features

### V1 Features (F1-F19) — All Built

| Feature | Status |
|---------|--------|
| F1: Authentication (Google OAuth) | ✅ |
| F2: Onboarding flow | ✅ |
| F3: Group management (6 types) | ✅ |
| F4: Expense creation with splits | ✅ |
| F5: Recurring expenses | ✅ |
| F6: Dashboard with analytics | ✅ |
| F7: Breakdown page | ✅ |
| F8: Payment tracking | ✅ |
| F9: Activity log | ✅ |
| F10: Push notifications | ✅ |
| F11: Email notifications | ✅ |
| F12: CSV/PDF export | ✅ |
| F13: Monthly PDF statements | ✅ |
| F14: Stripe subscription billing | ✅ |
| F15: Plan limits (Postgres triggers) | ✅ |
| F16: Landing page | ✅ |
| F17: Mobile app (Expo) | ✅ (core screens) |
| F18: Invite system (token-based) | ✅ |
| F19: GDPR compliance | ✅ |

### V2 Features (F20-F42) — Status

| Feature | Status | Notes |
|---------|--------|-------|
| F20: Dark Mode | ✅ | Light/Dark/System toggle, all commune-* classes |
| F21: Smart Settlement | ✅ | Min-transactions algorithm, pay buttons |
| F22: Auto-Split Templates | ✅ | CRUD, apply to expense form |
| F23: Annual Billing | ✅ | 20% discount, SegmentedControl toggle |
| F24: Standard 5→8 Members | ✅ | All code + docs updated |
| F25: Draft Saving | ✅ | onValuesChange debounce, restore/discard |
| F26: Receipt OCR | ❌ | Not built — needs AI vision edge function |
| F27: Item-Level Splitting | ❌ | Not built — needs new schema |
| F28: Splitwise Import | ✅ | CSV parser, 4-step wizard, Pro gate |
| F29: Tier-Gated Features | ✅ | Analytics/exports behind Pro |
| F30: Trip Pass Pricing | ❌ | Not built — needs Stripe config |
| F31: Offline/PWA | ⚠️ | Nav cache only, no offline writes |
| F32: Payment Nudge Reminders | ✅ | Push + email, cooldown, group toggle, admin history |
| F33: Group Fund / Pot | ✅ | Full CRUD, progress bars |
| F34: Member Proration | ✅ | Dates, redistribution, admin override |
| F35: Group Budget Tracking | ✅ | Total + category budgets, alert thresholds |
| F36: Group-Type-Aware UI | ✅ | Quick actions, empty states, category ordering, onboarding tips |
| F37: Cross-Group Debt Netting | ✅ | Algorithm, opt-in toggle, per-group view |
| F38: Couple Mode | ✅ | Linking, auto-link for couple groups, merged settlement |
| F39: Open Banking | ❌ | Not built — future infrastructure |
| F40: In-App Settlement | ❌ | Not built — needs Stripe Connect |
| F41: Chore Rotation | ✅ | Full system (see V3 Stage 7) |
| F42: Shopping Lists | ❌ | Not built — decision pending |

### V3 Features (F43-F53) — All Built

| Feature | Status |
|---------|--------|
| F43: Group Hub Landing Page | ✅ |
| F44: Member Profile Page | ✅ |
| F45: Pinned Messages | ✅ |
| F46: House Info Essentials | ✅ |
| F47: Owner Role Visual Distinction | ✅ |
| F48: House Health Status | ✅ |
| F49: Privacy Controls | ✅ |
| F50: Cross-Hub Command Centre | ✅ |
| F51: Expense Approval Flows | ✅ |
| F52: Multiple Payment Methods | ✅ |
| F53: Profile/Settings Split | ✅ |

### Summary

| Category | Built | Partial | Not Built | Total |
|----------|-------|---------|-----------|-------|
| V1 (F1-F19) | 19 | 0 | 0 | 19 |
| V2 (F20-F42) | 17 | 1 | 5 | 23 |
| V3 (F43-F53) | 11 | 0 | 0 | 11 |
| **Total** | **47** | **1** | **5** | **53** |

**Completion: 89%** (47 built + 1 partial out of 53 total features)

---

## Quality Review Fixes (Applied)

A comprehensive code review was conducted on 2026-03-23. All critical and high-severity issues were identified and fixed.

### Critical Fixes (4)

| Issue | Fix | Commit |
|-------|-----|--------|
| Rules of Hooks violation in Group Hub (hooks after early return) | Moved useGroupSettlement and useActivityLog above conditional return | bd94bfd |
| Rules of Hooks violation in Member Profile (same pattern) | Moved useGroupSettlement above conditional returns | bd94bfd |
| Expense approval flow dead code (createExpense never set 'pending') | Added threshold check in createExpense — now queries group.approval_threshold | bd94bfd |
| Missing --commune-surface-alt CSS variable | Added to both light and dark mode :root blocks | bd94bfd |

### High Fixes (4)

| Issue | Fix |
|-------|-----|
| No admin auth check on approve/reject | Added verifyAdminForExpense() — checks group membership + admin role |
| Chores RLS blocks completion updates | Added UPDATE policy for active group members |
| Hub member cards linked to /members instead of profiles | Changed to /members/:userId |
| Settlement includes pending expenses | Resolved by setting approval_status correctly in createExpense |

### Medium Fixes (4)

| Issue | Fix |
|-------|-----|
| Unused imports (Image, Divider, IconHeartbeat) | Removed from 3 files |
| Group edit navigates to /members after save | Changed to /groups/:groupId (hub page) |
| Group type icon map inconsistency in member profile | Noted — uses different key convention |
| Local formatDate vs shared utility in hub | Noted — hub defines own helper |

---

## Remaining Work — Prioritised Backlog

### HIGH Priority (should build next)

| # | Feature | Effort | Description |
|---|---------|--------|-------------|
| 1 | **Smart predictive nudges** | Medium | Context-aware notifications: "Bills 18% higher than last month", "Internet not marked paid", "You usually buy cleaning supplies around now" |
| 2 | **Receipt OCR (F26)** | Large | AI vision edge function for receipt scanning → auto-fill expense form |
| 3 | **Trip Pass pricing (F30)** | Small | Stripe one-time payment, 14-day Pro access, pricing page UI |
| 4 | **Mobile app parity** | Large | Analytics screen, recurring management, chores, hub features |

### MEDIUM Priority

| # | Feature | Effort | Description |
|---|---------|--------|-------------|
| 5 | **Offline expense entry (F31)** | Medium | IndexedDB storage, sync on reconnect, offline indicator |
| 6 | **Item-level splitting (F27)** | Large | New schema, assignment UI, integrates with OCR |
| 7 | **Chore form validation** | Small | Add Zod validation rules to prevent empty title submission |
| 8 | **Chore completion audit trail** | Small | Record who was assigned when chore was completed |
| 9 | **Settlement excludes pending expenses** | Small | Filter approval_status='pending' from settlement queries |

### LOW Priority (future)

| # | Feature | Effort | Description |
|---|---------|--------|-------------|
| 10 | Shopping lists (F42) | Medium | Collaborative lists with "convert to expense" |
| 11 | Open Banking (F39) | Very large | Plaid/TrueLayer integration |
| 12 | In-app settlement (F40) | Very large | Stripe Connect P2P |
| 13 | Voice/NLP interface | Very large | Speech-to-text expense entry |
| 14 | B2B2C co-living channel | Business | Operator partnerships |

### Need a Decision (carried from V2)

All items 17-29 from V2 PRD remain. Key open decisions:

| Item | Question | Recommendation |
|------|----------|----------------|
| 17 | Shopping lists scope | Defer — chores covers the responsibility gap |
| 18 | Trip pass pricing | Build at £2.99 — limited downside |
| 19 | B2B2C channel | Defer until traction |
| 20 | Budget tier placement | Confirmed Pro+ |
| 22 | PWA/offline priority | High for Trip groups |
| 29 | Nudge aggressiveness | Default gentle (7 days), admin configures |

---

## Updated Data Model Changes (V3)

### New Tables (V3 additions to V2)

```
user_payment_methods (F52)
  id: uuid PK
  user_id: uuid FK → users
  provider: payment_provider NOT NULL
  label: text nullable
  payment_link: text nullable
  payment_info: text nullable
  is_default: boolean DEFAULT false
  created_at: timestamptz
  updated_at: timestamptz
  UNIQUE(user_id, provider, payment_link)

chore_completions (F41 — expanded from V2 spec)
  id: uuid PK
  chore_id: uuid FK → chores
  completed_by: uuid FK → users
  completed_at: timestamptz DEFAULT now()

payment_nudges (F32)
  id: uuid PK
  group_id: uuid FK → groups
  from_user_id: uuid FK → users
  to_user_id: uuid FK → users
  expense_id: uuid nullable FK → expenses
  amount: numeric
  sent_at: timestamptz DEFAULT now()
  created_at: timestamptz DEFAULT now()
```

### Modified Tables (V3 additions)

```
groups — new columns:
  pinned_message: text DEFAULT NULL (F45)
  house_info: jsonb DEFAULT NULL (F46)
  approval_threshold: numeric DEFAULT NULL (F51)
  avatar_url: text DEFAULT NULL (F43)
  cover_url: text DEFAULT NULL (F43)
  tagline: text DEFAULT NULL (F43)

users — new columns:
  show_shared_groups: boolean DEFAULT true (F49)

expenses — new columns:
  approval_status: text DEFAULT 'approved' CHECK IN ('approved', 'pending', 'rejected') (F51)
  approved_by: uuid FK → users nullable (F51)
  approved_at: timestamptz nullable (F51)

chores — expanded from V2 spec:
  description: text nullable (added)
  rotation_order: jsonb nullable (added — array of user_ids for rotation)
  is_active: boolean DEFAULT true (added — soft delete)
```

### Storage

```
group-images bucket (F43)
  - Stores group avatars and cover photos
  - RLS: active group members can view, admins can upload/delete
  - Path: {groupId}/avatar or {groupId}/cover
```

### Migrations (V3 session)

```
20260323300000_add_group_hub_fields.sql — avatar_url, cover_url, tagline + group-images bucket
20260323310000_add_group_pinned_message.sql — pinned_message column
20260323320000_add_show_shared_groups.sql — show_shared_groups on users
20260323330000_add_house_info.sql — house_info JSONB column
20260323340000_add_expense_approvals.sql — approval_status, approved_by, approved_at, approval_threshold
20260323350000_add_chores.sql — chores + chore_completions tables with RLS
20260323360000_fix_chores_completion_rls.sql — active member UPDATE policy for completion advancement
```

---

## Architecture Decisions

### 1. Hub-First Navigation

Groups are now accessed via hub landing pages (`/groups/:id`) rather than just setting an active group in the sidebar. The sidebar still switches the active group for expense/breakdown/analytics views, but the hub is the primary entry point.

### 2. Settlement-Driven Status

Health badges, member status dots, and the command centre all derive from the same `useGroupSettlement` hook. This creates a single source of truth for financial state across the UI.

### 3. Structured vs Unstructured House Info

House info uses a JSONB column with known keys (wifi, bins, landlord, etc.) rather than a separate table. This keeps it simple and avoids N+1 queries while still being queryable.

### 4. Soft-Delete for Chores

Chores use `is_active = false` rather than actual deletion. This preserves completion history and allows future "view completed chores" features.

### 5. Approval Threshold at Group Level

Expense approval is opt-in per group via a numeric threshold. Null = no approval needed. This avoids slowing down groups that don't want approval flows while giving trust features to those that do.

### 6. Privacy-Respecting Shared Groups

The shared groups feature on member profiles is privacy-controlled. Users can opt out via a settings toggle, and the API enforces this server-side (not just UI-hidden).

---

*End of PRD V3. For V2 features (F20-F42) and competitive research, see [PRD V2](./PRD-V2.md). For V1 features (F1-F19), see [PRD V1.1](./PRD.md).*
