# V4 Remaining Work

**Date:** 2026-03-25
**Status:** Execution note for the next V4 tasks after cycle close, lifecycle, essentials, operations, and starter onboarding.

## 1. Local DB Prerequisites

The pending V4 schema work is already written, but local application is blocked until Docker is running because Supabase local dev depends on the Docker daemon.

**Required before local DB apply:**
- Docker Desktop or an equivalent Docker daemon running
- Supabase CLI installed and available on `PATH`

**Commands:**
- `pnpm db:start`
- `pnpm db:reset`

That will apply:
- [20260324010000_add_group_cycle_closures.sql](/Users/augustusedem/Commune/supabase/migrations/20260324010000_add_group_cycle_closures.sql)
- [20260324020000_add_space_essentials_and_operations_fields.sql](/Users/augustusedem/Commune/supabase/migrations/20260324020000_add_space_essentials_and_operations_fields.sql)

**Verification after reset:**
- Open Supabase Studio on `http://127.0.0.1:54323`
- Confirm `groups.space_essentials` exists
- Confirm `chores.category`, `chores.task_type`, `chores.checklist_items`, and `chores.escalation_days` exist
- Confirm cycle close pages load and operations starter data can be inserted

## 2. Finish F58 Properly

The starter pack is live, but F58 is only partially complete. What remains:

### Templates by Type and Subtype
- Add subtype-specific essentials defaults, not just subtype-specific operations
- Add starter expense category suggestions during onboarding
- Decide whether starter presets should auto-create split templates for common recurring costs

### Admin Playbooks
- Persist checklist completion state or explicitly keep it as setup guidance only
- Add owner/admin handover checklist entry points from lifecycle screens
- Connect checklist completion to monthly close readiness only if the checklist becomes persisted data

### Prebuilt Starting Layouts
- Define one preset per mature subtype first:
  - `home/coliving`
  - `home/high_turnover`
  - `workspace/coworking`
  - `project/production`
  - `trip/festival`
- Keep presets editable and additive, not mode-specific forks

## 3. Integration Coverage

Current validation is strong at typecheck/lint/core-unit level, but not at end-to-end flow level.

**Minimum next coverage to add:**
- Create-group modal:
  - creates group without starter pack
  - creates group with starter pack
  - survives starter-pack failure without showing create failure
- Onboarding flow:
  - subtype selection affects starter preview
  - starter setup saves essentials and advances to invite step
- Operations page:
  - starter board loads subtype-aware templates

**Practical path:**
- Add Vitest component tests if the repo already introduces a UI test harness
- Otherwise add Playwright smoke coverage for create/onboarding/operations happy paths

## 4. Lint Cleanup

Existing non-blocking warnings still live in:
- [new.tsx](/Users/augustusedem/Commune/apps/mobile/app/expenses/new.tsx)
- [members.tsx](/Users/augustusedem/Commune/apps/mobile/app/members.tsx)
- [notifications.tsx](/Users/augustusedem/Commune/apps/mobile/app/notifications.tsx)
- [recurring.tsx](/Users/augustusedem/Commune/apps/mobile/app/recurring.tsx)
- [use-recurring.ts](/Users/augustusedem/Commune/apps/mobile/hooks/use-recurring.ts)
- [layout.tsx](/Users/augustusedem/Commune/apps/landing/src/app/layout.tsx)

These are not blocking builds, but they should be cleaned before broader Stage 8 and Stage 9 work keeps widening the diff.

## 5. Suggested Execution Order

1. Start Docker and run `pnpm db:start`
2. Run `pnpm db:reset`
3. Smoke test cycle close, lifecycle, essentials, operations, and starter onboarding against the local DB
4. Finish F58 presets and checklist decisions
5. Add flow coverage for create/onboarding/operations
6. Clear remaining lint warnings
