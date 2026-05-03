# Commune — Product Requirements Document

**Version:** 4.2
**Date:** 2026-03-25
**Platform:** Web first (Vite + React), Mobile second (Expo)
**Previous:** [PRD V3](./PRD-V3.md) — hub system, intelligence, current implementation state
**Vision:** [VISION.md](./VISION.md) — product vision and strategic boundary

---

## What Changed in V4

V4 makes the category explicit.

Commune is no longer described only as a shared household product. It is now positioned as a platform for **ongoing shared spaces and recurring groups**:
- Homes and co-living houses
- Studios and creative collectives
- Coworking spaces and shared offices
- Project spaces and production crews
- Trips, retreats, and temporary communal groups
- Any recurring space where two or more people coordinate money, responsibilities, and shared context

Homes remain the strongest wedge and the most mature implementation. But the product boundary is broader: **Commune should help any shared space run clearly.**

---

## Core Product Direction

Commune should evolve in this order:

1. Be indispensable for one shared space
2. Become configurable across different kinds of shared spaces
3. Add multi-space and operator tooling for people running several spaces

The next phase is not feature sprawl. It is expanding the hub into a reliable operating layer around the financial core.

### What V4 Does Next

The next bets are deliberately narrower than "build workspace mode" or "build trip mode."

Commune should first build a stronger shared operating model that works across homes, studios, workspaces, projects, and trips without separate product branches.

The implementation rule is simple: subtype-aware behaviour should improve the common model, not replace it. Group types and subtypes should primarily influence setup presets, category ordering, onboarding guidance, essentials defaults, operations templates, and a small number of targeted workflows. They should not create disconnected mini-products with unrelated core flows.

If only five bets are pursued next, they should be:

1. Monthly close and cycle management
2. Member lifecycle, move-out, and admin handover
3. Space Essentials 2.0
4. Shared operations boards
5. Space templates and onboarding playbooks

Only after those are real should Commune invest heavily in full workspace, project, or trip-specific modes.

---

## Product Boundary

### In Scope
- Shared finances and recurring obligations
- Group status, visibility, and accountability
- Shared responsibilities and operational coordination
- Important group context and reference information
- Member lifecycle and handover workflows
- Admin and operator tooling for running one or more spaces

### Out of Scope
- Generic social networking
- Real-time chat as a primary product
- Generic project management unrelated to shared spaces
- Broad HR or enterprise collaboration tooling

Every major feature should improve at least one of:
- Shared financial clarity
- Shared responsibility
- Shared context
- Shared operations
- Operator visibility

---

## V4 Build Plan

### Stage 8 — Single-Space Excellence

**Goal:** Make Commune indispensable for running one shared space well.

**Key outcomes:**
- A group can close a month cleanly
- Joins, leaves, and handovers stop being messy
- Space-level essentials stop feeling home-only
- Shared operations become first-class, not sidecar
- Setup becomes faster through templates and playbooks
- Mobile supports the operational workflows people actually use

---

#### F54: Monthly Close & Cycle Management

**Description:** A proper end-of-cycle flow for recurring groups.

**Requirements:**
- F54.1: Introduce a monthly close screen per group
- F54.2: Show open payments, pending approvals, overdue items, and unresolved balances
- F54.3: Allow admins to mark a cycle as closed once all required actions are complete
- F54.4: Generate a cycle summary with totals, member balances, and exported statement links
- F54.5: Provide a clear next-cycle start date and recurring generation status
- F54.6: Support reopened cycles for admin corrections with audit visibility

**Status: 95% COMPLETE**

**Implementation:**

| Layer | File | Status |
|-------|------|--------|
| Migration | `supabase/migrations/20260324010000_add_group_cycle_closures.sql` | ✅ Applied to remote |
| API | `packages/api/src/cycles.ts` | ✅ `getGroupCycleSummary`, `closeGroupCycle`, `reopenGroupCycle` |
| Hooks (Web) | `apps/web/src/hooks/use-cycles.ts` | ✅ Query + mutations with cache invalidation |
| Hooks (Mobile) | `apps/mobile/hooks/use-cycles.ts` | ✅ Same interface |
| UI | `apps/web/src/routes/_app/groups/$groupId.close.lazy.tsx` | ✅ Full close page |
| UI (Mobile) | `apps/mobile/app/group-close.tsx` | ✅ Mobile close screen |

**What's built:**
- Full cycle close page with stats (total spend, outstanding, unpaid, member balances)
- Setup checklist integration showing incomplete items before close
- Operations overdue tracking surfaced during close
- Notes textarea for handover documentation
- Member balance breakdown with individual cards
- Cycle expense table with approval status filtering
- Close/reopen workflow with audit trail (closed_by, reopened_by, timestamps)
- Admin-only action gating

**Remaining:**
- Polish: cycle summary export as PDF (could reuse statement generation)

---

#### F55: Member Lifecycle & Space Changes

**Description:** Handle the messy reality of people joining, leaving, moving out, or changing participation.

**Requirements:**
- F55.1: Add join/leave/move-out flows at the group level
- F55.2: Calculate proration recommendations automatically for partial-cycle membership
- F55.3: Show unresolved balances before a member can be removed
- F55.4: Provide a handover checklist for owners/admins
- F55.5: Preserve historical responsibility and payment records after departure
- F55.6: Support temporary inactive states without data loss

**Status: 90% COMPLETE**

**Implementation:**

| Layer | File | Status |
|-------|------|--------|
| DB | Leverages existing `group_members` schema | ✅ `effective_from`, `effective_until`, `status` |
| API | `packages/api/src/member-lifecycle.ts` | ✅ Full lifecycle management |
| Hooks (Web) | `apps/web/src/hooks/use-member-lifecycle.ts` | ✅ Query + mutations |
| Hooks (Mobile) | `apps/mobile/hooks/use-member-lifecycle.ts` | ✅ Same interface |
| UI | `apps/web/src/routes/_app/members.lazy.tsx` | ✅ Integrated lifecycle actions |

**What's built:**
- `getGroupLifecycleSummary()` — active count, admin count, owner alerts, joiners/departures this cycle, scheduled departures, proration info
- `scheduleMemberDeparture()` — schedules exit with effective_until, validates owner can't leave without transfer, prevents last admin departure
- `restoreMemberAccess()` — reverts scheduled departure
- Departure scheduling modal in members page
- Member date management with effective_until picker
- Restore access modal for departed members
- Full proration calculation integration (from V2 F34)
- Historical records preserved after departure

**Remaining:**
- Dedicated member lifecycle detail page (currently inline in members list)
- Owner handover checklist UI (API supports it, no dedicated flow)

---

#### F56: Space Essentials 2.0

**Description:** Replace home-only context with configurable essentials by space type.

**Requirements:**
- F56.1: Keep current house info for home groups
- F56.2: Add templates for workspace, project, trip, and other space types
- F56.3: Support configurable fields such as access info, venue notes, contacts, recurring instructions, and shared rules
- F56.4: Surface essentials prominently on hub pages and mobile
- F56.5: Allow admins to control which essentials are visible to members

**Status: 95% COMPLETE**

**Implementation:**

| Layer | File | Status |
|-------|------|--------|
| Migration | `supabase/migrations/20260324020000_add_space_essentials_and_operations_fields.sql` | ✅ Applied |
| Core | `packages/core/src/space-essentials.ts` | ✅ 6 group types with tailored fields |
| UI | `apps/web/src/routes/_app/groups/$groupId.edit.lazy.tsx` | ✅ Dynamic essentials editor |
| UI | `apps/web/src/routes/_app/groups/$groupId/index.lazy.tsx` | ✅ Hub display |

**What's built:**
- 6 group-type-specific essential field sets:
  - **Home:** Wi-Fi, bins, landlord, emergency, rules
  - **Workspace:** access info, Wi-Fi, hours, building contact, supplies, rules
  - **Project:** location, access, lead contact, handover, equipment, rules
  - **Trip:** accommodation, meetup point, transport, emergency, checkout, rules
  - **Couple:** shared calendar, emergency, rules
  - **Other:** access, contact, instructions, rules
- `normalizeSpaceEssentials()` — handles migration from legacy `house_info` to unified `space_essentials`
- Visibility flags per essential (defaultVisible)
- Dynamic field generation in group edit page
- Hub page display with icons
- Starter pack integration for pre-filling during onboarding

**Remaining:**
- Admin visibility toggle UI (data model supports it, no toggle widget yet)

---

#### F57: Shared Operations Boards

**Description:** Extend chores into a tighter operations layer for running a shared space, not a generic task manager.

**Requirements:**
- F57.1: Support recurring tasks, one-off tasks, and checklists
- F57.2: Group responsibilities into categories such as cleaning, supplies, admin, setup, and shutdown
- F57.3: Add ownership, due state, completion history, and simple escalation
- F57.4: Support group-type-specific templates
- F57.5: Allow completed tasks to feed activity, lifecycle, and monthly close visibility
- F57.6: Keep the scope anchored to shared-space operations, not generic project management

**Status: 95% COMPLETE**

**Implementation:**

| Layer | File | Status |
|-------|------|--------|
| Migration | `supabase/migrations/20260324020000_add_space_essentials_and_operations_fields.sql` | ✅ Applied |
| Migration | `supabase/migrations/20260323350000_add_chores.sql` | ✅ Applied |
| Core | `packages/core/src/operations-templates.ts` | ✅ Type-aware templates |
| Core | `packages/core/src/chores.ts` | ✅ Due date calculation, rotation |
| API | `packages/api/src/chores.ts` | ✅ Full CRUD + complete + overdue |
| Hooks | `apps/web/src/hooks/use-chores.ts` | ✅ All operations |
| UI | `apps/web/src/routes/_app/chores.lazy.tsx` | ✅ Full operations board |

**What's built:**
- 7 operation categories: cleaning, supplies, admin, setup, shutdown, maintenance, other
- 3 task types: recurring, one-off, checklist
- Frequency options: daily, weekly, biweekly, monthly, once
- Checklist item support (JSONB array with title + completed state)
- Escalation days configuration
- Category filter on operations board
- Assignment to members with rotation support
- "Done" button advances schedule and rotates assignment
- Overdue detection with visual highlighting
- Completion history tracking
- Group-type-specific templates via `getOperationTemplates(groupType, subtype)`
- Base templates per type + subtype-specific extras (co-living welcome, high-turnover handover, coworking open/close, etc.)
- Cycle close integration (overdue ops surfaced during close)

**Remaining:**
- Completion feeding into activity log (currently tracked in chore_completions only)

---

#### F58: Space Templates & Onboarding Playbooks

**Description:** Pull setup templates forward so Commune can generalise across space types before full mode specialisation.

**Requirements:**
- F58.1: Templates by group type and subtype
- F58.2: Suggested expense categories, responsibilities, and essentials
- F58.3: Suggested onboarding checklists for admins
- F58.4: Prebuilt starting layouts for homes, studios, workspaces, trips, and projects
- F58.5: Keep templates lightweight and editable rather than hardcoding separate product branches

**Status: 90% COMPLETE**

**Implementation:**

| Layer | File | Status |
|-------|------|--------|
| Migration | `supabase/migrations/20260325010000_add_group_setup_checklist_progress.sql` | ✅ Applied |
| Core | `packages/core/src/space-playbooks.ts` | ✅ Admin checklists by type |
| Core | `packages/core/src/space-presets.ts` | ✅ Starter layouts by type |
| Core | `packages/core/src/operations-templates.ts` | ✅ Operation templates |
| API | `packages/api/src/onboarding.ts` | ✅ `applyGroupStarterPack()` |
| Hooks | `apps/web/src/hooks/use-onboarding.ts` | ✅ Starter pack mutation |
| UI | `apps/web/src/routes/_app/onboarding.lazy.tsx` | ✅ 5-step creation flow |
| UI | `apps/web/src/routes/_app/groups/$groupId.edit.lazy.tsx` | ✅ Checklist toggle |

**What's built:**

*Admin Playbooks (space-playbooks.ts):*
- Group-type-specific admin onboarding checklists:
  - Home: billing cycle, share essentials, balance review, member roles
  - Couple: shared vs personal, recurring check-in, rules capture
  - Workspace: vendor admin, access/hours/supplies, weekly ops
  - Project: approval lead, venue/access/handover, contributor flow
  - Trip: logistics, shared pot, checkout owner
- Subtype-specific extras (co-living, high-turnover, coworking, production, festival)
- `createSetupChecklistProgress()` initializes persistent progress tracking

*Space Presets (space-presets.ts):*
- Full preset per group type with:
  - Suggested expense categories
  - Example first expenses
  - Essential field seeds
  - Guiding text
- Subtype refinements available

*Starter Pack (onboarding.ts API):*
- `applyGroupStarterPack()`:
  - Creates `setup_checklist_progress` from group type/subtype
  - Applies `space_essentials` if provided
  - Optionally seeds starter operations from templates
  - Returns counts of operations created and essentials applied

*Onboarding Flow (onboarding.lazy.tsx):*
- 5-step guided creation:
  1. Choose group type and subtype
  2. Configure basics (name, cycle date, currency)
  3. Space essentials capture with type-aware fields
  4. Setup checklist preview with operation templates
  5. Invite first members

**Remaining:**
- Subtype-specific essentials defaults (currently type-level only)
- Starter expense category suggestions during onboarding
- Decision: should presets auto-create split templates for common recurring costs?
- Prebuilt starting layouts for specific subtypes:
  - `home/coliving`, `home/high_turnover`, `workspace/coworking`, `project/production`, `trip/festival`
- Owner/admin handover checklist entry points from lifecycle screens

---

#### F59: Mobile Parity for Hub & Ops

**Description:** Bring the operational layer fully onto mobile.

**Requirements:**
- F59.1: Hub parity for group identity, pinned notices, and essentials
- F59.2: Command Centre parity for priorities and group statuses
- F59.3: Shared operations board parity
- F59.4: Approval, close, and member lifecycle actions on mobile
- F59.5: Reliable offline draft support for core entry flows

**Status: 60% COMPLETE**

**Implementation:**

| Layer | File | Status |
|-------|------|--------|
| Hooks | `apps/mobile/hooks/use-cycles.ts` | ✅ Cycle management |
| Hooks | `apps/mobile/hooks/use-member-lifecycle.ts` | ✅ Lifecycle management |
| Hooks | `apps/mobile/hooks/use-chores.ts` | ✅ Operations |
| Hooks | `apps/mobile/hooks/use-onboarding.ts` | ✅ Starter pack |
| UI | `apps/mobile/app/group-close.tsx` | ✅ Cycle close screen |
| UI | `apps/mobile/app/operations.tsx` | ✅ Operations screen |
| UI | Core screens (expenses, settings, etc.) | ✅ Updated |

**What's built:**
- All V4 hooks ported to mobile with same interfaces
- Cycle close screen on mobile
- Operations/chores screen on mobile
- Updated onboarding flow
- Groups tab with group switching
- Dark mode support

**Remaining:**
- Hub page on mobile (currently goes straight to dashboard)
- Command Centre on mobile
- Essentials display on mobile hub
- Member lifecycle actions in mobile members screen
- Offline draft support (IndexedDB equivalent for React Native)

---

### Stage 8 Supporting Features

#### F59B: Workspace Billing & Vendor Context

**Description:** Workspace-specific expense context for invoices, vendors, and due dates.

**Status: 90% COMPLETE**

| Layer | File | Status |
|-------|------|--------|
| Migration | `supabase/migrations/20260325020000_add_expense_vendor_invoice_context.sql` | ✅ Applied |
| Core | `packages/core/src/expense-vendor-invoice.ts` | ✅ Normalization + validation |
| API | `packages/api/src/workspace-billing.ts` | ✅ Full billing report |

**What's built:**
- Expense table extended: `vendor_name`, `invoice_reference`, `invoice_date`, `payment_due_date`
- Workspace billing models: snapshot, trends, vendor aggregation
- Overdue tracking, upcoming due dates (7-day window)
- 6-month billing trend calculations
- Export rows with overdue flags

**Remaining:** No dedicated billing dashboard page yet (data accessible via API)

---

#### F59C: Workspace Governance & Approval Policies

**Description:** Configurable approval policies and role presets for workspace groups.

**Status: 95% COMPLETE**

| Layer | File | Status |
|-------|------|--------|
| Migration | `supabase/migrations/20260325030000_add_workspace_role_presets_and_approval_policy.sql` | ✅ Applied |
| Core | `packages/core/src/workspace-governance.ts` (if exists) or inline | ✅ Policy validation |
| Hooks | `apps/web/src/hooks/use-workspace-governance.ts` | ✅ Governance hooks |

**What's built:**
- `approval_policy` JSONB on groups: threshold, allowed_roles, allowed_labels, role_presets
- `responsibility_label` on group_members for workspace role differentiation
- Default presets: owner, finance, operations
- Subtype-specific presets (team: front of house, etc.)
- `canMemberApproveWithPolicy()` validation function

**Remaining:** UI for editing approval policies (currently set via migration defaults)

---

### Stage 9 — Selective Space-Type Specialisation

**Goal:** Make Commune feel native to different kinds of shared spaces, but only after Stage 8 proves the common operating model.

**Guardrail:** Stage 9 should not begin as broad specialisation. It should start with the smallest differentiated investments that unlock real usage after essentials, operations, templates, and lifecycle are working well.

**Architecture rule:** Stage 9 should still inherit the same shared finance, essentials, operations, onboarding, and lifecycle foundations from Stage 8. If a mode requires replacing those foundations entirely, it is probably a product boundary mistake rather than a feature gap.

#### F60: Workspace Specialisation

**Description:** Stronger support for small teams, shared offices, studios, and coworking spaces.

**Requirements:**
- F60.1: Workspace-specific essentials templates — ✅ Built in F56
- F60.2: Team role presets and approval chains — ✅ Built in F59C
- F60.3: Better receipt, invoice, and vendor context — ✅ Built in F59B
- F60.4: Shared subscriptions and tool-cost visibility — Planned
- F60.5: Export paths suitable for small business workflows — Planned

**Status: 70% COMPLETE** (foundations built via F56, F59B, F59C)

#### F61: Project / Production Specialisation

**Description:** Support temporary project groups, crews, and productions with changing participants and budgets.

**Requirements:**
- F61.1: Budget-by-phase or budget-by-category views — Partially built (category budgets exist from V2)
- F61.2: Temporary member roles and scoped responsibilities — Planned
- F61.3: Fast join/leave flows without breaking historical records — ✅ Built in F55
- F61.4: Handover notes and production-specific essentials — ✅ Built in F56
- F61.5: Clear "active run" vs "wrapped" lifecycle state — Planned

**Status: 50% COMPLETE** (foundations from F55, F56, category budgets)

#### F62: Trip & Retreat Specialisation

**Description:** Finish the trip use case with stronger offline and session-based behaviour.

**Requirements:**
- F62.1: Better offline capture for expenses and notes — Planned
- F62.2: Fast entry optimised for phones — Partially built (mobile expense form)
- F62.3: Short-lived premium access or trip-specific packaging — Planned (Trip Pass from V2)
- F62.4: Spend caps, shared pot tracking, and quick settle flows — ✅ Built (funds + settlement)
- F62.5: End-of-trip close and export pack — Partially built (cycle close works for trips)

**Status: 45% COMPLETE** (core financial tools apply, trip-specific UX not done)

---

### Stage 10 — Operator Layer

**Goal:** Support people running multiple spaces without losing the member-led simplicity of the core product.

#### F63: Portfolio Dashboard

**Description:** A multi-space overview for operators or admins managing several spaces.

**Requirements:**
- F63.1: See all spaces in one dashboard
- F63.2: Surface overdue items, unresolved balances, inactive members, and budget issues
- F63.3: Support filtering by status, type, and owner/admin
- F63.4: Provide drill-down from portfolio view into space hubs

**Status: PLANNED** (Command Centre provides cross-group view but not operator-grade portfolio)

#### F64: Operator Roles & Permissions

**Description:** Add permission layers beyond single-group admins.

**Requirements:**
- F64.1: Distinguish member, group admin, space manager, and operator roles
- F64.2: Scope permissions by one space, multiple spaces, or full portfolio
- F64.3: Keep RLS-compatible access boundaries
- F64.4: Make all operator actions auditable

**Status: PLANNED**

#### F65: Portfolio Packaging

**Description:** Package Commune for multi-space customers.

**Requirements:**
- F65.1: Introduce operator-facing packaging separate from member-led plans
- F65.2: Support higher member and space counts
- F65.3: Add portfolio analytics and operational reporting as premium features
- F65.4: Preserve the simple Standard / Pro / Agency path for self-serve users

**Status: PLANNED**

---

## Overall V4 Completion

| Feature | Stage | Status | % |
|---------|-------|--------|---|
| F54: Monthly Close | 8 | ✅ Built | 95% |
| F55: Member Lifecycle | 8 | ✅ Built | 90% |
| F56: Space Essentials | 8 | ✅ Built | 95% |
| F57: Operations Boards | 8 | ✅ Built | 95% |
| F58: Templates & Playbooks | 8 | ✅ Built | 90% |
| F59: Mobile Parity | 8 | 🔄 Partial | 60% |
| F59B: Workspace Billing | 8 | ✅ Built | 90% |
| F59C: Workspace Governance | 8 | ✅ Built | 95% |
| F60: Workspace Specialisation | 9 | 🔄 Foundations | 70% |
| F61: Project Specialisation | 9 | 🔄 Foundations | 50% |
| F62: Trip Specialisation | 9 | 🔄 Foundations | 45% |
| F63: Portfolio Dashboard | 10 | Planned | 0% |
| F64: Operator Roles | 10 | Planned | 0% |
| F65: Portfolio Packaging | 10 | Planned | 0% |

**Stage 8 average: 89%** — Near complete. Focus on mobile parity and polish.
**Stage 9 average: 55%** — Foundations built through shared model. Specialisation layer not yet started.
**Stage 10 average: 0%** — Planned, not started.

---

## Continuing Backlog (From V2/V3)

These features remain unbuilt and are not blocked by V4:

| Feature | Effort | Priority | Notes |
|---------|--------|----------|-------|
| F26: Receipt OCR | Large | High | #1 unmet need across competitors. Photo → extracted amount/description via AI |
| F27: Item-level splitting | Large | High | Tied to OCR. Split receipt by individual items |
| F30: Trip Pass pricing | Small | Medium | £2.99 for 14-day Pro access |
| F31: PWA offline mode | Medium | High for trips | IndexedDB for offline expense entry + sync |
| F39: Open Banking | Very large | Low (post-launch) | Plaid/TrueLayer auto-detect shared expenses |
| F40: In-app settlement | Very large | Low (post-launch) | Stripe Connect P2P transfers |
| F42: Shopping lists | Medium | Low | Shared lists — scope creep risk |

---

## Highest-Leverage Priorities (Updated)

Given that Stage 8 is 89% complete, the next priorities shift:

### Immediate (finish Stage 8)
1. **Commit and push all V4 work** — 70+ files uncommitted
2. **Push remaining migrations** — 3 migrations need `supabase db push`
3. **Mobile hub page** — bring the hub landing page to Expo
4. **F58 subtype presets** — finish specific presets for co-living, coworking, production, festival

### Near-term (launch readiness)
5. **Landing page** — full marketing site (currently skeleton)
6. **End-to-end testing** — Vitest component tests + Playwright smoke tests
7. **Lint cleanup** — 6 files with warnings
8. **Trip Pass pricing (F30)** — small Stripe config, good casual revenue

### Medium-term (post-launch)
9. **Receipt OCR (F26)** — biggest competitive differentiator
10. **PWA offline (F31)** — critical for trip users
11. **Stage 9 specialisation** — only where shared model is insufficient
12. **Stage 10 operator layer** — only after portfolio demand exists

---

## Success Criteria

V4 is successful if:
- A space admin can run a full cycle without spreadsheets or chat-based chasing
- A member can instantly see what they owe, what they need to do, and what changed
- A workspace or studio can use Commune without it feeling home-only
- A group can join, leave, hand over, and close cycles without operational ambiguity
- A new space can be set up from a template without starting from a blank slate
- Mobile becomes good enough for the daily operating loop, not just expense entry

---

## Pricing Implications

Current pricing can remain:
- Standard for one self-serve space
- Pro for heavier self-serve multi-space usage
- Agency for broader teams and operator-style needs

But V4 introduces the need to separate:
- Member-led packaging
- Operator / portfolio packaging

This should happen only after portfolio tooling and role controls are real, not before.

---

## Technical Dependencies

V4 depends on:
- Stronger automated testing across shared finance and lifecycle logic
- A real lint / CI pipeline (`.github/` workflow exists)
- Shared query logic across web and mobile
- Better typed server-side aggregation for hub and portfolio views
- More flexible group metadata schemas for essentials and templates
- Mobile parity infrastructure, including offline-safe drafts
- Vitest config exists (`apps/web/vitest.config.ts`), component tests written but coverage incomplete

---

## Database Migrations (V4)

| Migration | Description | Status |
|-----------|-------------|--------|
| `20260324010000_add_group_cycle_closures.sql` | Cycle close table with audit fields | ✅ Applied to remote |
| `20260324020000_add_space_essentials_and_operations_fields.sql` | Space essentials JSONB + chore extensions | ✅ Applied to remote |
| `20260325010000_add_group_setup_checklist_progress.sql` | Setup checklist progress tracking | ✅ Applied to remote |
| `20260325020000_add_expense_vendor_invoice_context.sql` | Vendor/invoice fields on expenses | ✅ Applied to remote |
| `20260325030000_add_workspace_role_presets_and_approval_policy.sql` | Approval policy + role presets | ✅ Applied to remote |

---

## Key Implementation Files

### Cycle Management (F54)
- `packages/api/src/cycles.ts` — cycle summary, close, reopen
- `apps/web/src/hooks/use-cycles.ts` — React Query hooks
- `apps/web/src/routes/_app/groups/$groupId.close.lazy.tsx` — close page
- `apps/mobile/hooks/use-cycles.ts` — mobile hooks

### Member Lifecycle (F55)
- `packages/api/src/member-lifecycle.ts` — lifecycle summary, schedule departure, restore
- `apps/web/src/hooks/use-member-lifecycle.ts` — React Query hooks
- `apps/mobile/hooks/use-member-lifecycle.ts` — mobile hooks

### Space Essentials (F56)
- `packages/core/src/space-essentials.ts` — type definitions, normalization, field sets
- Integration in group edit and hub pages

### Operations (F57)
- `packages/core/src/operations-templates.ts` — type-aware operation templates
- `packages/core/src/chores.ts` — due date calculation, rotation logic
- `packages/api/src/chores.ts` — CRUD + completion
- `apps/web/src/routes/_app/chores.lazy.tsx` — operations board UI

### Templates & Playbooks (F58)
- `packages/core/src/space-playbooks.ts` — admin onboarding checklists
- `packages/core/src/space-presets.ts` — starter layouts and category suggestions
- `packages/api/src/onboarding.ts` — starter pack application
- `apps/web/src/routes/_app/onboarding.lazy.tsx` — 5-step guided creation

### Workspace (F59B, F59C)
- `packages/core/src/expense-vendor-invoice.ts` — vendor/invoice normalization
- `packages/api/src/workspace-billing.ts` — billing reports
- `apps/web/src/hooks/use-workspace-governance.ts` — governance hooks

---

## Recommended Sequence

1. ~~Finish messaging and docs alignment~~ ✅ Done (README, VISION, PRD updated)
2. ~~Build monthly close and member lifecycle into a reliable admin loop~~ ✅ Done (F54, F55)
3. ~~Generalise essentials and shared operations for any shared space~~ ✅ Done (F56, F57)
4. ~~Pull templates and onboarding playbooks forward~~ ✅ Done (F58)
5. Close mobile parity gaps for the operational loop (F59 — 60% done)
6. Add selective space-type specialisation only where the shared model is insufficient (Stage 9)
7. Only then build the operator layer (Stage 10)

---

*End of PRD V4.2. For the hub system and V3 backlog, see [PRD V3](./PRD-V3.md). For V1 foundations, see [PRD V1.1](./PRD.md).*
