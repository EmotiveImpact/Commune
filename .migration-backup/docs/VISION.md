# Commune — Vision & Context Document

## What Is Commune?

Commune is a shared space and group operations platform for people who live, work, travel, build, or organise together.

It starts with communal finance because money is usually where shared life breaks first. From there, it expands into the practical systems a group needs to run well: member coordination, shared context, responsibilities, approvals, reminders, house information, and group-level visibility.

Commune replaces spreadsheets, WhatsApp threads, notes apps, memory, awkward chasing, and scattered admin with one reliable system for running a shared space or recurring group.

## The Problem

Shared life usually runs across too many disconnected systems.

Money lives in transfers, bank screenshots, Splitwise-style debt lists, and half-remembered agreements. Household coordination lives in chat messages, sticky notes, and verbal reminders. Important information like Wi-Fi, landlord details, house rules, emergency contacts, recurring bills, and who is responsible for what ends up fragmented or lost.

That fragmentation creates the same pattern everywhere:
- People do not know what they owe
- People do not know what has been paid
- People do not know what needs doing
- People do not know who is responsible
- Admin falls on one or two people
- Tension builds because the system is unclear

The bigger opportunity is not only solving bill-splitting. It is making shared spaces and recurring groups feel calm, legible, and well run.

## The Solution

A user creates a Commune hub for a home, studio, workspace, project, trip, collective, couple, crew, or other recurring group.

Inside that hub, members can:
- Track recurring and one-off expenses
- Split costs fairly across the right participants
- See who owes what and who has already paid
- Manage reimbursements, nudges, approvals, budgets, and shared funds
- Keep practical group information in one place
- Coordinate chores, responsibilities, and lightweight communal operations
- View group activity, priorities, and member status from a clear central hub

Every person gets their own view. Every group gets its own operating surface. The product should answer both the financial question and the operational question:

- What do I owe?
- What needs attention right now?

## One-Sentence Definition

Commune is the operating system for shared spaces and recurring groups, combining communal finance with the tools needed to run the group clearly and fairly.

## Core Product Thesis

Communal finance is the entry point, the trust layer, and the source of truth.

The broader product grows around that foundation:
- Money creates the need
- Visibility creates trust
- Coordination reduces friction
- Group identity creates attachment
- Operational tooling makes the product indispensable

Commune should become the place a shared space or recurring group opens to understand the state of the group in seconds.

Subtype intelligence should sharpen that core experience, not fragment it. Commune should stay one platform with one shared operating model:
- the same finance backbone
- the same essentials model
- the same operations model
- the same onboarding and lifecycle structure

Types and subtypes should mostly change defaults, guidance, ordering, templates, and a few targeted behaviours. They should not create separate mini-products.

## What Makes This Different

This is not a bill-splitting app for dinners.

This is for:
- Ongoing shared living and working
- Recurring monthly obligations
- Partial participation and uneven usage
- Household and group-level transparency
- Shared admin that continues over time
- Running the group, not just recording the debt

The strongest wedge remains the same:

**Commune is for ongoing shared life, not one-off group spending.**

What has changed is the product scope around that wedge:

**Commune now aims to run the group, not just track its expenses.**

## Product Pillars

### 1. Communal Finance
- Expenses, splits, reimbursements, recurring bills
- Budgets, funds, approvals, settlement, templates
- Clear personal and group-level breakdowns

### 2. Household And Group Operations
- Chores and responsibilities
- Pinned announcements and group context
- House information and shared reference details
- Priority surfaces for what needs attention now

### 3. Visibility And Accountability
- Member-level views
- Activity history
- Group status and health indicators
- Clear ownership, roles, and responsibility

### 4. Calm Identity-Driven UX
- Each group feels like a real place, not a spreadsheet
- The hub gives orientation instantly
- Design reduces friction rather than amplifying tension

## Target Users

**Primary:** Shared households, co-living houses, shared studios, small workspaces, project spaces, creative collectives, trips, crews, couples with partly-shared finances, and any recurring group where two or more people coordinate money and responsibilities.

**Secondary:** Founder houses, student houses, family units managing shared obligations, retreat groups, temporary productions, volunteer groups, and local communities with recurring shared costs and operating needs.

**Future B2B / Operator Layer:** Co-living operators, student accommodation managers, retreat organisers, shared office managers, and other people running multiple communal spaces.

## Vision Statement

To become the simplest and most trusted way to run a shared space or recurring group.

## Mission

Help groups live, organise, and manage money together without friction, confusion, or awkwardness.

## Strategic Direction

Commune is evolving from a shared expense app into a shared space platform.

That does not mean abandoning the original product. It means extending it in the most natural direction:
- From expenses to month-end clarity
- From debt tracking to group accountability
- From member lists to living group identity
- From bills to shared operations
- From one space to many space types through one shared model, and eventually into a future operator platform

The product should feel useful at two levels:
- For an individual member: "I know what I owe and what I need to do"
- For a group admin or operator: "I can run this house or group properly"

## Product Philosophy

1. **Clarity over cleverness** — users should understand the state of the group immediately
2. **Trust is everything** — financial calculations and status indicators must be dependable
3. **Money is the backbone** — the wider product can expand, but communal finance remains the source of truth
4. **Shared does not always mean equal** — real groups have uneven participation, changing circumstances, and exceptions
5. **Every person needs their own view** — personal context is a first-class requirement
6. **Every group needs its own surface** — the hub should feel like a living operational space
7. **Calm UX wins** — the product should reduce tension, not dramatise it
8. **Real life is messy** — people join late, leave early, change agreements, miss payments, and forget tasks
9. **Operational depth beats feature sprawl** — new features must make the group easier to run
10. **Specialise by layering, not branching** — subtype-aware intelligence should improve the shared model, not split Commune into unrelated apps

## Strategic Guardrails

Commune should broaden with discipline.

Things Commune should become:
- A system of record for communal money
- A command centre for group priorities
- A lightweight operating layer for shared spaces and recurring groups
- A trusted tool for both members and organisers
- One shared platform that adapts to homes, workspaces, projects, trips, and other recurring spaces through smart defaults and targeted context

Things Commune should not become:
- A generic chat app
- A generic social network
- A generic project management tool
- A bloated productivity suite with weak connection to communal living
- A bundle of disconnected niche products with separate flows for every subtype

Every major feature should pass this test:

**Does it reduce friction in shared spaces, shared money, shared responsibility, or group administration?**

If not, it is probably outside the product boundary.

## The Core User Questions

The interface must answer these immediately:
- What is this group?
- What do I owe?
- What has been paid already?
- What needs attention right now?
- Who is responsible for what?
- What changed recently?
- Where do I go next?

For operator and admin use cases, it should also answer:
- Is this group healthy?
- Where is the friction?
- Which members or obligations need follow-up?

## Emotional Value

Users want relief from:
- Being the one who always chases
- Not knowing what they owe
- Not knowing whether others are contributing
- Repeating the same group information over and over
- Managing shared life through scattered tools
- Feeling low-grade resentment because the system is vague

The product sells:
- Clarity
- Fairness
- Peace
- Accountability
- Trust
- Orientation
- Lower admin overhead

## Tech Stack

- **Web:** React + Vite + TypeScript + Mantine + TanStack Router + TanStack Query + Zustand
- **Mobile:** Expo + React Native + TypeScript + HeroUI Native
- **Backend:** Supabase (PostgreSQL + Auth + RLS)
- **Monorepo:** Turborepo + pnpm
- **Validation:** Zod (shared across web and mobile)
- **Payments:** Stripe

### User Profile
- first_name (required) + last_name (optional)
- email (from auth, read-only)
- avatar_url
- phone, country
- payment methods and payment coordination details
- default_currency, timezone
- notification_preferences
- name auto-generated from first_name + last_name for compatibility

## Non-Negotiable Technical Principle

The split, settlement, and statement logic must not live only in the UI.

Core communal finance logic is product-critical. It must live in shared business logic, be validated server-side, and remain consistent across web, mobile, exports, notifications, and any future operator tooling. If different surfaces produce different answers, the product is broken.

## Pricing

| | Standard | Pro | Agency |
|---|---|---|---|
| Price | £4.99/mo | £9.99/mo | £29.99/mo |
| Annual | £49.99/yr | £99.99/yr | £299.99/yr |
| Members per group | 8 | 15 | Unlimited |
| Groups | 1 | 3 | Unlimited |
| Trial | 7 days free | 7 days free | 7 days free |

No free tier. Every user pays after trial.

Current pricing serves member-led groups. Over time, Commune can support higher-value operator and portfolio use cases across homes, studios, workspaces, retreats, and other multi-space organisations.

## Brand Direction

- Clean, modern, organised, calm, trustworthy, quietly premium
- Strong typography, generous whitespace, obvious hierarchy
- Less dashboard noise, more orientation
- A group should feel like a place, not just a ledger
- Emotional mood: less stress, more clarity, more control

## Messaging

**Primary:** Run your shared space without the awkwardness.

**Alternatives:**
- Know what you owe, what is due, and what needs doing
- Shared living, made clear
- The operating system for shared spaces and recurring groups
- Shared costs, responsibilities, and group admin in one place

## Success Criteria

Version 1 is successful if a shared space or recurring group can use Commune for a full month and say:
- I know what I owe
- I can see why
- I know what needs attention
- The group feels easier to run
- It reduced confusion
- It reduced awkward chasing
- It gave us one place for the important stuff

The broader vision is successful when Commune becomes the default control surface for a shared space or recurring group:
- Members trust it
- Admins rely on it
- Operators can scale with it
- The group no longer depends on memory, spreadsheets, or scattered chat threads
