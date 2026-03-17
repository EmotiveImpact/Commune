# Commune — Vision & Context Document

## What Is Commune?

Commune is a shared expense and communal money management platform for groups of people who live, work, build, or organise together. It replaces spreadsheets, WhatsApp messages, memory, and awkward conversations with one reliable system.

## The Problem

In shared environments, money becomes messy quickly. One person pays upfront and expects others to remember. Subscriptions are used by only some members. Communal items are bought casually and forgotten. There is no proper end-of-month breakdown. No visibility into who has paid and who has not.

Most groups solve this through random bank transfers, group chats, notes apps, spreadsheets, memory, vague assumptions, and emotional pressure.

## The Solution

A user creates a group. That group can be a home, household, workspace, project, trip, or any communal unit. Members are invited. Shared expenses are added — recurring or one-off. Each expense specifies which members are included and how the cost is split.

The app calculates what each member owes and gives every person a clean itemised monthly breakdown showing what they owe, what each item is for, whether it is paid or unpaid, and whether someone else fronted the cost and needs reimbursing.

## One-Sentence Definition

A shared money app for groups that tracks communal expenses, splits costs fairly, and gives every member a clean itemised breakdown of what they owe.

## What Makes This Different

This is not a bill-splitting app for dinners. It is designed for:
- Ongoing shared living and working
- Recurring monthly obligations
- Partial participation (not every cost applies to everyone)
- Household-level transparency and accountability
- Monthly communal administration

The strongest wedge: **this is for ongoing shared life, not one-off group spending.**

## Target Users

**Primary:** Housemates, shared households, couples with partly-shared finances, small studios, project teams, temporary communal groups.

**Secondary:** Student housing, co-living spaces, creative collectives, production crews, startup teams, family groups managing shared subscriptions.

**Future B2B:** Co-living operators, student accommodation managers, retreat organisers, shared office managers.

## Vision Statement

To become the simplest and most trusted way for groups to manage shared costs fairly, transparently, and without friction.

## Mission

Help groups manage shared money without awkwardness.

## Product Philosophy

1. **Clarity over cleverness** — users understand what is happening immediately
2. **Trust is everything** — calculations must be dependable and obvious
3. **Shared does not always mean equal** — handle partial participation naturally
4. **Ongoing systems over one-off events** — prioritise recurring communal expenses
5. **Every person needs their own view** — personal breakdown is a first-class feature
6. **Calm UX wins** — reduce tension, never amplify it
7. **Real life is messy** — people join late, leave early, change agreements mid-month

## The Core User Questions

The interface must answer these immediately:
- What am I paying for?
- How much do I owe this month?
- Which items am I included in?
- Which costs are shared by everyone and which are not?
- What is overdue?
- Has this been paid already?
- If someone paid upfront, who owes them?

## Emotional Value

Users want relief from: being the one who always chases, not knowing what they owe, feeling someone else is not pulling their weight, awkward confrontations, and the silent resentment that builds when money is unclear.

The product sells: clarity, fairness, peace, accountability, trust, less friction.

## Tech Stack

- **Web:** React + Vite + TypeScript + Mantine 9 + TanStack Router + TanStack Query + Zustand
- **Mobile:** Expo + React Native + TypeScript + HeroUI Native (Phase 2)
- **Backend:** Supabase (PostgreSQL + Auth + RLS)
- **Monorepo:** Turborepo + pnpm
- **Validation:** Zod (shared across web and mobile)
- **Payments:** Stripe

## Non-Negotiable Technical Principle

The split and statement logic must not live only in the UI. It is centralised in a shared business logic package and validated server-side via Postgres triggers. If web says one number and mobile says another, the product is broken.

## Pricing

| | Standard | Pro | Agency |
|---|---|---|---|
| Price | £4.99/mo | £9.99/mo | £29.99/mo |
| Annual | £49.99/yr | £99.99/yr | £299.99/yr |
| Members per group | 5 | 15 | Unlimited |
| Groups | 1 | 3 | Unlimited |
| Trial | 7 days free | 7 days free | 7 days free |

No free tier. Every user pays after trial.

## Revenue Projections

| Scale | Monthly Revenue | Annual Gross Profit | Gross Margin |
|---|---|---|---|
| 10K users | £7,856 | £35,064 | 81% |
| 50K users | £39,313 | £175,728 | 81% |
| 100K users | £78,673 | £346,824 | 81% |
| 500K users | £393,313 | £3,844,332 | 81% |

Infrastructure costs stay under 1% of revenue at every scale due to the direct client + RLS architecture.

## Brand Direction

- Clean, modern, organised, calm, trustworthy, quietly premium
- Strong typography, generous whitespace, muted palette
- Obvious numbers, minimal clutter
- Emotional mood: less stress, more clarity

## Messaging

**Primary:** Shared expenses without the awkwardness.

**Alternatives:**
- Know what you owe, and why
- Shared costs made fair
- Calm, transparent group money

## Success Criteria

Version 1 is successful if a small household or group can use it for one full month and say:
- I know what I owe
- I can see why
- It is easy to update
- It stopped confusion
- It made things fairer
- It reduced awkward chasing
